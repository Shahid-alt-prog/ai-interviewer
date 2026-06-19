"""Evaluation and Report repository for managing scores, feedback, and final assessments."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.evaluation import Evaluation
from app.models.report import Report


class EvaluationRepository:
    """Repository for Evaluation and Report database access."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_evaluation(
        self,
        response_id: uuid.UUID,
        score: int,
        confidence: float,
        technical_score: Optional[int] = None,
        communication_score: Optional[int] = None,
        problem_solving_score: Optional[int] = None,
        leadership_score: Optional[int] = None,
        domain_expertise_score: Optional[int] = None,
        strengths: Optional[list] = None,
        weaknesses: Optional[list] = None,
        follow_up_needed: bool = False,
        follow_up_reason: Optional[str] = None,
        evaluation_reasoning: Optional[str] = None,
        raw_ai_response: Optional[dict] = None,
    ) -> Evaluation:
        """Create a new response evaluation record."""
        evaluation = Evaluation(
            response_id=response_id,
            score=score,
            confidence=confidence,
            technical_score=technical_score,
            communication_score=communication_score,
            problem_solving_score=problem_solving_score,
            leadership_score=leadership_score,
            domain_expertise_score=domain_expertise_score,
            strengths=strengths or [],
            weaknesses=weaknesses or [],
            follow_up_needed=follow_up_needed,
            follow_up_reason=follow_up_reason,
            evaluation_reasoning=evaluation_reasoning,
            raw_ai_response=raw_ai_response,
            evaluated_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        self.db.add(evaluation)
        await self.db.flush()
        return evaluation

    async def get_evaluation_by_response_id(self, response_id: uuid.UUID) -> Optional[Evaluation]:
        """Retrieve evaluation details for a specific response."""
        result = await self.db.execute(
            select(Evaluation).where(Evaluation.response_id == response_id)
        )
        return result.scalar_one_or_none()

    async def create_report(
        self,
        interview_id: uuid.UUID,
        overall_score: float,
        technical_rating: int,
        communication_rating: int,
        problem_solving_rating: int,
        leadership_rating: int,
        domain_expertise_rating: Optional[int] = None,
        strengths: Optional[list] = None,
        weaknesses: Optional[list] = None,
        recommendation: str = "Hold",
        recommendation_reasoning: str = "",
        summary: str = "",
        detailed_feedback: Optional[dict] = None,
        section_scores: Optional[dict] = None,
        raw_ai_response: Optional[dict] = None,
    ) -> Report:
        """Create a final interview assessment report."""
        report = Report(
            interview_id=interview_id,
            overall_score=overall_score,
            technical_rating=technical_rating,
            communication_rating=communication_rating,
            problem_solving_rating=problem_solving_rating,
            leadership_rating=leadership_rating,
            domain_expertise_rating=domain_expertise_rating,
            strengths=strengths or [],
            weaknesses=weaknesses or [],
            recommendation=recommendation,
            recommendation_reasoning=recommendation_reasoning,
            summary=summary,
            detailed_feedback=detailed_feedback or {},
            section_scores=section_scores or {},
            raw_ai_response=raw_ai_response,
            generated_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        self.db.add(report)
        await self.db.flush()
        return report

    async def get_report_by_interview_id(self, interview_id: uuid.UUID) -> Optional[Report]:
        """Retrieve the final report for an interview."""
        result = await self.db.execute(
            select(Report).where(Report.interview_id == interview_id)
        )
        return result.scalar_one_or_none()

    async def update_report(
        self,
        report: Report,
        update_dict: dict,
    ) -> Report:
        """Update report fields."""
        for field, value in update_dict.items():
            setattr(report, field, value)
        await self.db.flush()
        return report

    async def delete_report(self, report: Report) -> None:
        """Delete a scorecard report."""
        await self.db.delete(report)
        await self.db.flush()
