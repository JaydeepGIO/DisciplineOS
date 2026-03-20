import asyncio
import os
from sqlalchemy import text
from app.database import engine
from dotenv import load_dotenv

# Load env from backend folder
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

async def sync_schema():
    print("Checking database schema and adding missing columns...")
    async with engine.begin() as conn:
        # Add timer_enabled to planned_tasks
        try:
            await conn.execute(text("ALTER TABLE planned_tasks ADD COLUMN timer_enabled BOOLEAN DEFAULT FALSE"))
            print("Successfully added 'timer_enabled' to planned_tasks")
        except Exception as e:
            if "already exists" in str(e):
                print("'timer_enabled' already exists in planned_tasks")
            else:
                print(f"Error adding timer_enabled: {e}")

        # Add timer fields to task_logs
        timer_fields = [
            ("total_seconds", "INTEGER DEFAULT 0"),
            ("started_at", "TIMESTAMP WITH TIME ZONE"),
            ("is_running", "BOOLEAN DEFAULT FALSE")
        ]
        
        for col, col_type in timer_fields:
            try:
                await conn.execute(text(f"ALTER TABLE task_logs ADD COLUMN {col} {col_type}"))
                print(f"Successfully added '{col}' to task_logs")
            except Exception as e:
                if "already exists" in str(e):
                    print(f"'{col}' already exists in task_logs")
                else:
                    print(f"Error adding {col}: {e}")

    print("Schema sync complete.")

if __name__ == "__main__":
    asyncio.run(sync_schema())
