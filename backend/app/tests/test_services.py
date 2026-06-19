"""Unit tests for ResumeService and InterviewService with mocked AI agents."""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewStatus
from app.models.interview_plan import InterviewPlan
from app.models.question import Question
from app.repositories import (
    CandidateRepository,
    InterviewRepository,
    InterviewPlanRepository,
    QuestionRepository,
    EvaluationRepository,
)
from app.services.resume import ResumeService
from app.services.interview import InterviewService
from app.services.gemini import GeminiService


@pytest.mark.asyncio
async def test_resume_service_parse(db_session: AsyncSession):
    """Test ResumeService parses PDF and updates candidate information using mocked agents."""
    # 1. Setup repository and service
    candidate_repo = CandidateRepository(db_session)
    
    # Create test candidate
    candidate = Candidate(
        name="Mock Candidate",
        email="mock@resume.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    # Create mock ResumeAgent
    mock_resume_agent = MagicMock()
    mock_resume_agent.parse = AsyncMock(return_value={
        "skills": ["Python", "FastAPI", "SQLAlchemy"],
        "experience": [{"role": "Backend dev", "company": "Tech Corp", "duration": "2 years", "description": "built APIs"}],
        "projects": [],
        "education": [],
        "certifications": []
    })

    service = ResumeService(candidate_repo, mock_resume_agent)

    # 2. Patch the PDF extraction so it doesn't fail on dummy bytes
    with patch.object(service, "extract_text_from_pdf", return_value="dummy resume text"):
        updated_candidate = await service.parse_and_update_candidate(
            candidate_id=candidate.id,
            file_name="resume.pdf",
            file_bytes=b"dummy pdf bytes"
        )

    # 3. Assertions
    assert updated_candidate is not None
    assert updated_candidate.id == candidate.id
    assert updated_candidate.resume_text == "dummy resume text"
    assert updated_candidate.resume_file_path == f"uploads/{candidate.id}/resume.pdf"
    assert updated_candidate.skills == ["Python", "FastAPI", "SQLAlchemy"]
    assert len(updated_candidate.experience) == 1
    assert updated_candidate.experience[0]["role"] == "Backend dev"


@pytest.mark.asyncio
async def test_resume_service_sanitizes_uploaded_filename(db_session: AsyncSession):
    """Uploaded resume names must not be able to escape the candidate upload folder."""
    candidate_repo = CandidateRepository(db_session)
    candidate = Candidate(name="Path Safe", email="safe@resume.com")
    db_session.add(candidate)
    await db_session.flush()

    mock_resume_agent = MagicMock()
    mock_resume_agent.parse = AsyncMock(return_value={
        "skills": [],
        "experience": [],
        "projects": [],
        "education": [],
        "certifications": [],
    })

    service = ResumeService(candidate_repo, mock_resume_agent)

    with patch.object(service, "extract_text_from_pdf", return_value="resume"):
        updated_candidate = await service.parse_and_update_candidate(
            candidate_id=candidate.id,
            file_name="..\\..\\evil.pdf",
            file_bytes=b"dummy pdf bytes",
        )

    assert updated_candidate is not None
    assert updated_candidate.resume_file_path == f"uploads/{candidate.id}/evil.pdf"


def test_gemini_service_has_no_hardcoded_api_key(monkeypatch):
    """The AI service must not ship with a source-code API key fallback."""
    monkeypatch.setattr("app.services.gemini.settings.GROQ_API_KEY", "")
    monkeypatch.setattr("app.services.gemini.settings.GEMINI_API_KEY", "")

    service = GeminiService()

    assert service.api_key == ""


def test_gemini_service_ignores_placeholder_api_keys(monkeypatch):
    """Documented placeholder values must not trigger real external retries."""
    monkeypatch.setattr("app.services.gemini.settings.GROQ_API_KEY", "")
    monkeypatch.setattr("app.services.gemini.settings.GEMINI_API_KEY", "your-gemini-api-key")

    service = GeminiService()

    assert service.api_key == ""


@pytest.mark.asyncio
async def test_interview_service_start_and_message(db_session: AsyncSession):
    """Test starting an interview and processing candidate messages with mocked Gemini interactions."""
    # 1. Setup repositories
    candidate_repo = CandidateRepository(db_session)
    interview_repo = InterviewRepository(db_session)
    plan_repo = InterviewPlanRepository(db_session)
    question_repo = QuestionRepository(db_session)
    eval_repo = EvaluationRepository(db_session)

    # Create candidate and interview
    candidate = Candidate(
        name="Alex Smith",
        email="alex@interviewee.com",
        skills=["Python", "PostgreSQL"],
        experience=[{"role": "Developer", "company": "Startup"}]
    )
    db_session.add(candidate)
    await db_session.flush()

    interview = Interview(
        candidate_id=candidate.id,
        title="Python Dev",
        job_description="Need a developer with python knowledge",
        interview_type="technical_round",
        duration_minutes=30,
        status=InterviewStatus.CREATED,
    )
    db_session.add(interview)
    await db_session.flush()

    # 2. Setup mock agents
    mock_interview_agent = MagicMock()
    mock_interview_agent.generate_plan = AsyncMock(return_value={
        "sections": [
            {
                "name": "Introduction",
                "description": "Greeting",
                "duration_minutes": 5,
                "topics": ["Resume intro"],
                "questions_pool": ["Tell me about your career"]
            },
            {
                "name": "Technical Screen",
                "description": "Python evaluation",
                "duration_minutes": 20,
                "topics": ["Decorators"],
                "questions_pool": ["Explain Python decorators"]
            }
        ]
    })
    
    mock_interview_agent.generate_next_message = AsyncMock(return_value={
        "ai_message": "Tell me about decorators in Python.",
        "intent": "primary_question",
        "is_follow_up": False,
        "section": "Technical Screen",
        "is_complete": False
    })

    mock_eval_agent = MagicMock()
    mock_eval_agent.evaluate_response = AsyncMock(return_value={
        "score": 8,
        "confidence": 0.9,
        "technical_score": 8,
        "communication_score": 8,
        "problem_solving_score": 8,
        "strengths": ["Clear intro"],
        "weaknesses": [],
        "follow_up_needed": False,
        "follow_up_reason": None,
        "evaluation_reasoning": "Well-articulated career history"
    })

    mock_report_agent = MagicMock()
    mock_report_agent.generate_report = AsyncMock(return_value={
        "overall_score": 8.0,
        "technical_rating": 8,
        "communication_rating": 8,
        "problem_solving_rating": 8,
        "leadership_rating": 8,
        "strengths": ["Excellent knowledge"],
        "weaknesses": [],
        "recommendation": "Proceed",
        "recommendation_reasoning": "Strong technical foundation",
        "summary": "Overall solid screen performance",
        "section_scores": {"Introduction": 8.0, "Technical Screen": 8.0},
        "detailed_feedback": {}
    })

    service = InterviewService(
        db=db_session,
        interview_repo=interview_repo,
        candidate_repo=candidate_repo,
        plan_repo=plan_repo,
        question_repo=question_repo,
        eval_repo=eval_repo,
        interview_agent=mock_interview_agent,
        eval_agent=mock_eval_agent,
        report_agent=mock_report_agent,
    )

    # 3. Test start_interview
    updated_interview, first_question = await service.start_interview(interview.id)
    
    assert updated_interview.status == InterviewStatus.IN_PROGRESS
    assert updated_interview.current_section == "Introduction"
    assert "introduce yourself and walk me through" in first_question.question_text
    assert first_question.sequence_number == 1

    # Verify plan was saved
    plan = await plan_repo.get_plan_by_interview_id(interview.id)
    assert plan is not None
    assert len(plan.sections) == 2
    assert plan.current_section_index == 0

    # 4. Test process_candidate_message
    updated_interview, next_question, is_complete = await service.process_candidate_message(
        interview_id=interview.id,
        candidate_message="I have worked on Python APIs for 3 years."
    )

    assert is_complete is False
    assert next_question is not None
    assert next_question.sequence_number == 2
    assert next_question.section == "Technical Screen"
    assert next_question.question_text == "Tell me about decorators in Python."
    
    # Check if response was recorded
    response = await question_repo.get_response_by_question_id(first_question.id)
    assert response is not None
    assert response.response_text == "I have worked on Python APIs for 3 years."
    
    # Check if evaluation was recorded
    evaluation = await eval_repo.get_evaluation_by_response_id(response.id)
    assert evaluation is not None
    assert evaluation.score == 8
    assert evaluation.evaluation_reasoning == "Well-articulated career history"

    # 5. Check mock report completion
    # Force mock_interview_agent to complete
    mock_interview_agent.generate_next_message = AsyncMock(return_value={
        "ai_message": "Thank you, wrap up.",
        "intent": "wrap_up",
        "is_follow_up": False,
        "section": "Technical Screen",
        "is_complete": True
    })

    updated_interview, next_question, is_complete = await service.process_candidate_message(
        interview_id=interview.id,
        candidate_message="That's all about decorators."
    )

    assert is_complete is True
    assert next_question is None
    assert updated_interview.status == InterviewStatus.COMPLETED

    # Check report was generated
    report = await eval_repo.get_report_by_interview_id(interview.id)
    assert report is not None
    assert report.overall_score == 8.0
    assert report.recommendation == "Proceed"


@pytest.mark.asyncio
async def test_gemini_service_fail_fast_on_long_rate_limit(monkeypatch):
    """Verify GeminiService fails fast and does not retry if the Groq rate limit sleep is too long (exceeds 15s)."""
    monkeypatch.setattr("app.services.gemini.settings.GROQ_API_KEY", "gsk_groqkey")

    service = GeminiService()

    # Simulate httpx.AsyncClient response with 429 status code and retry-after header of 172 seconds
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.headers = {"retry-after": "172"}
    mock_response.request = MagicMock()

    # Patch httpx.AsyncClient.post to return mock_response
    with patch("httpx.AsyncClient.post", return_value=mock_response):
        with pytest.raises(Exception) as exc_info:
            await service.generate_text("Hello", "llama-3.1-8b-instant")
        
        # Verify it raised the rate limit error without sleeping/retrying 5 times
        assert "exceeds maximum threshold" in str(exc_info.value)


@pytest.mark.asyncio
async def test_gemini_service_uses_custom_temperature(monkeypatch):
    """Verify GeminiService correctly passes temperature when calling Groq API."""
    monkeypatch.setattr("app.services.gemini.settings.GROQ_API_KEY", "gsk_groqkey")
    service = GeminiService()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": '{"ai_message": "Hello from custom temp"}'
                }
            }
        ]
    }

    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        await service.generate_json("Test prompt", "llama-3.1-8b-instant", temperature=0.85)
        # Verify the payload temperature
        assert mock_post.called
        kwargs = mock_post.call_args[1]
        assert kwargs["json"]["temperature"] == 0.85




