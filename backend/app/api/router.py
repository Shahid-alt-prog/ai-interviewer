"""API router aggregating all endpoint modules."""
from fastapi import APIRouter

from app.api.endpoints import candidates, interviews, health, tts

api_router = APIRouter()

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"],
)
api_router.include_router(
    candidates.router,
    prefix="/candidates",
    tags=["Candidates"],
)
api_router.include_router(
    interviews.router,
    prefix="/interviews",
    tags=["Interviews"],
)
api_router.include_router(
    tts.router,
    prefix="/tts",
    tags=["Text-to-Speech"],
)
