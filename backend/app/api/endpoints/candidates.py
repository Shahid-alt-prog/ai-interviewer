"""Candidate management endpoints using Clean Architecture repositories and services."""
import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.repositories.candidate import CandidateRepository
from app.services.gemini import GeminiService
from app.agents.resume import ResumeAgent
from app.services.resume import ResumeService
from app.schemas.candidate import CandidateCreate, CandidateResponse, CandidateUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_candidate_repo(db: AsyncSession = Depends(get_db)) -> CandidateRepository:
    """Dependency injection helper for CandidateRepository."""
    return CandidateRepository(db)


async def get_resume_service(db: AsyncSession = Depends(get_db)) -> ResumeService:
    """Dependency injection helper for ResumeService."""
    repo = CandidateRepository(db)
    gemini = GeminiService()
    agent = ResumeAgent(gemini)
    return ResumeService(repo, agent)


@router.post("/", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    candidate_data: CandidateCreate,
    repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Create a new candidate in the system."""
    existing = await repo.get_by_email(candidate_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Candidate with email '{candidate_data.email}' already exists.",
        )
    return await repo.create(candidate_data)


@router.get("/", response_model=List[CandidateResponse])
async def list_candidates(
    skip: int = 0,
    limit: int = 50,
    repo: CandidateRepository = Depends(get_candidate_repo),
):
    """List all candidates with pagination."""
    return await repo.list(skip=skip, limit=limit)


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: uuid.UUID,
    repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Get candidate information by ID."""
    candidate = await repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )
    return candidate


@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: uuid.UUID,
    update_data: CandidateUpdate,
    repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Update candidate information."""
    candidate = await repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )
    
    if update_data.email and update_data.email != candidate.email:
        existing = await repo.get_by_email(update_data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate with email '{update_data.email}' already exists.",
            )

    return await repo.update(candidate, update_data)


@router.post("/{candidate_id}/resume", response_model=CandidateResponse)
async def upload_resume(
    candidate_id: uuid.UUID,
    file: UploadFile = File(...),
    resume_service: ResumeService = Depends(get_resume_service),
):
    """Upload candidate resume PDF and trigger Gemini-based parsing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted.",
        )

    if file.size and file.size > settings.MAX_RESUME_UPLOAD_BYTES:
        logger.warning(f"Upload rejected: {file.filename} size ({file.size} bytes) exceeds limit.")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume file is too large.",
        )

    try:
        content = await file.read()
        if len(content) > settings.MAX_RESUME_UPLOAD_BYTES:
            logger.warning(f"Upload rejected after reading: {file.filename} exceeds limit.")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Resume file is too large.",
            )
        updated_candidate = await resume_service.parse_and_update_candidate(
            candidate_id=candidate_id,
            file_name=file.filename,
            file_bytes=content,
        )
        if not updated_candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )
        return updated_candidate
    except ValueError as e:
        logger.error(f"Validation error parsing resume for candidate {candidate_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Unexpected error parsing resume for candidate {candidate_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while parsing the resume: {str(e)}",
        )


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    repo: CandidateRepository = Depends(get_candidate_repo),
):
    """Delete candidate and automatically cascade delete their interviews, plans, and reports."""
    candidate = await repo.get_by_id(candidate_id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found.",
        )
    await repo.delete(candidate)
