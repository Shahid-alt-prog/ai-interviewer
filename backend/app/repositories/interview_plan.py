"""Interview plan repository for managing interview structured plans and sections."""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview_plan import InterviewPlan, InterviewSection


class InterviewPlanRepository:
    """Repository for InterviewPlan and InterviewSection database access."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_plan(
        self,
        interview_id: uuid.UUID,
        sections_data: List[dict],
        plan_metadata: Optional[dict] = None,
    ) -> InterviewPlan:
        """Create a new interview plan and its sections."""
        # Setup topics from sections
        all_topics = []
        for sec in sections_data:
            all_topics.extend(sec.get("topics", []))

        plan = InterviewPlan(
            interview_id=interview_id,
            sections=sections_data,
            current_section_index=0,
            covered_topics=[],
            remaining_topics=all_topics,
            plan_metadata=plan_metadata or {},
        )
        self.db.add(plan)
        await self.db.flush()

        # Create section records
        for i, sec_data in enumerate(sections_data):
            section = InterviewSection(
                plan_id=plan.id,
                name=sec_data.get("name"),
                description=sec_data.get("description"),
                order=i,
                duration_minutes=sec_data.get("duration_minutes", 5),
                topics=sec_data.get("topics", []),
                questions_pool=sec_data.get("questions_pool", []),
                is_completed=False,
            )
            self.db.add(section)

        await self.db.flush()
        return plan

    async def get_plan_by_interview_id(self, interview_id: uuid.UUID) -> Optional[InterviewPlan]:
        """Retrieve the plan for a specific interview."""
        result = await self.db.execute(
            select(InterviewPlan).where(InterviewPlan.interview_id == interview_id)
        )
        return result.scalar_one_or_none()

    async def get_sections_by_plan_id(self, plan_id: uuid.UUID) -> List[InterviewSection]:
        """Retrieve all sections in a plan ordered by their sequence order."""
        result = await self.db.execute(
            select(InterviewSection)
            .where(InterviewSection.plan_id == plan_id)
            .order_by(InterviewSection.order)
        )
        return list(result.scalars().all())

    async def update_plan(self, plan: InterviewPlan, update_dict: dict) -> InterviewPlan:
        """Update plan fields."""
        for field, value in update_dict.items():
            setattr(plan, field, value)
        await self.db.flush()
        return plan

    async def mark_section_completed(self, plan_id: uuid.UUID, section_name: str) -> None:
        """Mark a specific section in a plan as completed."""
        result = await self.db.execute(
            select(InterviewSection)
            .where(InterviewSection.plan_id == plan_id, InterviewSection.name == section_name)
        )
        section = result.scalar_one_or_none()
        if section:
            section.is_completed = True
            await self.db.flush()
