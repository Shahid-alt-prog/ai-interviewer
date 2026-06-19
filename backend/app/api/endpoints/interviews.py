"""Interview management endpoints utilizing the repository and service patterns."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.interview import InterviewStatus
from app.repositories import (
    CandidateRepository,
    InterviewRepository,
    InterviewPlanRepository,
    QuestionRepository,
    EvaluationRepository,
)
from app.services.gemini import GeminiService
from app.agents import InterviewAgent, EvaluationAgent, ReportAgent
from app.services.interview import InterviewService

from app.schemas.interview import (
    InterviewCreate,
    InterviewResponse,
    InterviewDetailResponse,
    InterviewMessageRequest,
    InterviewMessageResponse,
    InterviewUpdate,
)
from app.schemas.report import ReportResponse, ReportUpdate

router = APIRouter()


async def get_interview_service(db: AsyncSession = Depends(get_db)) -> InterviewService:
    """Dependency injection helper for InterviewService."""
    interview_repo = InterviewRepository(db)
    candidate_repo = CandidateRepository(db)
    plan_repo = InterviewPlanRepository(db)
    question_repo = QuestionRepository(db)
    eval_repo = EvaluationRepository(db)
    
    gemini_service = GeminiService()
    
    interview_agent = InterviewAgent(gemini_service)
    eval_agent = EvaluationAgent(gemini_service)
    report_agent = ReportAgent(gemini_service)
    
    return InterviewService(
        db=db,
        interview_repo=interview_repo,
        candidate_repo=candidate_repo,
        plan_repo=plan_repo,
        question_repo=question_repo,
        eval_repo=eval_repo,
        interview_agent=interview_agent,
        eval_agent=eval_agent,
        report_agent=report_agent,
    )


@router.post("/", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    interview_data: InterviewCreate,
    service: InterviewService = Depends(get_interview_service),
):
    """Create a new interview record."""
    # Verify candidate exists
    candidate = await service.candidate_repo.get_by_id(interview_data.candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )

    return await service.create_interview(
        title=interview_data.title,
        job_description=interview_data.job_description,
        candidate_id=interview_data.candidate_id,
        interview_type=interview_data.interview_type,
        duration_minutes=interview_data.duration_minutes,
    )


@router.get("/", response_model=List[InterviewResponse])
async def list_interviews(
    skip: int = 0,
    limit: int = 50,
    status_filter: InterviewStatus | None = None,
    service: InterviewService = Depends(get_interview_service),
):
    """List all interviews with optional status filtering."""
    return await service.interview_repo.list(
        skip=skip, limit=limit, status_filter=status_filter
    )


@router.get("/{interview_id}", response_model=InterviewDetailResponse)
async def get_interview(
    interview_id: uuid.UUID,
    service: InterviewService = Depends(get_interview_service),
):
    """Get detailed interview information."""
    interview = await service.interview_repo.get_by_id(interview_id, load_relations=True)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found.",
        )
    # Dynamically inject current server time for frontend clock synchronization
    interview.server_time = datetime.now(timezone.utc)
    return interview


@router.post("/{interview_id}/start", response_model=InterviewMessageResponse)
async def start_interview(
    interview_id: uuid.UUID,
    interviewer_name: str = "Alex",
    service: InterviewService = Depends(get_interview_service),
):
    """Start an interview session, generate the plan, and fetch the opening question."""
    try:
        interview, first_question = await service.start_interview(interview_id, interviewer_name=interviewer_name)
        return InterviewMessageResponse(
            interview_id=interview.id,
            question_id=first_question.id,
            ai_message=first_question.question_text,
            section=first_question.section,
            is_follow_up=False,
            interview_progress=0.0,
            is_complete=False,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while starting the interview: {str(e)}",
        )


@router.post("/{interview_id}/message", response_model=InterviewMessageResponse)
async def send_message(
    interview_id: uuid.UUID,
    message: InterviewMessageRequest,
    service: InterviewService = Depends(get_interview_service),
):
    """Send a candidate's answer message and generate the next AI response."""
    try:
        interview, next_question, is_complete = await service.process_candidate_message(
            interview_id=interview_id,
            candidate_message=message.message,
        )

        progress = 100.0
        if not is_complete and interview.started_at:
            elapsed = (datetime.now(timezone.utc).replace(tzinfo=None) - interview.started_at).total_seconds()
            total = interview.duration_minutes * 60
            progress = min(99.0, (elapsed / total) * 100)

        return InterviewMessageResponse(
            interview_id=interview.id,
            question_id=next_question.id if next_question else uuid.uuid4(),
            ai_message=next_question.question_text if next_question else "Thank you. The interview is now complete. We are generating your feedback report.",
            section=next_question.section if next_question else "Wrap Up",
            is_follow_up=next_question.question_type == "follow_up" if next_question else False,
            interview_progress=progress,
            is_complete=is_complete,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during conversational processing: {str(e)}",
        )


@router.get("/{interview_id}/report", response_model=ReportResponse)
async def get_report(
    interview_id: uuid.UUID,
    service: InterviewService = Depends(get_interview_service),
):
    """Get the final assessment report scorecard for an interview, with dynamic fallback generation."""
    report = await service.eval_repo.get_report_by_interview_id(interview_id)
    if not report:
        # Check if the interview is completed or evaluating but missing a report
        interview = await service.interview_repo.get_by_id(interview_id, load_relations=True)
        if interview and (interview.status == InterviewStatus.COMPLETED or interview.status == InterviewStatus.EVALUATING):
            try:
                report = await service.generate_final_report(interview)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to dynamically generate scorecard report: {str(e)}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found. The interview may not be completed yet.",
            )
    return report


@router.put("/{interview_id}", response_model=InterviewDetailResponse)
async def update_interview(
    interview_id: uuid.UUID,
    update_data: InterviewUpdate,
    service: InterviewService = Depends(get_interview_service),
):
    """Update interview metadata details."""
    interview = await service.interview_repo.get_by_id(interview_id, load_relations=True)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found.",
        )
    
    update_dict = update_data.model_dump(exclude_unset=True)
    updated = await service.interview_repo.update(interview, update_dict)
    return updated


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: uuid.UUID,
    service: InterviewService = Depends(get_interview_service),
):
    """Delete an interview session and all cascade associated data (plans, reports, evaluations)."""
    interview = await service.interview_repo.get_by_id(interview_id, load_relations=False)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found.",
        )
    await service.interview_repo.delete(interview)


@router.put("/{interview_id}/report", response_model=ReportResponse)
async def update_report(
    interview_id: uuid.UUID,
    update_data: ReportUpdate,
    service: InterviewService = Depends(get_interview_service),
):
    """Update an interview's scorecard report metadata manually."""
    report = await service.eval_repo.get_report_by_interview_id(interview_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found. The interview may not be completed yet.",
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    updated = await service.eval_repo.update_report(report, update_dict)
    return updated


@router.delete("/{interview_id}/report", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    interview_id: uuid.UUID,
    service: InterviewService = Depends(get_interview_service),
):
    """Delete an interview's scorecard report."""
    report = await service.eval_repo.get_report_by_interview_id(interview_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    await service.eval_repo.delete_report(report)
