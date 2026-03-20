from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List, Optional
import uuid
from datetime import datetime
from ..database import get_db
from ..models import HabitTemplate, User
from ..schemas import HabitCreate, HabitRead, HabitUpdate, HabitStats
from ..dependencies import get_current_user

router = APIRouter(prefix="/habits", tags=["habits"])

@router.get("/", response_model=List[HabitRead])
async def get_habits(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(HabitTemplate).filter(HabitTemplate.user_id == current_user.id, HabitTemplate.deleted_at == None)
    if category:
        query = query.filter(HabitTemplate.category == category)
    if is_active is not None:
        query = query.filter(HabitTemplate.is_active == is_active)
    
    result = await db.execute(query.order_by(HabitTemplate.display_order))
    return result.scalars().all()

@router.post("/", response_model=HabitRead, status_code=status.HTTP_201_CREATED)
async def create_habit(habit_in: HabitCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_habit = HabitTemplate(
        user_id=current_user.id,
        **habit_in.model_dump(by_alias=True)
    )
    db.add(new_habit)
    await db.commit()
    await db.refresh(new_habit)
    return new_habit

@router.put("/{id}", response_model=HabitRead)
async def update_habit(id: uuid.UUID, habit_in: HabitUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HabitTemplate).filter(HabitTemplate.id == id, HabitTemplate.user_id == current_user.id))
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    update_data = habit_in.model_dump(exclude_unset=True, by_alias=True)
    for key, value in update_data.items():
        setattr(habit, key, value)
    
    await db.commit()
    await db.refresh(habit)
    return habit

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HabitTemplate).filter(HabitTemplate.id == id, HabitTemplate.user_id == current_user.id))
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    habit.deleted_at = datetime.utcnow()
    habit.is_active = False
    await db.commit()
    return None

@router.get("/{id}/stats", response_model=HabitStats)
async def get_habit_stats(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # This is a stub for now. Real stats require querying habit_logs and streaks.
    result = await db.execute(select(HabitTemplate).filter(HabitTemplate.id == id, HabitTemplate.user_id == current_user.id))
    habit = result.scalars().first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    return {
        "habit_id": habit.id,
        "name": habit.name,
        "total_logs": 0,
        "completion_rate": 0.0,
        "current_streak": 0,
        "longest_streak": 0,
        "last_7_days": []
    }
