import asyncio
from datetime import datetime, date
from celery import shared_task
from sqlalchemy.future import select
from sqlalchemy import and_, or_, update
from ...database import async_session
from ...models import TimeBlock, User

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.time_block_tasks.update_time_block_statuses")
def update_time_block_statuses():
    async def _task():
        from ...services.scoring_service import recompute_daily_scores
        
        print(f"[TIME_BLOCK_TASK] Running status update at {datetime.now()}")
        async with async_session() as db:
            now = datetime.now()
            today = now.date()
            
            # 1. Mark planned blocks as 'active' if they should be running now
            active_stmt = (
                update(TimeBlock)
                .where(
                    and_(
                        TimeBlock.status == "planned",
                        TimeBlock.start_time <= now,
                        TimeBlock.end_time > now
                    )
                )
                .values(status="active")
            )
            await db.execute(active_stmt)
            
            # 2. Mark 'planned' or 'active' blocks as 'missed' if their end_time has passed
            # A block is 'missed' if it's not 'completed' by the time it ends.
            missed_stmt = (
                update(TimeBlock)
                .where(
                    and_(
                        TimeBlock.status.in_(["planned", "active"]),
                        TimeBlock.end_time <= now
                    )
                )
                .values(status="missed")
            )
            
            # We need to know which users were affected to recompute their scores
            affected_users_query = select(TimeBlock.user_id).where(
                and_(
                    TimeBlock.status.in_(["planned", "active"]),
                    TimeBlock.end_time <= now
                )
            ).distinct()
            
            result = await db.execute(affected_users_query)
            user_ids = result.scalars().all()
            
            await db.execute(missed_stmt)
            await db.commit()
            
            if user_ids:
                print(f"[TIME_BLOCK_TASK] Recomputing scores for {len(user_ids)} users")
                # 3. Recompute scores for affected users
                for user_id in user_ids:
                    await recompute_daily_scores(db, user_id, today)
                
    return run_async(_task())
