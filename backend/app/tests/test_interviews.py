"""Interview endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_interview(client: AsyncClient):
    """Test creating a new interview."""
    candidate_resp = await client.post(
        "/candidates/",
        json={"name": "Test Candidate", "email": "test@interview.com"},
    )
    candidate_id = candidate_resp.json()["id"]
    response = await client.post(
        "/interviews/",
        json={
            "candidate_id": candidate_id,
            "title": "Senior Engineer Interview",
            "job_description": "Looking for a senior software engineer with Python experience.",
            "interview_type": "technical_round",
            "duration_minutes": 45,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Senior Engineer Interview"
    assert data["status"] == "created"


@pytest.mark.asyncio
async def test_create_interview_invalid_candidate(client: AsyncClient):
    """Test 404 when candidate doesn't exist."""
    response = await client.post(
        "/interviews/",
        json={
            "candidate_id": "00000000-0000-0000-0000-000000000000",
            "title": "Test Interview",
            "job_description": "This is a test job description for testing.",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_start_interview(client: AsyncClient):
    """Test starting an interview."""
    candidate_resp = await client.post(
        "/candidates/",
        json={"name": "Starter", "email": "starter@test.com"},
    )
    candidate_id = candidate_resp.json()["id"]
    interview_resp = await client.post(
        "/interviews/",
        json={
            "candidate_id": candidate_id,
            "title": "Start Test",
            "job_description": "Testing the start flow of an interview session.",
        },
    )
    interview_id = interview_resp.json()["id"]
    response = await client.post(f"/interviews/{interview_id}/start")
    assert response.status_code == 200
    data = response.json()
    assert data["section"] == "Introduction"
    assert data["is_complete"] is False
    assert len(data["ai_message"]) > 0


@pytest.mark.asyncio
async def test_update_interview(client: AsyncClient):
    """Test updating an interview."""
    candidate_resp = await client.post(
        "/candidates/",
        json={"name": "Updater", "email": "updater@test.com"},
    )
    candidate_id = candidate_resp.json()["id"]
    interview_resp = await client.post(
        "/interviews/",
        json={
            "candidate_id": candidate_id,
            "title": "Old Title",
            "job_description": "Old job description test content.",
        },
    )
    interview_id = interview_resp.json()["id"]

    response = await client.put(
        f"/interviews/{interview_id}",
        json={
            "title": "New Title",
            "job_description": "New job description test content.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "New Title"
    assert data["job_description"] == "New job description test content."


@pytest.mark.asyncio
async def test_delete_interview(client: AsyncClient):
    """Test deleting an interview."""
    candidate_resp = await client.post(
        "/candidates/",
        json={"name": "Deleter", "email": "deleter@test.com"},
    )
    candidate_id = candidate_resp.json()["id"]
    interview_resp = await client.post(
        "/interviews/",
        json={
            "candidate_id": candidate_id,
            "title": "Delete Title",
            "job_description": "Delete job description test content.",
        },
    )
    interview_id = interview_resp.json()["id"]

    response = await client.delete(f"/interviews/{interview_id}")
    assert response.status_code == 204

    # Verify 404 on get
    get_resp = await client.get(f"/interviews/{interview_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_candidate_delete_cascades(client: AsyncClient):
    """Test that deleting a candidate cascade deletes all associated interviews."""
    candidate_resp = await client.post(
        "/candidates/",
        json={"name": "Cascade Candidate", "email": "cascade@test.com"},
    )
    candidate_id = candidate_resp.json()["id"]

    interview_resp = await client.post(
        "/interviews/",
        json={
            "candidate_id": candidate_id,
            "title": "Cascade Interview",
            "job_description": "Job description cascade delete testing.",
        },
    )
    interview_id = interview_resp.json()["id"]

    # Verify it exists
    get_interview_resp = await client.get(f"/interviews/{interview_id}")
    assert get_interview_resp.status_code == 200

    # Delete candidate
    delete_cand_resp = await client.delete(f"/candidates/{candidate_id}")
    assert delete_cand_resp.status_code == 204

    # Verify interview is cascade deleted
    get_interview_resp2 = await client.get(f"/interviews/{interview_id}")
    assert get_interview_resp2.status_code == 404
