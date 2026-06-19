"""AI Interviewer - FastAPI Application Entry Point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine, Base

logging.basicConfig(
    level=logging.INFO if not settings.APP_DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting AI Interviewer API...")
    if not settings.is_production:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified.")
    yield
    logger.info("Shutting down AI Interviewer API...")
    await engine.dispose()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(
        title="AI Interviewer API",
        description="Conversational AI-powered job interview platform using Google Gemini",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    cors_options = {
        "allow_origins": settings.CORS_ORIGINS,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if not settings.is_production:
        cors_options["allow_origin_regex"] = (
            r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        )

    application.add_middleware(
        CORSMiddleware,
        **cors_options,
    )

    # Mount static uploads folder for candidate resume retrieval
    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    application.mount(
        f"/{settings.UPLOAD_DIR}",
        StaticFiles(directory=settings.UPLOAD_DIR),
        name=settings.UPLOAD_DIR,
    )

    # Include API routes
    application.include_router(api_router, prefix="/api/v1")

    return application


app = create_app()
