import os
import socket
import logging
from urllib.parse import urlparse
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

def is_postgres_running(url: str) -> bool:
    try:
        temp_url = url
        if "postgresql+asyncpg://" in temp_url:
            temp_url = temp_url.replace("postgresql+asyncpg://", "http://")
        elif "postgresql://" in temp_url:
            temp_url = temp_url.replace("postgresql://", "http://")
        
        parsed = urlparse(temp_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        
        with socket.create_connection((host, port), timeout=1.0):
            return True
    except Exception:
        return False

db_url = settings.DATABASE_URL

if "pytest" in os.environ.get("PYTEST_CURRENT_TEST", "") or "test" in settings.DATABASE_URL:
    if not is_postgres_running(db_url):
        logger.warning("PostgreSQL is not running. Using SQLite in-memory database for testing.")
        db_url = "sqlite+aiosqlite:///:memory:"
elif not settings.is_production:
    if not is_postgres_running(db_url):
        logger.warning("PostgreSQL is not running. Using SQLite file database (ai_interviewer.db) for development.")
        db_url = "sqlite+aiosqlite:///./ai_interviewer.db"

# Create engine options
engine_options = {
    "echo": settings.APP_DEBUG,
}

if db_url.startswith("postgresql"):
    engine_options.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    db_url,
    **engine_options
)

from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if db_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass

async def get_db() -> AsyncSession:
    """Dependency that provides an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
