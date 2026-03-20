import asyncio
from datetime import datetime, date, timedelta
from celery import shared_task
from sqlalchemy import update
from ...database import async_session
from ...models import Streak

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.streak_tasks.check_broken_streaks")
def check_broken_streaks():
    async def _task():
        async with async_session() as db:
            # We want to reset streaks that haven't been completed since yesterday
            # but are still marked as active (>0)
            yesterday = date.today() - timedelta(days=1)
            
            # Use a single atomic update instead of fetching all rows
            stmt = (
                update(Streak)
                .where(
                    Streak.last_completed_date < yesterday,
                    Streak.current_streak > 0
                )
                .values(current_streak=0)
            )
            
            await db.execute(stmt)
            await db.commit()
            
    return run_async(_task())
