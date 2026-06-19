"""Report-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReportResponse(BaseModel):
    """Schema for report API responses."""
    id: uuid.UUID
    interview_id: uuid.UUID
    overall_score: float = Field(..., ge=0, le=10)
    technical_rating: int = Field(..., ge=1, le=10)
    communication_rating: int = Field(..., ge=1, le=10)
    problem_solving_rating: int = Field(..., ge=1, le=10)
    leadership_rating: int = Field(..., ge=1, le=10)
    domain_expertise_rating: Optional[int] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommendation: str
    recommendation_reasoning: str
    summary: str
    detailed_feedback: Optional[dict] = None
    section_scores: Optional[dict] = None
    generated_at: datetime

    model_config = {"from_attributes": True}


class ReportUpdate(BaseModel):
    """Schema for updating a report's scorecard manually."""
    overall_score: Optional[float] = Field(None, ge=0, le=10)
    technical_rating: Optional[int] = Field(None, ge=1, le=10)
    communication_rating: Optional[int] = Field(None, ge=1, le=10)
    problem_solving_rating: Optional[int] = Field(None, ge=1, le=10)
    leadership_rating: Optional[int] = Field(None, ge=1, le=10)
    domain_expertise_rating: Optional[int] = Field(None, ge=1, le=10)
    strengths: Optional[list[str]] = None
    weaknesses: Optional[list[str]] = None
    recommendation: Optional[str] = None
    recommendation_reasoning: Optional[str] = None
    summary: Optional[str] = None
