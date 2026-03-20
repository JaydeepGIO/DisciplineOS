from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from typing import List, Optional, Dict, Any
import uuid
from datetime import date, datetime, timedelta
from ..database import get_db
from ..models import DisciplineScore, Streak, User, HabitTemplate
from ..schemas import DashboardRead
from ..dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard", response_model=DashboardRead)
async def get_dashboard(date_str: Optional[date] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not date_str:
        date_str = date.today()
    
    # 1. Get live counts for Habits
    habits_result = await db.execute(
        select(HabitTemplate).filter(HabitTemplate.user_id == current_user.id, HabitTemplate.is_active == True, HabitTemplate.deleted_at == None)
    )
    habits = habits_result.scalars().all()
    
    from ..models import HabitLog
    logs_result = await db.execute(
        select(HabitLog).filter(HabitLog.user_id == current_user.id, HabitLog.log_date == date_str)
    )
    logs_map = {log.habit_id: log for log in logs_result.scalars().all()}
    
    habits_completed = 0
    habit_list_data = []
    for h in habits:
        log = logs_map.get(h.id)
        is_completed = log.completion_ratio >= 1.0 if log else False
        if is_completed:
            habits_completed += 1
        habit_list_data.append({
            "id": h.id,
            "name": h.name,
            "color": h.color,
            "completed": is_completed,
            "tracking_type": h.tracking_type
        })

    # 2. Get live counts for Tasks
    from ..models import DailyPlan, PlannedTask, TaskLog
    plan_result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == current_user.id, DailyPlan.plan_date == date_str))
    plan = plan_result.scalars().first()
    
    tasks_total = 0
    tasks_completed = 0
    if plan:
        tasks_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id))
        planned_tasks = tasks_result.scalars().all()
        tasks_total = len(planned_tasks)
        
        if tasks_total > 0:
            task_ids = [pt.id for pt in planned_tasks]
            task_logs_result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id.in_(task_ids), TaskLog.completed == True))
            tasks_completed = len(task_logs_result.scalars().all())

    # 3. Get Discipline Score (cached)
    score_result = await db.execute(
        select(DisciplineScore).filter(DisciplineScore.user_id == current_user.id, DisciplineScore.period_type == "daily", DisciplineScore.period_key == str(date_str))
    )
    score = score_result.scalars().first()
    
    # 4. Get Streaks
    streaks_result = await db.execute(
        select(Streak, HabitTemplate.name, HabitTemplate.color)
        .join(HabitTemplate, Streak.habit_id == HabitTemplate.id)
        .filter(Streak.user_id == current_user.id)
    )
    streaks_data = []
    for s, name, color in streaks_result:
        streaks_data.append({
            "habit_id": s.habit_id,
            "name": name,
            "current_streak": s.current_streak,
            "longest_streak": s.longest_streak,
            "color": color
        })

    # 5. Get week trend
    start_of_week = date_str - timedelta(days=6)
    trend_result = await db.execute(
        select(DisciplineScore.score_date, DisciplineScore.raw_score)
        .filter(DisciplineScore.user_id == current_user.id, DisciplineScore.period_type == "daily", DisciplineScore.score_date >= start_of_week)
        .order_by(DisciplineScore.score_date)
    )
    trend_map = {row.score_date: float(row.raw_score) for row in trend_result}
    week_trend = []
    for i in range(7):
        d = start_of_week + timedelta(days=i)
        week_trend.append(trend_map.get(d, 0.0))

    # 6. Check for reflection
    from ..models import ReflectionEntry
    reflection_result = await db.execute(select(ReflectionEntry).filter(ReflectionEntry.user_id == current_user.id, ReflectionEntry.entry_date == date_str))
    has_reflection = reflection_result.scalars().first() is not None

    return {
        "date": date_str,
        "discipline_score": float(score.raw_score) if score else 0.0,
        "habits": {"completed": habits_completed, "total": len(habits)},
        "tasks": {"completed": tasks_completed, "total": tasks_total},
        "has_reflection": has_reflection,
        "streaks": streaks_data,
        "week_score_trend": week_trend,
        "habit_list": habit_list_data
    }

@router.get("/scores", response_model=List[dict])
async def get_scores(period_type: str = "daily", limit: int = 30, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DisciplineScore)
        .filter(DisciplineScore.user_id == current_user.id, DisciplineScore.period_type == period_type)
        .order_by(DisciplineScore.score_date.desc())
        .limit(limit)
    )
    scores = result.scalars().all()
    # Serialize manually to handle Numeric types if needed, or just return. Pydantic handles simple cases.
    return [
        {
            "period_key": s.period_key,
            "score_date": s.score_date,
            "raw_score": float(s.raw_score),
            "habit_score": float(s.habit_score),
            "task_score": float(s.task_score),
            "reflection_score": float(s.reflection_score),
            "habits_completed": s.habits_completed,
            "habits_total": s.habits_total,
            "tasks_completed": s.tasks_completed,
            "tasks_total": s.tasks_total
        }
        for s in scores
    ]

@router.get("/habits/completion-rate", response_model=List[dict])
async def get_habit_completion_rate(days: int = 30, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Calculate start date
    start_date = date.today() - timedelta(days=days)
    
    # Get all active habits
    habits_result = await db.execute(
        select(HabitTemplate).filter(HabitTemplate.user_id == current_user.id, HabitTemplate.is_active == True, HabitTemplate.deleted_at == None)
    )
    habits = habits_result.scalars().all()
    
    result_data = []
    from ..models import HabitLog
    for h in habits:
        # Get logs for this habit in range
        logs_count_result = await db.execute(
            select(func.count(HabitLog.id))
            .filter(HabitLog.habit_id == h.id, HabitLog.log_date >= start_date)
        )
        total_logs = logs_count_result.scalar() or 0
        
        # This is a simplified calculation for the MVP
        # In a real app, you'd calculate actual completion vs potential days
        result_data.append({
            "habit_id": h.id,
            "name": h.name,
            "color": h.color,
            "completion_rate": min(total_logs / days, 1.0) if days > 0 else 0,
            "total_days": days,
            "completed_days": total_logs
        })
        
    return result_data
