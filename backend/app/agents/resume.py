"""Resume parsing agent using Google Gemini."""
import logging
from typing import Dict, Any

from app.core.config import settings
from app.prompts import load_prompt
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)


class ResumeAgent:
    """Agent for parsing resume text into structured candidate profile data."""

    def __init__(self, gemini_service: GeminiService):
        self.gemini = gemini_service

    async def parse(self, resume_text: str) -> Dict[str, Any]:
        """Parse resume raw text and return structured JSON."""
        prompt_template = load_prompt("resume_parser")
        prompt = prompt_template.format(resume_text=resume_text)
        
        system_instruction = "You are a professional recruiting parser. Convert candidate resumes into structured JSON."
        
        try:
            logger.info("Parsing resume text with Gemini Pro...")
            result = await self.gemini.generate_json(
                prompt=prompt,
                model_name=settings.GEMINI_PRO_MODEL,
                system_instruction=system_instruction,
            )
            # Ensure the structured fields exist even if the model omitted them
            return {
                "skills": result.get("skills", []),
                "experience": result.get("experience", []),
                "projects": result.get("projects", []),
                "education": result.get("education", []),
                "certifications": result.get("certifications", []),
            }
        except Exception as e:
            logger.error(f"Failed to parse resume text: {e}")
            # Return basic schema structure on failure
            return {
                "skills": [],
                "experience": [],
                "projects": [],
                "education": [],
                "certifications": [],
            }
