"""Interview planning and conversation generation agent using Groq LLM."""
import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings
from app.prompts import load_prompt
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)


class InterviewAgent:
    """Agent for planning interviews and conducting interactive conversations."""

    def __init__(self, gemini_service: GeminiService):
        self.gemini = gemini_service

    async def generate_plan(
        self,
        job_description: str,
        skills: List[str],
        experience: List[Dict[str, Any]],
        duration_minutes: int,
        interview_type: str,
        difficulty: str = "medium",
    ) -> Dict[str, Any]:
        """Generate a structured interview plan using the Pro model."""
        prompt_template = load_prompt("interview_planner")

        # Format candidate summary
        skills_str = ", ".join(skills) if skills else "Not specified"
        exp_list = []
        for exp in (experience or []):
            role = exp.get("role", "N/A")
            company = exp.get("company", "N/A")
            exp_list.append(f"{role} at {company}")
        exp_summary = "; ".join(exp_list) if exp_list else "Not specified"

        prompt = prompt_template.format(
            job_description=job_description,
            skills=skills_str,
            experience_summary=exp_summary,
            duration_minutes=duration_minutes,
            interview_type=interview_type,
            difficulty=difficulty,
        )

        system_instruction = (
            "You are a professional HR assessment designer. "
            "Design structured, time-aware interview plans that feel natural and conversational."
        )

        try:
            logger.info("Generating structured interview plan...")
            result = await self.gemini.generate_json(
                prompt=prompt,
                model_name=settings.GEMINI_PRO_MODEL,
                system_instruction=system_instruction,
            )
            return result
        except Exception as e:
            logger.error(f"Failed to generate interview plan: {e}")
            # Fallback plan with sensible defaults
            section_time = max(5, duration_minutes // 3)
            return {
                "sections": [
                    {
                        "name": "Introduction",
                        "description": "Icebreaker and background discussion",
                        "duration_minutes": section_time,
                        "topics": ["Resume walk-through", "Role interest", "Career goals"],
                        "questions_pool": [
                            "Could you briefly walk me through your background and what brought you to this role?",
                            "What excites you most about this opportunity?",
                        ],
                    },
                    {
                        "name": "Core Assessment",
                        "description": "Core skills and experience assessment",
                        "duration_minutes": section_time,
                        "topics": ["Technical experience", "Key projects", "Problem solving"],
                        "questions_pool": [
                            "What's a complex problem you solved recently and how did you approach it?",
                            "Can you walk me through a project you're most proud of?",
                        ],
                    },
                    {
                        "name": "Wrap Up",
                        "description": "Candidate questions and closing",
                        "duration_minutes": max(3, duration_minutes - section_time * 2),
                        "topics": ["Candidate questions", "Next steps"],
                        "questions_pool": ["Do you have any questions for us?"],
                    },
                ]
            }

    async def generate_next_message(
        self,
        job_description: str,
        candidate_name: str,
        skills: List[str],
        experience: List[Dict[str, Any]],
        current_section: Dict[str, Any],
        all_sections: List[Dict[str, Any]],
        interview_progress: float,
        time_remaining_minutes: float,
        total_duration_minutes: int,
        questions_asked: int,
        questions_in_current_section: int,
        conversation_history: List[Dict[str, str]],
        candidate_response: str,
        interview_type: str,
        max_follow_up_depth: int = 3,
        interviewer_name: str = "Alex",
        follow_up_signal: str = "no",
        difficulty: str = "medium",
    ) -> Dict[str, Any]:
        """Generate the next question or response for the candidate."""
        prompt_template = load_prompt("interviewer")

        # Format candidate summary
        skills_str = ", ".join(skills) if skills else "Not specified"
        exp_list = []
        for exp in (experience or []):
            role = exp.get("role", "N/A")
            company = exp.get("company", "N/A")
            exp_list.append(f"{role} at {company}")
        exp_summary = "; ".join(exp_list) if exp_list else "Not specified"

        # Format conversation history (last 12 turns to avoid context overflow)
        history_lines = []
        for msg in conversation_history[-12:]:
            role = "Candidate" if msg.get("role") == "candidate" else "Interviewer"
            history_lines.append(f"{role}: {msg.get('text', '')}")
        history_str = "\n".join(history_lines) if history_lines else "No previous conversation."

        # Build sections remaining (sections after current)
        current_sec_name = current_section.get("name", "")
        current_idx = next(
            (i for i, s in enumerate(all_sections) if s.get("name") == current_sec_name),
            0,
        )
        sections_remaining = [s.get("name") for s in all_sections[current_idx + 1:]]
        sections_remaining_str = ", ".join(sections_remaining) if sections_remaining else "None — this is the last section"

        # Full sections summary for context
        full_sections_summary_lines = []
        for i, sec in enumerate(all_sections):
            marker = "← CURRENT" if sec.get("name") == current_sec_name else ""
            full_sections_summary_lines.append(
                f"{i+1}. {sec.get('name')} ({sec.get('duration_minutes', '?')} min) — {sec.get('description', '')} {marker}"
            )
        full_sections_summary = "\n".join(full_sections_summary_lines)

        # Questions pool as a simple string
        questions_pool = current_section.get("questions_pool", [])
        questions_pool_str = "\n".join(f"- {q}" for q in questions_pool) if questions_pool else "Improvise based on context."

        prompt = prompt_template.format(
            interviewer_name=interviewer_name,
            job_description=job_description,
            candidate_name=candidate_name,
            skills=skills_str,
            experience_summary=exp_summary,
            current_section_name=current_section.get("name", "Introduction"),
            current_section_description=current_section.get("description", "Getting started"),
            current_section_topics=", ".join(current_section.get("topics", [])),
            current_section_questions_pool=questions_pool_str,
            full_sections_summary=full_sections_summary,
            sections_remaining=sections_remaining_str,
            interview_progress=round(interview_progress, 1),
            time_remaining_minutes=round(time_remaining_minutes, 1),
            total_duration_minutes=total_duration_minutes,
            questions_asked=questions_asked,
            questions_in_current_section=questions_in_current_section,
            max_follow_up_depth=max_follow_up_depth,
            conversation_history=history_str,
            candidate_response=candidate_response,
            interview_type=interview_type,
            follow_up_signal=follow_up_signal,
            difficulty=difficulty,
        )

        # Transcription error handling rules
        transcription_handling = (
            "CRITICAL NOTE: The candidate is speaking via a live Web Speech-to-Text API. "
            "Their responses may contain homophone errors, typos, grammatical mistakes, or garbled text. "
            "You MUST read 'through' these transcription errors smartly, infer their true meaning from context, "
            "and NEVER penalize the candidate or explicitly point out the wrong wordings in your response."
        )

        # Rich persona system instructions
        question_enforcement = (
            "CRITICAL REQUIREMENT: You MUST always end your response ('ai_message') with a single, clear question "
            "for the candidate, ending strictly with a question mark (?). If your response does not end with a "
            "question mark (?), it is a critical system failure. You are strictly forbidden from ending your "
            "response with a period or statement, unless you are wrapping up or concluding the interview (where is_complete is true). "
            "Never just react to or analyze their response without asking a follow-up or transition question."
        )

        repetition_ban = (
            "STRICT REPETITION BAN: Do NOT repeat identical conversational openings, sentence structures, or phrases "
            "that you have already used in the conversation history. Keep your language fresh, dynamic, and organic. "
            "Never start multiple turns with the same phrase (e.g., if you started a previous turn with 'Oh nice,' or 'Got it,' "
            "do NOT start this turn with the same words). Do NOT reuse the same reaction or filler phrases. Be highly "
            "conversational and vary your transition/reaction patterns."
        )

        contextual_memory_rule = (
            "CONTEXTUAL MEMORY GRAPH: Stop rigidly following 'Intro -> Core -> Wrap Up'. "
            "Listen to their answers, build a mental graph of their experience, and steer the "
            "conversation naturally towards the most interesting areas."
        )

        if interviewer_name == "Sarah":
            system_instruction = (
                f"You are {interviewer_name}, a friendly but analytically sharp Technical Lead. "
                "You conduct deep technical interviews. You sound like a real engineer — casual, direct, and curious. "
                "You care about HOW things work, tradeoffs, edge cases, and scalability. "
                "You NEVER sound like a corporate HR bot. You never step out of character.\n"
                f"{question_enforcement}\n"
                f"{repetition_ban}\n"
                f"{transcription_handling}\n"
                f"{contextual_memory_rule}"
            )
        elif interviewer_name == "Vikram":
            system_instruction = (
                f"You are {interviewer_name}, a calm and experienced Systems Architect and Ops Manager. "
                "You've seen projects succeed and fail, and you ask pointed questions about execution, leadership, and lessons learned. "
                "You sound wise, pragmatic, and reassuring — like a senior mentor. "
                "You NEVER sound like a corporate HR bot. You never step out of character.\n"
                f"{question_enforcement}\n"
                f"{repetition_ban}\n"
                f"{transcription_handling}\n"
                f"{contextual_memory_rule}"
            )
        else:
            system_instruction = (
                f"You are {interviewer_name}, a warm, genuinely curious HR Talent Partner. "
                "You make candidates feel completely at ease. You listen carefully and react authentically to what they say. "
                "You care deeply about the candidate's journey, motivations, and human story. "
                "You NEVER sound like a corporate HR bot. You never step out of character.\n"
                f"{question_enforcement}\n"
                f"{repetition_ban}\n"
                f"{transcription_handling}\n"
                f"{contextual_memory_rule}"
            )

        try:
            logger.info(
                f"Generating next interviewer message — {round(time_remaining_minutes, 1)} min remaining, "
                f"{round(interview_progress, 1)}% progress, follow_up_signal={follow_up_signal}"
            )
            result = await self.gemini.generate_json(
                prompt=prompt,
                model_name=settings.GEMINI_FLASH_MODEL,
                system_instruction=system_instruction,
                temperature=0.85,
            )
            # Validate critical fields are present
            if not result.get("ai_message"):
                raise ValueError("Empty ai_message in agent response")
            return result
        except Exception as e:
            logger.error(f"Failed to generate next interviewer question: {e}")
            # Smart fallback based on time remaining
            if time_remaining_minutes < 2:
                return {
                    "ai_message": f"That's great, {candidate_name}. I think we've covered quite a lot today — it was genuinely great chatting with you. We'll be in touch very soon!",
                    "intent": "wrap_up",
                    "is_follow_up": False,
                    "section": current_section.get("name", "Wrap Up"),
                    "is_complete": True,
                    "decision_reasoning": "Fallback: time expired",
                }
            return {
                "ai_message": "That's really interesting. Can you tell me a bit more about how that experience shaped your approach to similar challenges?",
                "intent": "follow_up_clarification",
                "is_follow_up": True,
                "section": current_section.get("name", "Introduction"),
                "is_complete": False,
                "decision_reasoning": "Fallback: API error",
            }
