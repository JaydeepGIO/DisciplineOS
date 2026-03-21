import asyncio
from datetime import datetime, date, timedelta
from celery import shared_task
from sqlalchemy import update, delete, select
from ...database import async_session
from ...models import Streak, HabitTemplate

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.streak_tasks.check_broken_streaks")
def check_broken_streaks():
    async def _task():
        async with async_session() as db:
            # 1. Reset streaks that haven't been completed since yesterday
            yesterday = date.today() - timedelta(days=1)
            stmt = (
                update(Streak)
                .where(
                    Streak.last_completed_date < yesterday,
                    Streak.current_streak > 0
                )
                .values(current_streak=0)
            )
            await db.execute(stmt)
            
            # 2. Cleanup streaks for habits that are deleted or inactive
            orphan_stmt = (
                delete(Streak)
                .where(
                    Streak.habit_id.in_(
                        select(HabitTemplate.id).where(
                            (HabitTemplate.deleted_at != None) | (HabitTemplate.is_active == False)
                        )
                    )
                )
            )
            await db.execute(orphan_stmt)

            # 3. Aggressive Cleanup: Remove streaks where the habit template no longer exists at all
            missing_stmt = (
                delete(Streak)
                .where(
                    ~Streak.habit_id.in_(select(HabitTemplate.id))
                )
            )
            await db.execute(missing_stmt)
            
            await db.commit()
            
    return run_async(_task())
