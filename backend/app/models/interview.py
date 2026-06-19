"""Interview database model."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Enum, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class InterviewStatus(str, enum.Enum):
    """Interview lifecycle states."""
    CREATED = "created"
    PLANNING = "planning"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EVALUATING = "evaluating"


class InterviewType(str, enum.Enum):
    """Supported interview types."""
    GENERAL_SCREENING = "general_screening"
    TECHNICAL_ROUND = "technical_round"
    MANAGER_OPS_ROUND = "manager_ops_round"


class Interview(Base):
    """Represents a single interview session."""
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    interview_type: Mapped[InterviewType] = mapped_column(
        Enum(InterviewType), nullable=False, default=InterviewType.GENERAL_SCREENING
    )
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(InterviewStatus), nullable=False, default=InterviewStatus.CREATED
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    current_section: Mapped[str | None] = mapped_column(String(100), nullable=True)
    conversation_history: Mapped[list | None] = mapped_column(JSON, nullable=True)
    covered_topics: Mapped[list | None] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    candidate: Mapped["Candidate"] = relationship(
        "Candidate", back_populates="interviews"
    )
    plan: Mapped["InterviewPlan | None"] = relationship(
        "InterviewPlan", back_populates="interview", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    questions: Mapped[list["Question"]] = relationship(
        "Question", back_populates="interview", cascade="all, delete-orphan",
        order_by="Question.sequence_number", passive_deletes=True
    )
    report: Mapped["Report | None"] = relationship(
        "Report", back_populates="interview", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Interview(id={self.id}, type='{self.interview_type}', status='{self.status}')>"
