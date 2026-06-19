"""Resume service for parsing and handling candidate resume files."""
import io
import os
import uuid
import logging
from typing import Optional

import pypdf

from app.models.candidate import Candidate
from app.repositories.candidate import CandidateRepository
from app.agents.resume import ResumeAgent
from app.core.config import settings

logger = logging.getLogger(__name__)


class ResumeService:
    """Service for handling candidate resumes: parsing PDFs and running AI analysis."""

    def __init__(
        self,
        candidate_repository: CandidateRepository,
        resume_agent: ResumeAgent,
    ):
        self.candidate_repo = candidate_repository
        self.resume_agent = resume_agent

    def sanitize_file_name(self, file_name: str) -> str:
        """Return a path-safe PDF filename for local storage."""
        normalized = os.path.basename(file_name.replace("\\", "/")).strip()
        if not normalized:
            normalized = "resume.pdf"
        if not normalized.lower().endswith(".pdf"):
            normalized = f"{normalized}.pdf"
        return normalized

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract plain text from PDF file bytes using pypdf."""
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(pdf_file)
            text = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
            return "\n".join(text)
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")

    async def parse_and_update_candidate(
        self,
        candidate_id: uuid.UUID,
        file_name: str,
        file_bytes: bytes,
    ) -> Optional[Candidate]:
        """Process candidate resume upload, run AI parser, and update candidate profile."""
        candidate = await self.candidate_repo.get_by_id(candidate_id)
        if not candidate:
            return None

        if len(file_bytes) > settings.MAX_RESUME_UPLOAD_BYTES:
            max_mb = settings.MAX_RESUME_UPLOAD_BYTES / (1024 * 1024)
            raise ValueError(
                f"Resume file is too large. Maximum size is {max_mb:.1f} MB."
            )

        # 1. Extract raw text from the uploaded PDF
        logger.info(f"Extracting text from resume PDF for candidate {candidate_id}")
        raw_text = self.extract_text_from_pdf(file_bytes)

        # 2. Ask ResumeAgent to structure it using Gemini
        logger.info(f"Invoking ResumeAgent for candidate {candidate_id}")
        parsed_resume_json = await self.resume_agent.parse(raw_text)

        # 3. Save resume file to local uploads directory
        safe_file_name = self.sanitize_file_name(file_name)
        upload_dir = os.path.join(settings.UPLOAD_DIR, str(candidate_id))
        os.makedirs(upload_dir, exist_ok=True)
        disk_file_path = os.path.join(upload_dir, safe_file_name)
        try:
            with open(disk_file_path, "wb") as f:
                f.write(file_bytes)
            # Use forward slash for database path URL
            db_file_path = f"{settings.UPLOAD_DIR}/{candidate_id}/{safe_file_name}"
        except Exception as e:
            logger.error(f"Failed to write uploaded resume file to disk: {e}")
            raise ValueError("Failed to store resume file.") from e

        # 4. Save to candidate database record
        logger.info(f"Updating candidate database record for candidate {candidate_id}")
        updated_candidate = await self.candidate_repo.update_resume(
            candidate=candidate,
            resume_text=raw_text,
            resume_file_path=db_file_path,
            parsed_resume=parsed_resume_json,
        )

        return updated_candidate
