"""Interview scorecard and report generation agent using Google Gemini."""
import logging
from typing import Dict, Any, List

from app.core.config import settings
from app.prompts import load_prompt
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)


class ReportAgent:
    """Agent for generating a final candidate assessment report."""

    def __init__(self, gemini_service: GeminiService):
        self.gemini = gemini_service

    async def generate_report(
        self,
        job_description: str,
        candidate_name: str,
        skills: List[str],
        experience: List[Dict[str, Any]],
        qa_history: List[Dict[str, Any]],
        conversation_history: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Synthesize evaluations and compile the final candidate assessment report."""
        prompt_template = load_prompt("report_generator")
        
        # Format candidate summary
        skills_str = ", ".join(skills) if skills else "Not specified"
        exp_list = []
        for exp in (experience or []):
            role = exp.get("role", "N/A")
            company = exp.get("company", "N/A")
            exp_list.append(f"{role} at {company}")
        exp_summary = "; ".join(exp_list) if exp_list else "Not specified"
        
        # Format Q&A transcript along with evaluation details
        transcript_parts = []
        for i, qa in enumerate(qa_history):
            question = qa.get("question", "")
            response = qa.get("response", "")
            eval_data = qa.get("evaluation", {})
            
            transcript_parts.append(
                f"Turn {i+1}:\n"
                f"Q: {question}\n"
                f"A: {response}\n"
                f"Evaluation: Score={eval_data.get('score')}/5, Confidence={eval_data.get('confidence')}\n"
                f"Feedback: Strengths={eval_data.get('strengths')}, Weaknesses={eval_data.get('weaknesses')}\n"
                f"Reasoning: {eval_data.get('evaluation_reasoning')}\n"
                f"----------------------------------------"
            )
        qa_transcript_evaluations = "\n".join(transcript_parts)

        # Format full chronological conversation transcript
        convo_parts = []
        for entry in (conversation_history or []):
            role = entry.get("role", "unknown").capitalize()
            text_val = entry.get("text") or entry.get("content") or ""
            convo_parts.append(f"{role}: {text_val}")
        full_transcript = "\n".join(convo_parts) if convo_parts else "No direct conversation history recorded."
        
        prompt = prompt_template.format(
            job_description=job_description,
            candidate_name=candidate_name,
            skills=skills_str,
            experience_summary=exp_summary,
            qa_transcript_evaluations=qa_transcript_evaluations,
            full_transcript=full_transcript,
        )
        
        system_instruction = "You are a senior HR decision panel director. Synthesize interview logs into clear scorecard recommendations."
        
        try:
            logger.info("Generating final candidate interview report with Gemini Pro...")
            result = await self.gemini.generate_json(
                prompt=prompt,
                model_name=settings.GEMINI_PRO_MODEL,
                system_instruction=system_instruction,
            )
            return result
        except Exception as e:
            logger.error(f"Failed to generate candidate report: {e}")
            # Fallback report structure
            return {
                "overall_score": 3.0,
                "technical_rating": 3,
                "communication_rating": 3,
                "problem_solving_rating": 3,
                "leadership_rating": 3,
                "domain_expertise_rating": None,
                "strengths": ["Completed the interview session"],
                "weaknesses": ["System failed to fully evaluate responses in final report"],
                "recommendation": "Hold",
                "recommendation_reasoning": "Fallback report generated due to a processing error.",
                "summary": "The candidate has completed the interview but a system error prevented detailed synthesis.",
                "section_scores": {},
                "detailed_feedback": {}
            }
