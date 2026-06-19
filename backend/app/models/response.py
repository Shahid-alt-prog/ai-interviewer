"""Response database model."""
import uuid
from datetime import datetime

from sqlalchemy import Text, DateTime, Float, ForeignKey, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Response(Base):
    """Represents a candidate's response to a question."""
    __tablename__ = "responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_duration_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    sentiment: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_topics: Mapped[list | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    responded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    question: Mapped["Question"] = relationship(
        "Question", back_populates="response"
    )
    evaluation: Mapped["Evaluation | None"] = relationship(
        "Evaluation", back_populates="response", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Response(id={self.id}, question_id={self.question_id})>"
