"""Candidate-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ParsedResume(BaseModel):
    """Structured resume data extracted by AI."""
    skills: list[str] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    education: list[dict] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class CandidateCreate(BaseModel):
    """Schema for creating a new candidate."""
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class CandidateUpdate(BaseModel):
    """Schema for updating candidate information."""
    name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class CandidateResponse(BaseModel):
    """Schema for candidate API responses."""
    id: uuid.UUID
    name: str
    email: str
    phone: Optional[str] = None
    resume_file_path: Optional[str] = None
    parsed_resume: Optional[ParsedResume] = None
    skills: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
