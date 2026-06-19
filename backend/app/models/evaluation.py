"""Evaluation database model."""
import uuid
from datetime import datetime

from sqlalchemy import Text, DateTime, Float, Integer, Boolean, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Evaluation(Base):
    """AI-generated evaluation of a candidate's response."""
    __tablename__ = "evaluations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("responses.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    technical_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    communication_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    problem_solving_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    leadership_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    domain_expertise_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    follow_up_needed: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_ai_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    response: Mapped["Response"] = relationship(
        "Response", back_populates="evaluation"
    )

    def __repr__(self) -> str:
        return f"<Evaluation(id={self.id}, score={self.score}, confidence={self.confidence})>"
