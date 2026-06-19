"""Interview repository for handling interview database operations."""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.interview import Interview, InterviewStatus
from app.schemas.interview import InterviewCreate


class InterviewRepository:
    """Repository for Interview database access."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, schema: InterviewCreate) -> Interview:
        """Create a new interview in the database."""
        interview = Interview(
            candidate_id=schema.candidate_id,
            title=schema.title,
            job_description=schema.job_description,
            interview_type=schema.interview_type,
            difficulty=schema.difficulty,
            duration_minutes=schema.duration_minutes,
            status=InterviewStatus.CREATED,
            conversation_history=[],
            covered_topics=[],
        )
        self.db.add(interview)
        await self.db.flush()
        return interview

    async def get_by_id(self, interview_id: uuid.UUID, load_relations: bool = True) -> Optional[Interview]:
        """Retrieve an interview by ID with optional relations."""
        query = select(Interview).where(Interview.id == interview_id)
        if load_relations:
            query = query.options(
                selectinload(Interview.candidate),
                selectinload(Interview.plan),
                selectinload(Interview.questions),
                selectinload(Interview.report),
            )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        skip: int = 0,
        limit: int = 50,
        status_filter: Optional[InterviewStatus] = None,
        candidate_id: Optional[uuid.UUID] = None,
    ) -> List[Interview]:
        """List interviews with optional status and candidate filters."""
        query = select(Interview).order_by(Interview.created_at.desc())
        
        if status_filter:
            query = query.where(Interview.status == status_filter)
        if candidate_id:
            query = query.where(Interview.candidate_id == candidate_id)
            
        result = await self.db.execute(query.offset(skip).limit(limit))
        return list(result.scalars().all())

    async def update(self, interview: Interview, update_dict: dict) -> Interview:
        """Update interview fields with dictionary values."""
        for field, value in update_dict.items():
            setattr(interview, field, value)
        await self.db.flush()
        return interview

    async def delete(self, interview: Interview) -> None:
        """Delete an interview."""
        await self.db.delete(interview)
        await self.db.flush()
