import asyncio
import os
from sqlalchemy import text
from app.database import engine
from dotenv import load_dotenv

# Load env from backend folder
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

async def run_step(step_name, sql):
    print(f"Step: {step_name}...")
    async with engine.connect() as conn:
        try:
            await conn.execute(text(sql))
            await conn.commit()
            print(f"Successfully completed: {step_name}")
        except Exception as e:
            await conn.rollback()
            if "already exists" in str(e) or "duplicate column" in str(e):
                print(f"Skipped: {step_name} (already exists)")
            else:
                print(f"Error in {step_name}: {e}")

async def migrate():
    print("Migrating database for Time Blocking feature...")
    
    # 1. Extensions
    await run_step("Enable btree_gist", "CREATE EXTENSION IF NOT EXISTS btree_gist")
    await run_step("Enable pgcrypto", "CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # 2. Add columns to existing tables
    await run_step("Add schedule_weight to scoring_rules", 
                   "ALTER TABLE scoring_rules ADD COLUMN IF NOT EXISTS schedule_weight NUMERIC DEFAULT 0.1")
    
    await run_step("Update scoring_rules weights", 
                   "UPDATE scoring_rules SET task_weight = 0.3, schedule_weight = 0.1 WHERE schedule_weight IS NULL OR schedule_weight = 0.1")
    
    await run_step("Add schedule_score to discipline_scores", 
                   "ALTER TABLE discipline_scores ADD COLUMN IF NOT EXISTS schedule_score NUMERIC DEFAULT 0")

    # 3. Create time_blocks table
    await run_step("Create time_blocks table", """
        CREATE TABLE IF NOT EXISTS time_blocks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            deleted_at TIMESTAMP WITH TIME ZONE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            task_id UUID REFERENCES planned_tasks(id) ON DELETE SET NULL,
            title VARCHAR NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE NOT NULL,
            status VARCHAR DEFAULT 'planned',
            metadata_ JSONB DEFAULT '{}'
        )
    """)

    # 4. Indexes
    await run_step("Index: time_blocks_user_date", 
                   "CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks (user_id, start_time)")
    await run_step("Index: time_blocks_task_id", 
                   "CREATE INDEX IF NOT EXISTS idx_time_blocks_task_id ON time_blocks (task_id)")

    # 5. Overlap Constraint
    await run_step("Add overlap exclusion constraint", """
        ALTER TABLE time_blocks 
        ADD CONSTRAINT no_overlap_time_blocks 
        EXCLUDE USING gist (
            user_id WITH =,
            tstzrange(start_time, end_time) WITH &&
        )
    """)

    print("Migration finished.")

if __name__ == "__main__":
    asyncio.run(migrate())
