"""Report database model."""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Float, Integer, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Report(Base):
    """Final assessment report for a completed interview."""
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    technical_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_solving_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    leadership_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    domain_expertise_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # Proceed, Hold, Reject
    recommendation_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    detailed_feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    section_scores: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_ai_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    interview: Mapped["Interview"] = relationship(
        "Interview", back_populates="report"
    )

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, score={self.overall_score}, rec='{self.recommendation}')>"
