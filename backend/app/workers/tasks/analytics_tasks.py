import asyncio
from datetime import datetime, date, timedelta
from celery import shared_task
from sqlalchemy.future import select
from ...database import async_session
from ...services.scoring_service import recompute_daily_scores
from ...models import User, DisciplineScore

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.analytics_tasks.recompute_user_score")
def recompute_user_score(user_id: str, log_date_str: str):
    async def _task():
        async with async_session() as db:
            log_date = date.fromisoformat(log_date_str)
            await recompute_daily_scores(db, user_id, log_date)
            
    return run_async(_task())

@shared_task(name="app.workers.tasks.analytics_tasks.aggregate_weekly_scores")
def aggregate_weekly_scores():
    async def _task():
        # Implementation for weekly score aggregation
        # Simplified for now: just log that it's running
        pass
        
    return run_async(_task())

@shared_task(name="app.workers.tasks.analytics_tasks.aggregate_monthly_scores")
def aggregate_monthly_scores():
    async def _task():
        # Implementation for monthly score aggregation
        pass
        
    return run_async(_task())
