from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List, Optional
import uuid
from datetime import date, datetime
from ..database import get_db
from ..models import ReflectionTemplate, ReflectionEntry, User
from ..schemas import ReflectionTemplateCreate, ReflectionEntryCreate, ReflectionEntryRead
from ..dependencies import get_current_user
from ..schemas import ReflectionTemplateCreate, ReflectionTemplateRead, ReflectionEntryCreate, ReflectionEntryRead
from ..workers.tasks.analytics_tasks import recompute_user_score

router = APIRouter(prefix="/reflections", tags=["reflections"])

@router.get("/templates", response_model=List[ReflectionTemplateRead])
async def get_templates(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReflectionTemplate).filter(ReflectionTemplate.user_id == current_user.id, ReflectionTemplate.deleted_at == None))
    return result.scalars().all()

@router.post("/templates", response_model=ReflectionTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(template_in: ReflectionTemplateCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # If is_default is true, unset others
    if template_in.is_default:
        await db.execute(update(ReflectionTemplate).filter(ReflectionTemplate.user_id == current_user.id).values(is_default=False))
    
    # Ensure all questions have IDs
    questions = []
    for q in template_in.questions:
        q_dict = q.model_dump()
        if not q_dict.get("id"):
            q_dict["id"] = str(uuid.uuid4())
        questions.append(q_dict)

    new_template = ReflectionTemplate(
        user_id=current_user.id,
        name=template_in.name,
        description=template_in.description,
        is_default=template_in.is_default,
        questions=questions
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template

@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReflectionTemplate).filter(ReflectionTemplate.id == template_id, ReflectionTemplate.user_id == current_user.id))
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.deleted_at = datetime.utcnow()
    await db.commit()
    return None

@router.post("/templates/{template_id}/default", response_model=ReflectionTemplateRead)
async def set_default_template(template_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 1. Unset existing defaults
    await db.execute(update(ReflectionTemplate).filter(ReflectionTemplate.user_id == current_user.id).values(is_default=False))
    
    # 2. Set new default
    result = await db.execute(select(ReflectionTemplate).filter(ReflectionTemplate.id == template_id, ReflectionTemplate.user_id == current_user.id))
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.is_default = True
    await db.commit()
    await db.refresh(template)
    return template

@router.get("/{date_str}", response_model=ReflectionEntryRead)
async def get_reflection(date_str: date, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReflectionEntry).filter(ReflectionEntry.user_id == current_user.id, ReflectionEntry.entry_date == date_str))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Reflection entry not found")
    return entry

@router.post("/{date_str}", response_model=ReflectionEntryRead, status_code=status.HTTP_201_CREATED)
async def create_reflection(date_str: date, entry_in: ReflectionEntryCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if exists
    result = await db.execute(select(ReflectionEntry).filter(ReflectionEntry.user_id == current_user.id, ReflectionEntry.entry_date == date_str))
    entry = result.scalars().first()
    
    if not entry:
        entry = ReflectionEntry(
            user_id=current_user.id,
            entry_date=date_str
        )
        db.add(entry)
    
    entry.template_id = entry_in.template_id
    entry.answers = entry_in.answers
    entry.mood_score = entry_in.mood_score
    entry.energy_score = entry_in.energy_score
    
    await db.commit()
    await db.refresh(entry)
    
    # Recompute score (Async)
    recompute_user_score.delay(str(current_user.id), date_str.isoformat())
    
    return entry
