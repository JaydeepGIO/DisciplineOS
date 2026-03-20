import asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import Base, get_db
from sqlalchemy import text

# Test Database URL
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:jay2000lx@localhost:5432/disciplineos_test"

@pytest.fixture(scope="session")
def engine():
    # Use NullPool to avoid connection pooling issues in tests
    return create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)

@pytest.fixture(scope="session")
def TestingSessionLocal(engine):
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

@pytest.fixture(scope="session", autouse=True)
async def setup_db(engine):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(TestingSessionLocal):
    async with TestingSessionLocal() as session:
        yield session
        # Ensure we rollback and close cleanly
        if session.is_active:
            await session.rollback()
        await session.close()

@pytest.fixture
async def client(TestingSessionLocal):
    # Create a NEW session for EACH get_db call to avoid sharing across requests/tasks
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session
    
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
