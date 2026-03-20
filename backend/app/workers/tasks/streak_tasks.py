import asyncio
from datetime import datetime, date, timedelta
from celery import shared_task
from sqlalchemy.future import select
from ...database import async_session
from ...models import Streak

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.streak_tasks.check_broken_streaks")
def check_broken_streaks():
    async def _task():
        async with async_session() as db:
            yesterday = date.today() - timedelta(days=1)
            # Find all streaks where last_completed_date is before yesterday and current_streak > 0
            result = await db.execute(
                select(Streak).filter(Streak.last_completed_date < yesterday, Streak.current_streak > 0)
            )
            streaks = result.scalars().all()
            for streak in streaks:
                streak.current_streak = 0
            
            await db.commit()
            
    return run_async(_task())
