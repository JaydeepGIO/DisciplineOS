import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
from app.models import HabitTemplate, ScoringRule, ReflectionTemplate
from app.config import settings
import uuid

async def init_db():
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Enable pgcrypto for gen_random_uuid()
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    print("Database tables created.")
    await engine.dispose()

from sqlalchemy import text

if __name__ == "__main__":
    asyncio.run(init_db())
