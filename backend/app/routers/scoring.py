from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from ..database import get_db
from ..models import ScoringRule
from ..schemas import ScoringRuleSchema, ScoringRuleCreate, ScoringRuleUpdate
from ..dependencies import get_current_user

router = APIRouter(prefix="/scoring", tags=["Scoring"])

@router.get("/rules", response_model=List[ScoringRuleSchema])
async def get_scoring_rules(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(ScoringRule).filter(ScoringRule.user_id == current_user.id))
    return result.scalars().all()

@router.post("/rules", response_model=ScoringRuleSchema, status_code=status.HTTP_201_CREATED)
async def create_scoring_rule(
    rule_in: ScoringRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if round(rule_in.habit_weight + rule_in.task_weight + rule_in.reflection_weight + rule_in.schedule_weight, 2) != 1.0:
        raise HTTPException(status_code=422, detail="Weights must sum to 1.0")
    
    new_rule = ScoringRule(
        user_id=current_user.id,
        **rule_in.model_dump()
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule

@router.put("/rules/{rule_id}", response_model=ScoringRuleSchema)
async def update_scoring_rule(
    rule_id: uuid.UUID,
    rule_in: ScoringRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(ScoringRule).filter(ScoringRule.id == rule_id, ScoringRule.user_id == current_user.id))
    rule = result.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Scoring rule not found")
    
    update_data = rule_in.model_dump(exclude_unset=True)
    
    # Revalidate weights if any are being updated
    h = update_data.get("habit_weight", rule.habit_weight)
    t = update_data.get("task_weight", rule.task_weight)
    r = update_data.get("reflection_weight", rule.reflection_weight)
    s = update_data.get("schedule_weight", rule.schedule_weight)
    if round(float(h) + float(t) + float(r) + float(s), 2) != 1.0:
        raise HTTPException(status_code=422, detail="Weights must sum to 1.0")

    for field, value in update_data.items():
        setattr(rule, field, value)
    
    await db.commit()
    await db.refresh(rule)
    return rule

@router.post("/rules/{rule_id}/activate", response_model=ScoringRuleSchema)
async def activate_scoring_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Deactivate all other rules for this user
    await db.execute(
        ScoringRule.__table__.update()
        .where(ScoringRule.user_id == current_user.id)
        .values(is_active=False)
    )
    
    # 2. Activate the selected rule
    result = await db.execute(select(ScoringRule).filter(ScoringRule.id == rule_id, ScoringRule.user_id == current_user.id))
    rule = result.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Scoring rule not found")
    
    rule.is_active = True
    await db.commit()
    await db.refresh(rule)
    return rule
