"""Shared test fixtures and configuration."""
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import Base, get_db, is_postgres_running
from app.core.config import settings
from app.main import app

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_interviewer_test"

if not is_postgres_running(TEST_DATABASE_URL):
    TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

settings.GROQ_API_KEY = ""
settings.GEMINI_API_KEY = ""

engine_test = create_async_engine(TEST_DATABASE_URL, echo=False)

from sqlalchemy import event

@event.listens_for(engine_test.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if TEST_DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

async_session_test = async_sessionmaker(
    engine_test, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_test() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create and tear down test database."""
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test/api/v1",
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Database session for direct model testing."""
    async with async_session_test() as session:
        yield session
