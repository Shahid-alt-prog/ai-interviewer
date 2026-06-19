"""Evaluation-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EvaluationResponse(BaseModel):
    """Schema for evaluation API responses."""
    id: uuid.UUID
    response_id: uuid.UUID
    score: int = Field(..., ge=1, le=10)
    confidence: float = Field(..., ge=0, le=1)
    technical_score: Optional[int] = None
    communication_score: Optional[int] = None
    problem_solving_score: Optional[int] = None
    leadership_score: Optional[int] = None
    domain_expertise_score: Optional[int] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    follow_up_needed: bool = False
    follow_up_reason: Optional[str] = None
    evaluated_at: datetime

    model_config = {"from_attributes": True}
