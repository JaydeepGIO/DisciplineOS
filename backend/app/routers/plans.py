from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
import uuid
from datetime import date, datetime
from ..database import get_db
from ..models import DailyPlan, PlannedTask, User, TaskTemplate
from ..schemas import DailyPlanCreate, DailyPlanRead, PlannedTaskCreate, PlannedTaskRead
from ..dependencies import get_current_user

router = APIRouter(prefix="/plans", tags=["plans"])

@router.get("/{date_str}", response_model=DailyPlanRead)
async def get_plan(date_str: date, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == current_user.id, DailyPlan.plan_date == date_str))
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    tasks_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id).order_by(PlannedTask.priority_rank))
    tasks = tasks_result.scalars().all()
    
    # Enrich tasks with log status
    from ..models import TaskLog
    task_ids = [t.id for t in tasks]
    logs_result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id.in_(task_ids)))
    logs_map = {log.planned_task_id: log for log in logs_result.scalars().all()}
    
    for t in tasks:
        log = logs_map.get(t.id)
        t.completed = log.completed if log else False
        t.actual_mins = log.actual_mins if log else None
        
    plan.tasks = tasks
    return plan

@router.post("/{date_str}", response_model=DailyPlanRead)
async def create_or_update_plan(date_str: date, plan_in: DailyPlanCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if plan exists
    result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == current_user.id, DailyPlan.plan_date == date_str))
    plan = result.scalars().first()
    
    if not plan:
        plan = DailyPlan(
            user_id=current_user.id,
            plan_date=date_str
        )
        db.add(plan)
        await db.flush()
    
    plan.morning_intention = plan_in.morning_intention
    plan.notes = plan_in.notes
    
    # Add tasks if provided (only new ones usually, but for this simple implementation we'll skip adding duplicates)
    for t_in in plan_in.tasks:
        # Check if task already exists in this plan
        task_exists_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id, PlannedTask.title == t_in.title))
        if not task_exists_result.scalars().first():
            new_task = PlannedTask(
                daily_plan_id=plan.id,
                user_id=current_user.id,
                **t_in.model_dump()
            )
            db.add(new_task)
    
    await db.commit()
    await db.refresh(plan)
    
    tasks_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id).order_by(PlannedTask.priority_rank))
    plan.tasks = tasks_result.scalars().all()
    return plan

@router.post("/{date_str}/tasks", response_model=PlannedTaskRead)
async def add_task_to_plan(date_str: date, task_in: PlannedTaskCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == current_user.id, DailyPlan.plan_date == date_str))
    plan = result.scalars().first()
    if not plan:
        plan = DailyPlan(user_id=current_user.id, plan_date=date_str)
        db.add(plan)
        await db.flush()
    
    new_task = PlannedTask(
        daily_plan_id=plan.id,
        user_id=current_user.id,
        **task_in.model_dump()
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task

@router.delete("/{date_str}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_planned_task(date_str: date, task_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlannedTask).filter(PlannedTask.id == task_id, PlannedTask.user_id == current_user.id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.delete(task)
    await db.commit()
    return None
