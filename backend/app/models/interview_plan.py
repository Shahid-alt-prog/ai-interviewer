"""Interview plan database model."""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Boolean, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class InterviewPlan(Base):
    """Structured plan for conducting an interview."""
    __tablename__ = "interview_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    sections: Mapped[list] = mapped_column(JSON, nullable=False)
    current_section_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    covered_topics: Mapped[list] = mapped_column(JSON, default=list)
    remaining_topics: Mapped[list] = mapped_column(JSON, default=list)
    plan_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    interview: Mapped["Interview"] = relationship(
        "Interview", back_populates="plan"
    )

    def __repr__(self) -> str:
        return f"<InterviewPlan(id={self.id}, interview_id={self.interview_id})>"


class InterviewSection(Base):
    """Individual section within an interview plan."""
    __tablename__ = "interview_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interview_plans.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    topics: Mapped[list] = mapped_column(JSON, default=list)
    questions_pool: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<InterviewSection(id={self.id}, name='{self.name}', order={self.order})>"
