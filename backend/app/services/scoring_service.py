from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, and_
import uuid
from datetime import date, datetime, timedelta, timezone
import pytz
from ..models import HabitLog, TaskLog, ReflectionEntry, ScoringRule, DisciplineScore, HabitTemplate, PlannedTask, DailyPlan, TimeBlock, User

async def recompute_daily_scores(db: AsyncSession, user_id: uuid.UUID, log_date: date):
    # 0. Get user for timezone
    user_result = await db.execute(select(User).filter(User.id == user_id))
    user = user_result.scalars().first()
    user_tz = user.timezone if user else "UTC"
    
    # 1. Get active scoring rule
    rule_result = await db.execute(
        select(ScoringRule).filter(ScoringRule.user_id == user_id, ScoringRule.is_active == True)
    )
    rule = rule_result.scalars().first()
    if not rule:
        # Create default rule if none exists
        rule = ScoringRule(
            user_id=user_id, 
            name="Default", 
            habit_weight=0.5, 
            task_weight=0.3, 
            reflection_weight=0.1,
            schedule_weight=0.1
        )
        db.add(rule)
        await db.flush()

    # 2. Compute Habit Score (H)
    habits_result = await db.execute(
        select(HabitTemplate).filter(HabitTemplate.user_id == user_id, HabitTemplate.is_active == True, HabitTemplate.deleted_at == None)
    )
    habits = habits_result.scalars().all()
    
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

    # 5. Compute Schedule Score (S_c)
    # Get blocks for this day
    tz = pytz.timezone(user_tz)
    local_day_start = tz.localize(datetime.combine(log_date, datetime.min.time())).astimezone(pytz.UTC)
    local_day_end = tz.localize(datetime.combine(log_date, datetime.max.time())).astimezone(pytz.UTC)
    
    blocks_result = await db.execute(
        select(TimeBlock).filter(
            and_(
                TimeBlock.user_id == user_id,
                TimeBlock.start_time >= local_day_start,
                TimeBlock.start_time <= local_day_end
            )
        )
    )
    blocks = blocks_result.scalars().all()
    
    sc_score = 1.0
    if blocks:
        adherence_points = 0.0
        total_blocks = len(blocks)
        
        # Get task logs to verify completion times
        task_logs_result = await db.execute(select(TaskLog).filter(TaskLog.user_id == user_id, TaskLog.log_date == log_date))
        task_logs = {tl.planned_task_id: tl for tl in task_logs_result.scalars().all()}
        
        now = datetime.now(timezone.utc)
        
        for b in blocks:
            # Auto-mark past blocks as missed if still planned
            if b.status == "planned" and b.end_time < now:
                b.status = "missed"
            
            if b.status == "completed":
                block_points = 0.0
                if b.task_id:
                    # 1. Check Time Adherence (Did you do it on time?)
                    tl = task_logs.get(b.task_id)
                    time_adherence = 0.6 # Base for completion
                    
                    if tl and tl.completed and tl.completed_at:
                        buffer = timedelta(minutes=15)
                        comp_at = tl.completed_at.replace(tzinfo=timezone.utc) if tl.completed_at.tzinfo is None else tl.completed_at
                        
                        if b.start_time - buffer <= comp_at <= b.end_time + buffer:
                            time_adherence = 1.0 # Perfect timing
                    
                    # 2. Check Duration Adherence (Did you spend the time you said you would?)
                    duration_adherence = 1.0
                    pt_result = await db.execute(select(PlannedTask).filter(PlannedTask.id == b.task_id))
                    pt = pt_result.scalars().first()
                    
                    if pt and pt.estimated_mins and tl and tl.actual_mins:
                        # Accuracy = actual / estimated
                        accuracy = tl.actual_mins / pt.estimated_mins
                        if 0.8 <= accuracy <= 1.2:
                            duration_adherence = 1.0 # Close enough
                        elif 0.5 <= accuracy <= 1.5:
                            duration_adherence = 0.8 # Somewhat off
                        else:
                            duration_adherence = 0.5 # Way off (rushed or distracted)
                    
                    block_points = time_adherence * duration_adherence
                else:
                    block_points = 1.0 # Non-task block completed manually
                
                adherence_points += block_points
            elif b.status == "active":
                adherence_points += 0.3 # Small partial credit for active sessions
            elif b.status == "planned" and b.start_time <= now <= b.end_time:
                adherence_points += 0.1 # Very small credit for current but not-yet-started blocks
            
        sc_score = adherence_points / total_blocks

    # 6. Final Score (S)
    s = (
        (float(rule.habit_weight) * h_score) + 
        (float(rule.task_weight) * t_score) + 
        (float(rule.reflection_weight) * r_score) +
        (float(rule.schedule_weight) * sc_score)
    )
    final_score = round(s * 100, 2)

    # 7. Upsert DisciplineScore
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
    score_row.schedule_score = round(sc_score * 100, 2)
    score_row.habits_completed = habits_completed
    score_row.habits_total = habits_total
    score_row.tasks_completed = tasks_completed
    score_row.tasks_total = tasks_total
    score_row.computed_at = datetime.now(timezone.utc)
    
    await db.commit()
    return final_score
