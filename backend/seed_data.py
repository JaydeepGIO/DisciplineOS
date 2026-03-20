import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, async_session
from app.models import User, HabitTemplate, ScoringRule, ReflectionTemplate
from app.services.auth_service import get_password_hash
import uuid

async def seed():
    async with async_session() as db:
        # 1. Create a default user
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="test@example.com",
            username="tester",
            hashed_password=get_password_hash("password123"),
            display_name="Demo User",
            timezone="UTC"
        )
        db.add(user)
        await db.flush() # Ensure user exists before adding habits
        
        # 2. Add default habits
        habits = [
            {"name": "Morning Run",      "category": "health",    "tracking_type": "duration", "target_value": 30, "target_unit": "minutes",  "color": "#10b981", "scoring_weight": 1.5},
            {"name": "Meditation",       "category": "mental",    "tracking_type": "duration", "target_value": 20, "target_unit": "minutes",  "color": "#8b5cf6", "scoring_weight": 1.0},
            {"name": "Deep Work",        "category": "career",    "tracking_type": "duration", "target_value": 240, "target_unit": "minutes", "color": "#6366f1", "scoring_weight": 2.0},
            {"name": "Reading",          "category": "mental",    "tracking_type": "duration", "target_value": 30, "target_unit": "minutes",  "color": "#f59e0b", "scoring_weight": 1.0},
            {"name": "Exercise",         "category": "health",    "tracking_type": "boolean", "color": "#ef4444", "scoring_weight": 1.5},
            {"name": "Hydration",        "category": "health",    "tracking_type": "numeric", "target_value": 8, "target_unit": "glasses",   "color": "#06b6d4", "scoring_weight": 0.5},
        ]
        
        for h in habits:
            db.add(HabitTemplate(user_id=user_id, **h))
            
        # 3. Add default scoring rule
        db.add(ScoringRule(
            user_id=user_id,
            name="Default",
            habit_weight=0.5,
            task_weight=0.4,
            reflection_weight=0.1,
            is_active=True
        ))
        
        # 4. Add default reflection template
        db.add(ReflectionTemplate(
            user_id=user_id,
            name="Evening Review",
            is_default=True,
            questions=[
                {"id": str(uuid.uuid4()), "text": "What was my biggest win today?",              "type": "multiline", "order": 1},
                {"id": str(uuid.uuid4()), "text": "What distracted me or slowed me down?",      "type": "multiline", "order": 2},
                {"id": str(uuid.uuid4()), "text": "Rate your discipline today (1–10)",          "type": "rating",    "order": 3},
                {"id": str(uuid.uuid4()), "text": "What will you do differently tomorrow?",     "type": "multiline", "order": 4},
                {"id": str(uuid.uuid4()), "text": "One thing I am grateful for today:",         "type": "text",      "order": 5}
            ]
        ))
        
        await db.commit()
        print(f"Seed complete! User: test@example.com / password123")

if __name__ == "__main__":
    asyncio.run(seed())
