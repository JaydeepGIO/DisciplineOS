from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.future import select
from typing import List, Optional
import uuid
from datetime import date, datetime, timezone
from ..database import get_db
from ..models import HabitLog, TaskLog, HabitTemplate, PlannedTask, DailyPlan, DisciplineScore, User, TimeBlock
from ..schemas import HabitLogCreate, HabitLogRead, TaskLogCreate, TrackingDayRead
from ..dependencies import get_current_user
from ..workers.tasks.analytics_tasks import recompute_user_score

router = APIRouter(prefix="/tracking", tags=["tracking"])

@router.get("/{date_str}", response_model=TrackingDayRead)
async def get_tracking_day(date_str: date, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 1. Get habits and logs
    habits_result = await db.execute(
        select(HabitTemplate).filter(HabitTemplate.user_id == current_user.id, HabitTemplate.is_active == True, HabitTemplate.deleted_at == None)
    )
    habits = habits_result.scalars().all()
    
    logs_result = await db.execute(
        select(HabitLog).filter(HabitLog.user_id == current_user.id, HabitLog.log_date == date_str)
    )
    logs_map = {log.habit_id: log for log in logs_result.scalars().all()}
    
    habit_data = []
    for h in habits:
        log = logs_map.get(h.id)
        habit_data.append({
            "habit_id": h.id,
            "name": h.name,
            "tracking_type": h.tracking_type,
            "target_value": h.target_value,
            "target_unit": h.target_unit,
            "completed": log.completed if log else None,
            "numeric_value": log.numeric_value if log else None,
            "duration_secs": log.duration_secs if log else None,
            "completion_ratio": log.completion_ratio if log else 0.0,
            "notes": log.notes if log else None,
            "color": h.color
        })

    # 2. Get tasks and logs
    plan_result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == current_user.id, DailyPlan.plan_date == date_str))
    plan = plan_result.scalars().first()
    
    task_data = []
    if plan:
        tasks_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id))
        planned_tasks = tasks_result.scalars().all()
        
        task_ids = [pt.id for pt in planned_tasks]
        task_logs_result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id.in_(task_ids)))
        task_logs_map = {tl.planned_task_id: tl for tl in task_logs_result.scalars().all()}
        
        for pt in planned_tasks:
            tl = task_logs_map.get(pt.id)
            task_data.append({
                "task_id": pt.id,
                "title": pt.title,
                "priority_rank": pt.priority_rank,
                "timer_enabled": pt.timer_enabled,
                "completed": tl.completed if tl else False,
                "actual_mins": tl.actual_mins if tl else None,
                "completion_note": tl.completion_note if tl else None,
                "total_seconds": tl.total_seconds if tl else 0,
                "is_running": tl.is_running if tl else False,
                "started_at": tl.started_at if tl else None
            })

    # 3. Check for reflection
    from ..models import ReflectionEntry
    reflection_result = await db.execute(select(ReflectionEntry).filter(ReflectionEntry.user_id == current_user.id, ReflectionEntry.entry_date == date_str))
    has_reflection = reflection_result.scalars().first() is not None

    # 4. Get discipline score
    score_result = await db.execute(
        select(DisciplineScore).filter(DisciplineScore.user_id == current_user.id, DisciplineScore.period_type == "daily", DisciplineScore.period_key == str(date_str))
    )
    score = score_result.scalars().first()

    return {
        "date": date_str,
        "habits": habit_data,
        "tasks": task_data,
        "has_reflection": has_reflection,
        "discipline_score": float(score.raw_score) if score else None
    }

@router.post("/habits/{date_str}", response_model=HabitLogRead)
async def log_habit(date_str: date, log_in: HabitLogCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 1. Upsert habit log
    result = await db.execute(
        select(HabitLog).filter(HabitLog.user_id == current_user.id, HabitLog.habit_id == log_in.habit_id, HabitLog.log_date == date_str)
    )
    log = result.scalars().first()
    
    if not log:
        # Get target value snapshot from template
        habit_result = await db.execute(select(HabitTemplate).filter(HabitTemplate.id == log_in.habit_id))
        habit = habit_result.scalars().first()
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found")
            
        log = HabitLog(
            user_id=current_user.id,
            habit_id=log_in.habit_id,
            log_date=date_str,
            target_value=habit.target_value
        )
        db.add(log)
    
    log.completed = log_in.completed
    log.numeric_value = log_in.numeric_value
    log.duration_secs = log_in.duration_secs
    log.notes = log_in.notes
    log.logged_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(log)
    
    # 2. Update streak (if completed)
    if log.completion_ratio >= 1.0:
        from ..services.streak_service import update_streak
        await update_streak(db, current_user.id, log_in.habit_id, date_str)
        
    # 3. Recompute score (Async)
    recompute_user_score.delay(str(current_user.id), date_str.isoformat())
    
    return log

@router.post("/tasks/{date_str}", response_model=None)
async def log_task(date_str: date, log_in: TaskLogCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 1. Upsert task log
    result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id == log_in.planned_task_id))
    log = result.scalars().first()
    
    if not log:
        log = TaskLog(
            user_id=current_user.id,
            planned_task_id=log_in.planned_task_id,
            log_date=date_str
        )
        db.add(log)
        
    log.completed = log_in.completed
    log.actual_mins = log_in.actual_mins
    log.completion_note = log_in.completion_note
    if log_in.completed:
        log.completed_at = datetime.utcnow()
    
    await db.commit()
    
    # NEW: Update linked TimeBlocks if task is completed
    if log_in.completed:
        await db.execute(
            update(TimeBlock)
            .where(TimeBlock.task_id == log_in.planned_task_id)
            .where(TimeBlock.status != "completed")
            .values(status="completed")
        )
        await db.commit()
    
    # 2. Recompute score (Async)
    recompute_user_score.delay(str(current_user.id), date_str.isoformat())
    
    return {"status": "ok"}

@router.post("/tasks/{task_id}/start-timer", response_model=None)
async def start_task_timer(task_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get or create TaskLog
    pt_result = await db.execute(select(PlannedTask).filter(PlannedTask.id == task_id, PlannedTask.user_id == current_user.id))
    pt = pt_result.scalars().first()
    if not pt:
        raise HTTPException(status_code=404, detail="Task not found")
        
    result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id == task_id))
    log = result.scalars().first()
    
    if not log:
        # Get date from DailyPlan
        dp_result = await db.execute(select(DailyPlan).filter(DailyPlan.id == pt.daily_plan_id))
        dp = dp_result.scalars().first()
        log = TaskLog(user_id=current_user.id, planned_task_id=task_id, log_date=dp.plan_date)
        db.add(log)
        
    if log.is_running:
        return {"status": "already running"}
        
    log.is_running = True
    log.started_at = datetime.now(timezone.utc)
    
    # NEW: Mark associated TimeBlock as active
    await db.execute(
        update(TimeBlock)
        .where(TimeBlock.task_id == task_id)
        .where(TimeBlock.status == "planned")
        .values(status="active")
    )
    
    await db.commit()
    return {"status": "started"}

@router.post("/tasks/{task_id}/pause-timer", response_model=None)
async def pause_task_timer(task_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id == task_id, TaskLog.user_id == current_user.id))
    log = result.scalars().first()
    if not log or not log.is_running:
        return {"status": "not running"}
        
    # Calculate elapsed seconds
    now = datetime.now(timezone.utc)
    elapsed = (now - log.started_at).total_seconds()
    log.total_seconds += int(elapsed)
    log.is_running = False
    log.started_at = None
    await db.commit()
    return {"status": "paused", "total_seconds": log.total_seconds}

@router.post("/tasks/{task_id}/stop-timer", response_model=None)
async def stop_task_timer(task_id: uuid.UUID, completion_note: Optional[str] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id == task_id, TaskLog.user_id == current_user.id))
    log = result.scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Task log not found")
        
    if log.is_running:
        now = datetime.now(timezone.utc)
        elapsed = (now - log.started_at).total_seconds()
        log.total_seconds += int(elapsed)
        
    log.is_running = False
    log.started_at = None
    log.completed = True
    log.completed_at = datetime.now(timezone.utc)
    log.actual_mins = log.total_seconds // 60
    if completion_note:
        log.completion_note = completion_note
        
    # NEW: Update associated TimeBlock to completed
    await db.execute(
        update(TimeBlock)
        .where(TimeBlock.task_id == task_id)
        .where(TimeBlock.status != "completed")
        .values(status="completed")
    )
        
    await db.commit()
    # 2. Recompute score (Async)
    recompute_user_score.delay(str(current_user.id), log.log_date.isoformat())
    return {"status": "stopped", "actual_mins": log.actual_mins}
