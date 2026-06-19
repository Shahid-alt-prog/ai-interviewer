"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ai-interviewer-api", "version": "1.0.0"}
