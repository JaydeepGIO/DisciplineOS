from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
from datetime import date, timedelta, datetime
from ..models import Streak, HabitLog

async def update_streak(db: AsyncSession, user_id: uuid.UUID, habit_id: uuid.UUID, log_date: date):
    # 1. Get current streak for this habit
    result = await db.execute(
        select(Streak).filter(Streak.user_id == user_id, Streak.habit_id == habit_id)
    )
    streak = result.scalars().first()
    
    if not streak:
        # Case 1: First ever completion
        streak = Streak(
            user_id=user_id,
            habit_id=habit_id,
            current_streak=1,
            longest_streak=1,
            streak_start_date=log_date,
            last_completed_date=log_date,
            total_completions=1
        )
        db.add(streak)
    else:
        # Case 3: Idempotent re-log same day
        if streak.last_completed_date == log_date:
            return streak
        
        # Case 2: Consecutive day
        if streak.last_completed_date == log_date - timedelta(days=1):
            streak.current_streak += 1
        # Case 4: Gap
        else:
            streak.current_streak = 1
            streak.streak_start_date = log_date
            
        streak.last_completed_date = log_date
        streak.total_completions += 1
        streak.longest_streak = max(streak.longest_streak, streak.current_streak)
        streak.updated_at = datetime.utcnow()
        
    await db.commit()
    await db.refresh(streak)
    return streak
