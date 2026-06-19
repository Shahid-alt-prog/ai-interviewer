"""Candidate endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_candidate(client: AsyncClient):
    """Test creating a new candidate."""
    response = await client.post(
        "/candidates/",
        json={"name": "John Doe", "email": "john@example.com", "phone": "+1234567890"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "John Doe"
    assert data["email"] == "john@example.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_duplicate_candidate(client: AsyncClient):
    """Test that duplicate emails are rejected."""
    data = {"name": "Jane Doe", "email": "jane@example.com"}
    await client.post("/candidates/", json=data)
    response = await client.post("/candidates/", json=data)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_candidates(client: AsyncClient):
    """Test listing candidates."""
    await client.post("/candidates/", json={"name": "Alice", "email": "alice@test.com"})
    await client.post("/candidates/", json={"name": "Bob", "email": "bob@test.com"})
    response = await client.get("/candidates/")
    assert response.status_code == 200
    assert len(response.json()) >= 2


@pytest.mark.asyncio
async def test_get_candidate_not_found(client: AsyncClient):
    """Test 404 for non-existent candidate."""
    response = await client.get("/candidates/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_candidate(client: AsyncClient):
    """Test updating candidate metadata."""
    create_resp = await client.post(
        "/candidates/",
        json={"name": "Alice In Chains", "email": "alice_chains@test.com", "phone": "111-222"},
    )
    cand_id = create_resp.json()["id"]

    response = await client.put(
        f"/candidates/{cand_id}",
        json={"name": "Alice Chains Updated", "phone": "333-444"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Alice Chains Updated"
    assert data["phone"] == "333-444"


@pytest.mark.asyncio
async def test_update_candidate_duplicate_email(client: AsyncClient):
    """Test that candidate email update conflicts are rejected."""
    resp1 = await client.post(
        "/candidates/",
        json={"name": "User One", "email": "one@test.com"},
    )
    resp2 = await client.post(
        "/candidates/",
        json={"name": "User Two", "email": "two@test.com"},
    )
    cand2_id = resp2.json()["id"]

    # Try to set candidate 2's email to candidate 1's email
    response = await client.put(
        f"/candidates/{cand2_id}",
        json={"email": "one@test.com"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_delete_candidate(client: AsyncClient):
    """Test candidate deletion."""
    create_resp = await client.post(
        "/candidates/",
        json={"name": "Disposable", "email": "disposable@test.com"},
    )
    cand_id = create_resp.json()["id"]

    response = await client.delete(f"/candidates/{cand_id}")
    assert response.status_code == 204

    # Verify not found
    get_resp = await client.get(f"/candidates/{cand_id}")
    assert get_resp.status_code == 404
