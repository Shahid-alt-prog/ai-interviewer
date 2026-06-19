"""Candidate repository for handling candidate database operations."""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate


class CandidateRepository:
    """Repository for Candidate database access."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, schema: CandidateCreate) -> Candidate:
        """Create a new candidate in the database."""
        candidate = Candidate(
            name=schema.name,
            email=schema.email,
            phone=schema.phone,
        )
        self.db.add(candidate)
        await self.db.flush()
        return candidate

    async def get_by_id(self, candidate_id: uuid.UUID) -> Optional[Candidate]:
        """Retrieve a candidate by ID."""
        result = await self.db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[Candidate]:
        """Retrieve a candidate by email."""
        result = await self.db.execute(
            select(Candidate).where(Candidate.email == email)
        )
        return result.scalar_one_or_none()

    async def list(self, skip: int = 0, limit: int = 50) -> List[Candidate]:
        """List candidates with pagination."""
        result = await self.db.execute(
            select(Candidate)
            .order_by(Candidate.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update(self, candidate: Candidate, schema: CandidateUpdate) -> Candidate:
        """Update candidate details."""
        update_data = schema.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(candidate, field, value)
        await self.db.flush()
        return candidate

    async def update_resume(
        self,
        candidate: Candidate,
        resume_text: str,
        resume_file_path: str,
        parsed_resume: dict,
    ) -> Candidate:
        """Update candidate's parsed resume information."""
        candidate.resume_text = resume_text
        candidate.resume_file_path = resume_file_path
        candidate.parsed_resume = parsed_resume
        
        # Populate individual JSON fields for ease of querying
        candidate.skills = parsed_resume.get("skills", [])
        candidate.experience = parsed_resume.get("experience", [])
        candidate.education = parsed_resume.get("education", [])
        candidate.projects = parsed_resume.get("projects", [])
        candidate.certifications = parsed_resume.get("certifications", [])
        
        await self.db.flush()
        return candidate

    async def delete(self, candidate: Candidate) -> None:
        """Delete a candidate."""
        await self.db.delete(candidate)
        await self.db.flush()
