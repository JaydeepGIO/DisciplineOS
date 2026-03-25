from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, delete
from typing import List
import uuid
from datetime import datetime, date

from ..database import get_db
from ..models import User, TimeBlock, TaskLog
from ..schemas import TimeBlockCreate, TimeBlockUpdate, TimeBlockRead
from ..dependencies import get_current_user
from ..services.scoring_service import recompute_daily_scores

router = APIRouter(prefix="/time-blocks", tags=["Time Blocks"])

# ... (create_time_block remains same)
@router.post("", response_model=TimeBlockRead, status_code=status.HTTP_201_CREATED)
async def create_time_block(
    block_in: TimeBlockCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if block_in.start_time >= block_in.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # Check for overlaps
    overlap_query = select(TimeBlock).filter(
        and_(
            TimeBlock.user_id == current_user.id,
            or_(
                and_(TimeBlock.start_time <= block_in.start_time, TimeBlock.end_time > block_in.start_time),
                and_(TimeBlock.start_time < block_in.end_time, TimeBlock.end_time >= block_in.end_time),
                and_(TimeBlock.start_time >= block_in.start_time, TimeBlock.end_time <= block_in.end_time)
            )
        )
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalars().first():
        raise HTTPException(status_code=400, detail="Time block overlaps with an existing one")

    # NEW: Check if task is already assigned
    if block_in.task_id:
        task_assigned_query = select(TimeBlock).filter(
            and_(
                TimeBlock.user_id == current_user.id,
                TimeBlock.task_id == block_in.task_id
            )
        )
        task_assigned_result = await db.execute(task_assigned_query)
        if task_assigned_result.scalars().first():
            raise HTTPException(status_code=400, detail="This task is already scheduled in another time block")

    db_block = TimeBlock(
        **block_in.model_dump(),
        user_id=current_user.id
    )
    db.add(db_block)
    await db.commit()
    await db.refresh(db_block)
    
    # Recompute score
    await recompute_daily_scores(db, current_user.id, db_block.start_time.date())
    
    # Final refresh to ensure all attributes are loaded for response serialization
    await db.refresh(db_block)
    
    return db_block

@router.get("/day", response_model=List[TimeBlockRead])
async def get_daily_time_blocks(
    day: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch blocks that start on this day
    query = select(TimeBlock).filter(
        and_(
            TimeBlock.user_id == current_user.id,
            TimeBlock.start_time >= datetime.combine(day, datetime.min.time()),
            TimeBlock.start_time <= datetime.combine(day, datetime.max.time())
        )
    ).order_by(TimeBlock.start_time)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/active", response_model=TimeBlockRead)
async def get_active_time_block(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now()
    query = select(TimeBlock).filter(
        and_(
            TimeBlock.user_id == current_user.id,
            TimeBlock.start_time <= now,
            TimeBlock.end_time > now
        )
    )
    result = await db.execute(query)
    block = result.scalars().first()
    if not block:
        raise HTTPException(status_code=404, detail="No active time block found")
    return block

@router.put("/{block_id}", response_model=TimeBlockRead)
async def update_time_block(
    block_id: uuid.UUID,
    block_in: TimeBlockUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(TimeBlock).filter(and_(TimeBlock.id == block_id, TimeBlock.user_id == current_user.id))
    result = await db.execute(query)
    db_block = result.scalars().first()
    
    if not db_block:
        raise HTTPException(status_code=404, detail="Time block not found")

    update_data = block_in.model_dump(exclude_unset=True)
    
    new_start = update_data.get("start_time", db_block.start_time)
    new_end = update_data.get("end_time", db_block.end_time)
    
    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # Overlap check (excluding self)
    overlap_query = select(TimeBlock).filter(
        and_(
            TimeBlock.user_id == current_user.id,
            TimeBlock.id != block_id,
            or_(
                and_(TimeBlock.start_time <= new_start, TimeBlock.end_time > new_start),
                and_(TimeBlock.start_time < new_end, TimeBlock.end_time >= new_end),
                and_(TimeBlock.start_time >= new_start, TimeBlock.end_time <= new_end)
            )
        )
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalars().first():
        raise HTTPException(status_code=400, detail="Updated time block overlaps with an existing one")

    for field, value in update_data.items():
        setattr(db_block, field, value)

    await db.commit()
    
    # NEW: Sync status with TaskLog if completed
    if db_block.status == "completed" and db_block.task_id:
        # Check if TaskLog exists
        tl_result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id == db_block.task_id))
        tl = tl_result.scalars().first()
        if not tl:
            tl = TaskLog(
                user_id=current_user.id,
                planned_task_id=db_block.task_id,
                log_date=db_block.start_time.date(),
                completed=True,
                completed_at=datetime.utcnow()
            )
            db.add(tl)
        else:
            tl.completed = True
            if not tl.completed_at:
                tl.completed_at = datetime.utcnow()
        await db.commit()

    await db.refresh(db_block)
    
    # Recompute score
    await recompute_daily_scores(db, current_user.id, db_block.start_time.date())
    
    # Final refresh to ensure all attributes are loaded for response serialization
    await db.refresh(db_block)
    
    return db_block

@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_block(
    block_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(TimeBlock).filter(and_(TimeBlock.id == block_id, TimeBlock.user_id == current_user.id))
    result = await db.execute(query)
    db_block = result.scalars().first()
    
    if not db_block:
        raise HTTPException(status_code=404, detail="Time block not found")
    
    block_date = db_block.start_time.date()
    
    await db.delete(db_block)
    await db.commit()
    
    # Recompute score
    await recompute_daily_scores(db, current_user.id, block_date)
    
    return None
