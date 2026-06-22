"""Question and Response repository for managing interview Q&A records."""
import uuid
from datetime import datetime, timezone
from app.core.config import IST
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.question import Question
from app.models.response import Response


class QuestionRepository:
    """Repository for Question and Response database access."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_question(
        self,
        interview_id: uuid.UUID,
        section: str,
        question_text: str,
        question_type: str = "primary",
        parent_question_id: Optional[uuid.UUID] = None,
        sequence_number: int = 1,
        follow_up_depth: int = 0,
        intent: Optional[str] = None,
        expected_topics: Optional[List[str]] = None,
        embedding: Optional[List[float]] = None,
    ) -> Question:
        """Record a question asked to the candidate."""
        question = Question(
            interview_id=interview_id,
            section=section,
            question_text=question_text,
            question_type=question_type,
            parent_question_id=parent_question_id,
            sequence_number=sequence_number,
            follow_up_depth=follow_up_depth,
            intent=intent,
            expected_topics=expected_topics or [],
            embedding=embedding,
            asked_at=datetime.now(IST).replace(tzinfo=None),
        )
        self.db.add(question)
        await self.db.flush()
        return question

    async def get_question_by_id(self, question_id: uuid.UUID) -> Optional[Question]:
        """Retrieve a question by ID."""
        result = await self.db.execute(
            select(Question)
            .where(Question.id == question_id)
            .options(selectinload(Question.response))
        )
        return result.scalar_one_or_none()

    async def get_latest_question(self, interview_id: uuid.UUID) -> Optional[Question]:
        """Get the latest question asked during an interview (highest sequence number)."""
        result = await self.db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.sequence_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_questions_for_interview(self, interview_id: uuid.UUID) -> List[Question]:
        """Get all questions asked during an interview ordered by sequence number."""
        result = await self.db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.sequence_number)
            .options(selectinload(Question.response).selectinload(Response.evaluation))
        )
        return list(result.scalars().all())

    async def create_response(
        self,
        question_id: uuid.UUID,
        response_text: str,
        duration_seconds: Optional[float] = None,
        sentiment: Optional[str] = None,
        key_topics: Optional[List[str]] = None,
        embedding: Optional[List[float]] = None,
    ) -> Response:
        """Record the candidate's response to a question."""
        response = Response(
            question_id=question_id,
            response_text=response_text,
            response_duration_seconds=duration_seconds,
            sentiment=sentiment,
            key_topics=key_topics or [],
            embedding=embedding,
            responded_at=datetime.now(IST).replace(tzinfo=None),
        )
        self.db.add(response)
        await self.db.flush()
        return response

    async def get_response_by_question_id(self, question_id: uuid.UUID) -> Optional[Response]:
        """Retrieve a response for a specific question."""
        result = await self.db.execute(
            select(Response).where(Response.question_id == question_id)
        )
        return result.scalar_one_or_none()
