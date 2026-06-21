"""Application configuration using pydantic-settings."""
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_interviewer"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/ai_interviewer"

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str = "change-me-in-production"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Groq API Configuration
    GROQ_API_KEY: str = ""
    GROQ_FLASH_MODEL: str = "llama-3.1-8b-instant"
    GROQ_PRO_MODEL: str = "llama-3.3-70b-versatile"

    # Google Gemini (mapped to Groq models for compatibility)
    GEMINI_API_KEY: str = ""
    GEMINI_FLASH_MODEL: str = "llama-3.1-8b-instant"
    GEMINI_PRO_MODEL: str = "llama-3.3-70b-versatile"

    # Interview Settings
    MAX_INTERVIEW_DURATION_MINUTES: int = 60
    DEFAULT_INTERVIEW_DURATION_MINUTES: int = 30
    MAX_FOLLOW_UP_DEPTH: int = 3

    # Uploads
    UPLOAD_DIR: str = "uploads"
    MAX_RESUME_UPLOAD_BYTES: int = Field(default=5 * 1024 * 1024, ge=1)

    @property
    def is_production(self) -> bool:
        """Return whether the app is running in a production environment."""
        return self.APP_ENV.lower() == "production"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Fail fast on unsafe production defaults."""
        if self.is_production:
            if not (self.GROQ_API_KEY or self.GEMINI_API_KEY):
                raise ValueError(
                    "GROQ_API_KEY or GEMINI_API_KEY must be set in production."
                )
            if self.APP_SECRET_KEY == "change-me-in-production":
                raise ValueError("APP_SECRET_KEY must be changed in production.")
            if self.APP_DEBUG:
                raise ValueError("APP_DEBUG must be false in production.")
        return self


settings = Settings()
