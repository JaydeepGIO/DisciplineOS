import asyncio
from datetime import datetime, date, timedelta
from celery import shared_task
from sqlalchemy.future import select
from sqlalchemy import func
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

async def _aggregate_period_scores(period_type: str, start_date: date, end_date: date, period_key: str):
    async with async_session() as db:
        # Get all users
        users_result = await db.execute(select(User.id))
        user_ids = users_result.scalars().all()
        
        for user_id in user_ids:
            # Aggregate daily scores for this period
            agg_result = await db.execute(
                select(
                    func.avg(DisciplineScore.raw_score).label("avg_raw"),
                    func.avg(DisciplineScore.habit_score).label("avg_habit"),
                    func.avg(DisciplineScore.task_score).label("avg_task"),
                    func.avg(DisciplineScore.reflection_score).label("avg_reflection"),
                    func.sum(DisciplineScore.habits_completed).label("sum_habits_comp"),
                    func.sum(DisciplineScore.habits_total).label("sum_habits_total"),
                    func.sum(DisciplineScore.tasks_completed).label("sum_tasks_comp"),
                    func.sum(DisciplineScore.tasks_total).label("sum_tasks_total")
                ).filter(
                    DisciplineScore.user_id == user_id,
                    DisciplineScore.period_type == "daily",
                    DisciplineScore.score_date >= start_date,
                    DisciplineScore.score_date <= end_date
                )
            )
            stats = agg_result.first()
            
            if stats and stats.avg_raw is not None:
                # Upsert period score
                score_stmt = select(DisciplineScore).filter(
                    DisciplineScore.user_id == user_id,
                    DisciplineScore.period_type == period_type,
                    DisciplineScore.period_key == period_key
                )
                score_result = await db.execute(score_stmt)
                score_row = score_result.scalars().first()
                
                if not score_row:
                    score_row = DisciplineScore(
                        user_id=user_id,
                        period_type=period_type,
                        period_key=period_key,
                        score_date=end_date # Representative date
                    )
                    db.add(score_row)
                
                score_row.raw_score = float(stats.avg_raw)
                score_row.habit_score = float(stats.avg_habit)
                score_row.task_score = float(stats.avg_task)
                score_row.reflection_score = float(stats.avg_reflection)
                score_row.habits_completed = int(stats.sum_habits_comp)
                score_row.habits_total = int(stats.sum_habits_total)
                score_row.tasks_completed = int(stats.sum_tasks_comp)
                score_row.tasks_total = int(stats.sum_tasks_total)
                score_row.computed_at = datetime.utcnow()
        
        await db.commit()

@shared_task(name="app.workers.tasks.analytics_tasks.aggregate_weekly_scores")
def aggregate_weekly_scores():
    # Last week: from 7 days ago until yesterday
    today = date.today()
    start_date = today - timedelta(days=today.weekday() + 7) # Last Monday
    end_date = start_date + timedelta(days=6) # Last Sunday
    period_key = f"{start_date.year}-W{start_date.isocalendar()[1]}"
    
    return run_async(_aggregate_period_scores("weekly", start_date, end_date, period_key))

@shared_task(name="app.workers.tasks.analytics_tasks.aggregate_monthly_scores")
def aggregate_monthly_scores():
    # Last month
    today = date.today()
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    period_key = last_month_start.strftime("%Y-%m")
    
    return run_async(_aggregate_period_scores("monthly", last_month_start, last_month_end, period_key))
