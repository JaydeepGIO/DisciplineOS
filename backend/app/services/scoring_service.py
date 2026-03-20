from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
import uuid
from datetime import date, datetime
from ..models import HabitLog, TaskLog, ReflectionEntry, ScoringRule, DisciplineScore, HabitTemplate, PlannedTask, DailyPlan

async def recompute_daily_scores(db: AsyncSession, user_id: uuid.UUID, log_date: date):
    # 1. Get active scoring rule
    rule_result = await db.execute(
        select(ScoringRule).filter(ScoringRule.user_id == user_id, ScoringRule.is_active == True)
    )
    rule = rule_result.scalars().first()
    if not rule:
        # Create default rule if none exists
        rule = ScoringRule(user_id=user_id, name="Default", habit_weight=0.5, task_weight=0.4, reflection_weight=0.1)
        db.add(rule)
        await db.flush()

    # 2. Compute Habit Score (H)
    # Get all active habits for user
    habits_result = await db.execute(
        select(HabitTemplate).filter(HabitTemplate.user_id == user_id, HabitTemplate.is_active == True, HabitTemplate.deleted_at == None)
    )
    habits = habits_result.scalars().all()
    
    # Get logs for these habits on log_date
    logs_result = await db.execute(
        select(HabitLog).filter(HabitLog.user_id == user_id, HabitLog.log_date == log_date)
    )
    logs_map = {log.habit_id: log for log in logs_result.scalars().all()}
    
    h_score = 1.0
    habits_completed = 0
    habits_total = len(habits)
    
    if habits:
        total_weighted_ratio = 0.0
        total_weight = 0.0
        for h in habits:
            log = logs_map.get(h.id)
            ratio = log.completion_ratio if log else 0.0
            total_weighted_ratio += ratio * float(h.scoring_weight)
            total_weight += float(h.scoring_weight)
            if ratio >= 1.0:
                habits_completed += 1
        
        h_score = total_weighted_ratio / total_weight if total_weight > 0 else 1.0

    # 3. Compute Task Score (T)
    # Get all planned tasks for log_date
    plan_result = await db.execute(select(DailyPlan).filter(DailyPlan.user_id == user_id, DailyPlan.plan_date == log_date))
    plan = plan_result.scalars().first()
    
    t_score = 1.0
    tasks_completed = 0
    tasks_total = 0
    
    if plan:
        planned_tasks_result = await db.execute(select(PlannedTask).filter(PlannedTask.daily_plan_id == plan.id))
        planned_tasks = planned_tasks_result.scalars().all()
        tasks_total = len(planned_tasks)
        
        if planned_tasks:
            # Get logs for these tasks
            task_ids = [pt.id for pt in planned_tasks]
            task_logs_result = await db.execute(select(TaskLog).filter(TaskLog.planned_task_id.in_(task_ids), TaskLog.completed == True))
            completed_task_ids = {tl.planned_task_id for tl in task_logs_result.scalars().all()}
            tasks_completed = len(completed_task_ids)
            
            total_weighted_completed = sum(float(pt.scoring_weight) for pt in planned_tasks if pt.id in completed_task_ids)
            total_weight = sum(float(pt.scoring_weight) for pt in planned_tasks)
            t_score = total_weighted_completed / total_weight if total_weight > 0 else 1.0

    # 4. Compute Reflection Score (R)
    reflection_result = await db.execute(select(ReflectionEntry).filter(ReflectionEntry.user_id == user_id, ReflectionEntry.entry_date == log_date))
    has_reflection = reflection_result.scalars().first() is not None
    r_score = 1.0 if has_reflection else 0.0

    # 5. Final Score (S)
    s = (float(rule.habit_weight) * h_score) + (float(rule.task_weight) * t_score) + (float(rule.reflection_weight) * r_score)
    final_score = round(s * 100, 2)

    # 6. Upsert DisciplineScore
    score_result = await db.execute(
        select(DisciplineScore).filter(DisciplineScore.user_id == user_id, DisciplineScore.period_type == "daily", DisciplineScore.period_key == str(log_date))
    )
    score_row = score_result.scalars().first()
    if not score_row:
        score_row = DisciplineScore(
            user_id=user_id,
            score_date=log_date,
            period_type="daily",
            period_key=str(log_date)
        )
        db.add(score_row)
    
    score_row.raw_score = final_score
    score_row.habit_score = round(h_score * 100, 2)
    score_row.task_score = round(t_score * 100, 2)
    score_row.reflection_score = round(r_score * 100, 2)
    score_row.habits_completed = habits_completed
    score_row.habits_total = habits_total
    score_row.tasks_completed = tasks_completed
    score_row.tasks_total = tasks_total
    score_row.computed_at = datetime.utcnow()
    
    await db.commit()
    return final_score
