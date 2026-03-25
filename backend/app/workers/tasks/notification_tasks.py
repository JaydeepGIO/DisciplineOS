import asyncio
from datetime import datetime, timedelta, timezone
from celery import shared_task
from sqlalchemy.future import select
from sqlalchemy import and_, update
from ...database import async_session
from ...models import TimeBlock, User

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.notification_tasks.send_habit_reminders")
def send_habit_reminders():
    async def _task():
        print(f"[NOTIFICATION_TASK] Checking for upcoming tasks at {datetime.now(timezone.utc)}")
        async with async_session() as db:
            now = datetime.now(timezone.utc)
            # Find blocks starting in the next 10-15 minutes
            window_start = now + timedelta(minutes=5)
            window_end = now + timedelta(minutes=15)
            
            stmt = select(TimeBlock, User).join(User, TimeBlock.user_id == User.id).where(
                and_(
                    TimeBlock.start_time >= window_start,
                    TimeBlock.start_time <= window_end,
                    TimeBlock.status == "planned"
                )
            )
            
            result = await db.execute(stmt)
            upcoming = result.all()
            
            for block, user in upcoming:
                # Check if already notified using metadata
                meta = block.metadata_ or {}
                if meta.get("notified_start"):
                    continue
                
                # "Send" notification
                # In a real app, this would call Firebase, OneSignal, or an Email service
                print(f"!!! [NOTIFICATION] To: {user.username} | Task: '{block.title}' starts in 10 minutes at {block.start_time}")
                
                # Update metadata to prevent double notifications
                new_meta = dict(meta)
                new_meta["notified_start"] = True
                new_meta["notified_at"] = now.isoformat()
                
                await db.execute(
                    update(TimeBlock)
                    .where(TimeBlock.id == block.id)
                    .values(metadata_=new_meta)
                )
            
            await db.commit()
            
    return run_async(_task())
