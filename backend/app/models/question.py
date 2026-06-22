"""Question database model."""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Question(Base):
    """Represents a question asked during an interview."""
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section: Mapped[str] = mapped_column(String(100), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="primary"
    )  # primary, follow_up, clarification
    parent_question_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=True
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    follow_up_depth: Mapped[int] = mapped_column(Integer, default=0)
    intent: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_topics: Mapped[list | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    asked_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    interview: Mapped["Interview"] = relationship(
        "Interview", back_populates="questions"
    )
    response: Mapped["Response | None"] = relationship(
        "Response", back_populates="question", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    parent_question: Mapped["Question | None"] = relationship(
        "Question", remote_side="Question.id", backref="follow_ups"
    )

    def __repr__(self) -> str:
        return f"<Question(id={self.id}, type='{self.question_type}', seq={self.sequence_number})>"
