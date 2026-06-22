"""Response evaluation agent using Google Gemini."""
import logging
from typing import Dict, Any

from app.core.config import settings
from app.prompts import load_prompt
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)


class EvaluationAgent:
    """Agent for evaluating candidate responses to specific interview questions."""

    def __init__(self, gemini_service: GeminiService):
        self.gemini = gemini_service

    async def evaluate_response(
        self,
        job_description: str,
        question_text: str,
        question_type: str,
        section_name: str,
        response_text: str,
    ) -> Dict[str, Any]:
        """Evaluate a single response using Gemini Pro."""
        prompt_template = load_prompt("evaluator")
        prompt = prompt_template.format(
            job_description=job_description,
            question_text=question_text,
            question_type=question_type,
            section_name=section_name,
            response_text=response_text,
        )
        
        system_instruction = "You are a professional hiring screening evaluator. Grade responses accurately and objectively."
        
        try:
            logger.info("Evaluating candidate response with Gemini Pro...")
            result = await self.gemini.generate_json(
                prompt=prompt,
                model_name=settings.GEMINI_PRO_MODEL,
                system_instruction=system_instruction,
            )
            return result
        except Exception as e:
            logger.error(f"Failed to evaluate response: {e}")
            # Return basic grading model on failure
            return {
                "score": 3,
                "confidence": 0.5,
                "technical_score": None,
                "communication_score": 3,
                "problem_solving_score": 3,
                "leadership_score": None,
                "domain_expertise_score": None,
                "strengths": ["Completed response"],
                "weaknesses": ["Unable to fully analyze response due to system error"],
                "follow_up_needed": False,
                "follow_up_reason": None,
                "evaluation_reasoning": "System fallback evaluation"
            }
