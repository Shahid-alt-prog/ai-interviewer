"""Interview service orchestrating the interview sessions, Q&A, and evaluations."""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview import Interview, InterviewStatus
from app.models.interview_plan import InterviewPlan
from app.models.question import Question
from app.models.response import Response
from app.models.evaluation import Evaluation
from app.models.report import Report
from app.repositories.interview import InterviewRepository
from app.repositories.candidate import CandidateRepository
from app.repositories.interview_plan import InterviewPlanRepository
from app.repositories.question import QuestionRepository
from app.repositories.evaluation import EvaluationRepository as EvalRepo

from app.agents.interview import InterviewAgent
from app.agents.evaluation import EvaluationAgent
from app.agents.report import ReportAgent
from app.core.config import settings

logger = logging.getLogger(__name__)


class InterviewService:
    """Service to coordinate interview lifecycle and Gemini AI integrations."""

    def __init__(
        self,
        db: AsyncSession,
        interview_repo: InterviewRepository,
        candidate_repo: CandidateRepository,
        plan_repo: InterviewPlanRepository,
        question_repo: QuestionRepository,
        eval_repo: EvalRepo,
        interview_agent: InterviewAgent,
        eval_agent: EvaluationAgent,
        report_agent: ReportAgent,
    ):
        self.db = db
        self.interview_repo = interview_repo
        self.candidate_repo = candidate_repo
        self.plan_repo = plan_repo
        self.question_repo = question_repo
        self.eval_repo = eval_repo
        
        self.interview_agent = interview_agent
        self.eval_agent = eval_agent
        self.report_agent = report_agent

    async def create_interview(self, title: str, job_description: str, candidate_id: uuid.UUID, interview_type: str, duration_minutes: int, difficulty: str = "medium") -> Interview:
        """Create a new interview record."""
        # Setup using schema validator logic indirectly
        from app.schemas.interview import InterviewCreate
        schema = InterviewCreate(
            candidate_id=candidate_id,
            title=title,
            job_description=job_description,
            interview_type=interview_type,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
        )
        return await self.interview_repo.create(schema)

    async def start_interview(self, interview_id: uuid.UUID, interviewer_name: str = "Alex") -> Tuple[Interview, Question]:
        """Start the interview, generate the plan, and ask the first question."""
        interview = await self.interview_repo.get_by_id(interview_id, load_relations=True)
        if not interview:
            raise ValueError("Interview not found.")

        if interview.status not in (InterviewStatus.CREATED, InterviewStatus.READY):
            raise ValueError(f"Interview cannot be started from status {interview.status.value}")

        candidate = interview.candidate
        if not candidate:
            raise ValueError("Candidate profile not found for this interview.")

        # 1. Check if plan already exists or generate new one
        if interview.plan:
            logger.info(f"Using existing interview plan for interview {interview_id}")
            plan = interview.plan
            sections = plan.sections
        else:
            logger.info(f"Generating interview plan for interview {interview_id}")
            skills = candidate.skills or []
            experience = candidate.experience or []
            plan_data = await self.interview_agent.generate_plan(
                job_description=interview.job_description,
                skills=skills,
                experience=experience,
                duration_minutes=interview.duration_minutes,
                interview_type=getattr(interview.interview_type, "value", interview.interview_type),
                difficulty=getattr(interview.difficulty, "value", interview.difficulty),
            )
            
            # 2. Save Plan in database
            logger.info(f"Saving interview plan in DB")
            sections = plan_data.get("sections", [])
            plan = await self.plan_repo.create_plan(
                interview_id=interview_id,
                sections_data=sections,
                plan_metadata={"generated_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()},
            )

        # 3. Formulate first question
        # We start with the first section's questions pool, or a warm welcome introduction.
        first_section = sections[0] if sections else {"name": "Introduction", "description": "Welcome"}
        opening_message = (
            f"Hello {candidate.name}! Thank you for joining us today. I am {interviewer_name}, and I will be conducting "
            f"your interview for the '{interview.title}' position. To start off, could you briefly introduce yourself "
            f"and walk me through some of your relevant background?"
        )

        # 4. Create first Question record if it doesn't exist
        if interview.questions:
            question = interview.questions[0]
        else:
            question = await self.question_repo.create_question(
                interview_id=interview_id,
                section=first_section.get("name", "Introduction"),
                question_text=opening_message,
                question_type="primary",
                sequence_number=1,
                follow_up_depth=0,
            )

        # 5. Update Interview status
        await self.interview_repo.update(
            interview=interview,
            update_dict={
                "status": InterviewStatus.IN_PROGRESS,
                "started_at": datetime.now(timezone.utc).replace(tzinfo=None),
                "current_section": first_section.get("name", "Introduction"),
                "conversation_history": [{"role": "interviewer", "text": opening_message}],
                "covered_topics": [],
                "metadata_json": {"interviewer_name": interviewer_name}
            }
        )
        await self.db.refresh(interview)

        return interview, question

    async def process_candidate_message(
        self,
        interview_id: uuid.UUID,
        candidate_message: str,
    ) -> Tuple[Interview, Optional[Question], bool]:
        """Process candidate response, evaluate it, and generate next question or finalize report."""
        interview = await self.interview_repo.get_by_id(interview_id, load_relations=True)
        if not interview or interview.status != InterviewStatus.IN_PROGRESS:
            raise ValueError("Interview is not in progress.")

        # 1. Retrieve latest asked question to associate response with
        latest_question = await self.question_repo.get_latest_question(interview_id)
        if not latest_question:
            raise ValueError("No questions found for this interview.")

        existing_response = await self.question_repo.get_response_by_question_id(latest_question.id)
        if existing_response:
            existing_evaluation = await self.eval_repo.get_evaluation_by_response_id(existing_response.id)
            if existing_evaluation:
                logger.warning(
                    "Ignoring duplicate candidate submission for interview %s question %s",
                    interview_id,
                    latest_question.id,
                )
            return interview, None, False

        # 2. Record the candidate's Response
        # Calculate response duration if possible (mocked here or tracked on client side)
        duration_seconds = 60.0  # Default mock duration
        response = await self.question_repo.create_response(
            question_id=latest_question.id,
            response_text=candidate_message,
            duration_seconds=duration_seconds,
        )

        # 3. Evaluate the response using EvaluationAgent in Gemini Pro
        logger.info(f"Evaluating candidate response for question {latest_question.id}")
        eval_result = await self.eval_agent.evaluate_response(
            job_description=interview.job_description,
            question_text=latest_question.question_text,
            question_type=latest_question.question_type,
            section_name=latest_question.section,
            response_text=candidate_message,
        )

        # Save Evaluation details in DB
        await self.eval_repo.create_evaluation(
            response_id=response.id,
            score=eval_result.get("score", 5),
            confidence=eval_result.get("confidence", 0.9),
            technical_score=eval_result.get("technical_score"),
            communication_score=eval_result.get("communication_score"),
            problem_solving_score=eval_result.get("problem_solving_score"),
            leadership_score=eval_result.get("leadership_score"),
            domain_expertise_score=eval_result.get("domain_expertise_score"),
            strengths=eval_result.get("strengths", []),
            weaknesses=eval_result.get("weaknesses", []),
            follow_up_needed=eval_result.get("follow_up_needed", False),
            follow_up_reason=eval_result.get("follow_up_reason"),
            evaluation_reasoning=eval_result.get("evaluation_reasoning"),
            raw_ai_response=eval_result,
        )

        # 4. Update conversation history
        history = list(interview.conversation_history or [])
        history.append({"role": "candidate", "text": candidate_message})

        # 5. Calculate progress & time tracking
        plan = interview.plan
        if not plan:
            raise ValueError("Interview plan not found.")

        sections = plan.sections
        current_sec_index = plan.current_section_index

        # Precise wall-clock time accounting
        elapsed_seconds = (
            datetime.now(timezone.utc).replace(tzinfo=None) - interview.started_at
        ).total_seconds()
        total_seconds = interview.duration_minutes * 60
        time_remaining_seconds = max(0.0, total_seconds - elapsed_seconds)
        time_remaining_minutes = time_remaining_seconds / 60.0
        progress = min(99.0, (elapsed_seconds / total_seconds) * 100)

        # Count questions asked so far in current section
        all_questions = await self.question_repo.list_questions_for_interview(interview_id)
        current_section_data = sections[current_sec_index] if current_sec_index < len(sections) else {"name": "Interview"}
        current_sec_name = current_section_data.get("name", "")
        questions_in_current_section = sum(
            1 for q in all_questions
            if q.section == current_sec_name
        )
        questions_asked = len(all_questions)

        # Use evaluator's follow_up signal to guide AI decision-making
        follow_up_signal = "no"
        if eval_result.get("follow_up_needed"):
            follow_up_signal = "yes"
        # If time is very short, override to wrap up
        if time_remaining_minutes < 3.0:
            follow_up_signal = "wrap"

        # Get interviewer name from metadata_json if present
        interviewer_name = "Alex"
        if (
            interview.metadata_json
            and isinstance(interview.metadata_json, dict)
            and "interviewer_name" in interview.metadata_json
        ):
            interviewer_name = interview.metadata_json["interviewer_name"]

        # 6. Call InterviewAgent with full context
        logger.info(
            f"Generating next turn for interview {interview_id} — "
            f"{round(time_remaining_minutes, 1)} min remaining, "
            f"follow_up_signal={follow_up_signal}, progress={round(progress, 1)}%"
        )
        candidate = interview.candidate
        skills = candidate.skills or []
        experience = candidate.experience or []

        agent_response = await self.interview_agent.generate_next_message(
            job_description=interview.job_description,
            candidate_name=candidate.name,
            skills=skills,
            experience=experience,
            current_section=current_section_data,
            all_sections=sections,
            interview_progress=progress,
            time_remaining_minutes=time_remaining_minutes,
            total_duration_minutes=interview.duration_minutes,
            questions_asked=questions_asked,
            questions_in_current_section=questions_in_current_section,
            conversation_history=history,
            candidate_response=candidate_message,
            interview_type=getattr(interview.interview_type, "value", interview.interview_type),
            max_follow_up_depth=settings.MAX_FOLLOW_UP_DEPTH,
            interviewer_name=interviewer_name,
            follow_up_signal=follow_up_signal,
            difficulty=getattr(interview.difficulty, "value", interview.difficulty),
        )

        ai_message = agent_response.get("ai_message", "")
        agent_section = agent_response.get("section", current_section_data.get("name"))
        # is_complete if: agent says so, time is up, or progress >= 95%
        is_complete = (
            agent_response.get("is_complete", False)
            or time_remaining_minutes <= 0
            or progress >= 95.0
        )

        # Sync section index with database if the agent transitioned to another section
        # Find if agent_section matches a section in our plan
        for idx, sec in enumerate(sections):
            if sec.get("name").lower() == agent_section.lower() and idx > current_sec_index:
                logger.info(f"Transitioning from section '{current_section_data.get('name')}' to '{sec.get('name')}'")
                await self.plan_repo.mark_section_completed(plan.id, current_section_data.get("name"))
                current_sec_index = idx
                plan.current_section_index = idx
                await self.plan_repo.update_plan(plan, {"current_section_index": idx})
                break

        # 7. Check if interview is finished
        if is_complete:
            logger.info(f"Concluding interview {interview_id}")
            # Append final closing remarks if not already added by agent
            history.append({"role": "interviewer", "text": ai_message})
            
            # Transition to completing
            await self.interview_repo.update(
                interview=interview,
                update_dict={
                    "status": InterviewStatus.EVALUATING,
                    "completed_at": datetime.now(timezone.utc).replace(tzinfo=None),
                    "conversation_history": history,
                }
            )

            # Generate Report (run synchronously/await here, or can be done in background. Awaiting is robust for API response)
            existing_report = await self.eval_repo.get_report_by_interview_id(interview_id)
            if not existing_report:
                await self.generate_final_report(interview)
            
            # Update to completed
            await self.interview_repo.update(
                interview=interview,
                update_dict={"status": InterviewStatus.COMPLETED}
            )
            
            return interview, None, True

        # 8. Record the newly generated Question
        history.append({"role": "interviewer", "text": ai_message})
        
        next_seq = latest_question.sequence_number + 1
        follow_up_depth = 0
        if agent_response.get("is_follow_up"):
            follow_up_depth = latest_question.follow_up_depth + 1

        next_question = await self.question_repo.create_question(
            interview_id=interview_id,
            section=sections[current_sec_index].get("name") if current_sec_index < len(sections) else "Interview",
            question_text=ai_message,
            question_type="follow_up" if agent_response.get("is_follow_up") else "primary",
            parent_question_id=latest_question.id if agent_response.get("is_follow_up") else None,
            sequence_number=next_seq,
            follow_up_depth=follow_up_depth,
            intent=agent_response.get("intent"),
        )

        # Update interview conversation history and current section
        await self.interview_repo.update(
            interview=interview,
            update_dict={
                "current_section": sections[current_sec_index].get("name") if current_sec_index < len(sections) else "Interview",
                "conversation_history": history,
            }
        )

        return interview, next_question, False

    async def generate_final_report(self, interview: Interview) -> Report:
        """Synthesize all question-level evaluations and create the final scorecard report."""
        logger.info(f"Synthesizing scorecard and generating report for interview {interview.id}")
        candidate = interview.candidate
        
        # 1. Retrieve all questions and responses with evaluations
        questions = await self.question_repo.list_questions_for_interview(interview.id)
        
        qa_history = []
        for q in questions:
            if q.response and q.response.evaluation:
                qa_history.append({
                    "question": q.question_text,
                    "response": q.response.response_text,
                    "evaluation": {
                        "score": q.response.evaluation.score,
                        "confidence": q.response.evaluation.confidence,
                        "strengths": q.response.evaluation.strengths,
                        "weaknesses": q.response.evaluation.weaknesses,
                        "evaluation_reasoning": q.response.evaluation.evaluation_reasoning,
                    }
                })

        # 2. Call ReportAgent via Gemini Pro
        report_data = await self.report_agent.generate_report(
            job_description=interview.job_description,
            candidate_name=candidate.name,
            skills=candidate.skills or [],
            experience=candidate.experience or [],
            qa_history=qa_history,
            conversation_history=interview.conversation_history or [],
        )

        # 3. Create Report in database
        report = await self.eval_repo.create_report(
            interview_id=interview.id,
            overall_score=report_data.get("overall_score", 5.0),
            technical_rating=report_data.get("technical_rating", 5),
            communication_rating=report_data.get("communication_rating", 5),
            problem_solving_rating=report_data.get("problem_solving_rating", 5),
            leadership_rating=report_data.get("leadership_rating", 5),
            domain_expertise_rating=report_data.get("domain_expertise_rating"),
            strengths=report_data.get("strengths", []),
            weaknesses=report_data.get("weaknesses", []),
            recommendation=report_data.get("recommendation", "Hold"),
            recommendation_reasoning=report_data.get("recommendation_reasoning", ""),
            summary=report_data.get("summary", ""),
            detailed_feedback=report_data.get("detailed_feedback"),
            section_scores=report_data.get("section_scores"),
            raw_ai_response=report_data,
        )

        return report
