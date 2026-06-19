"""Interview-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.interview import InterviewStatus, InterviewType, InterviewDifficulty


class InterviewCreate(BaseModel):
    """Schema for creating a new interview."""
    candidate_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    job_description: str = Field(..., min_length=10)
    interview_type: InterviewType = InterviewType.GENERAL_SCREENING
    difficulty: InterviewDifficulty = InterviewDifficulty.MEDIUM
    duration_minutes: int = Field(default=30, ge=5, le=90)


class InterviewResponse(BaseModel):
    """Schema for interview list responses."""
    id: uuid.UUID
    candidate_id: uuid.UUID
    title: str
    interview_type: InterviewType
    difficulty: InterviewDifficulty
    status: InterviewStatus
    duration_minutes: int
    current_section: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InterviewDetailResponse(InterviewResponse):
    """Schema for detailed interview responses."""
    job_description: str
    covered_topics: Optional[list[str]] = None
    conversation_history: Optional[list[dict]] = None
    server_time: Optional[datetime] = None


class InterviewMessageRequest(BaseModel):
    """Schema for sending a message during an interview."""
    message: str = Field(..., min_length=1)


class InterviewMessageResponse(BaseModel):
    """Schema for interview message responses."""
    interview_id: uuid.UUID
    question_id: uuid.UUID
    ai_message: str
    section: str
    is_follow_up: bool = False
    interview_progress: float = Field(..., ge=0, le=100)
    is_complete: bool = False


class InterviewUpdate(BaseModel):
    """Schema for updating an interview's metadata."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    job_description: Optional[str] = Field(None, min_length=10)
    interview_type: Optional[InterviewType] = None
    difficulty: Optional[InterviewDifficulty] = None
    duration_minutes: Optional[int] = Field(None, ge=5, le=90)
    status: Optional[InterviewStatus] = None
