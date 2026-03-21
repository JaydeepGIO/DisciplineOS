from datetime import datetime, date
from sqlalchemy.future import select
from sqlalchemy import and_
from ..database import async_session
from ..models import User, DisciplineScore, HabitLog, HabitTemplate, TaskLog, PlannedTask, ReflectionEntry, Streak
import os
import traceback
import json

# Try to import weasyprint for PDF generation
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

async def generate_user_report(user_id: str, job_id: str, config: dict):
    try:
        print(f"[REPORT DEBUG] Config received: {config}")
        report_type = config.get("report_type", "weekly")
        
        # Safe extraction of dates
        def parse_date(val):
            if isinstance(val, date): return val
            if isinstance(val, str): return date.fromisoformat(val)
            return date.today()

        start_date = parse_date(config.get("period_start"))
        end_date = parse_date(config.get("period_end"))
        format_ = config.get("format", "pdf")
        sections = config.get("include_sections", ["scores", "habits", "reflections", "streaks", "tasks"])
        
        # Determine absolute storage path
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        storage_dir = os.path.join(base_dir, "generated_reports")
        if not os.path.exists(storage_dir):
            os.makedirs(storage_dir)
            
        print(f"[REPORT] Starting generation for user {user_id}, Job: {job_id}")

        async with async_session() as db:
            user_result = await db.execute(select(User).filter(User.id == user_id))
            user = user_result.scalars().first()
            if not user:
                return None
                
            report_data = {
                "user": user.username,
                "period": f"{start_date} to {end_date}",
                "generated_at": datetime.now().isoformat(),
                "scores": [],
                "habits": [],
                "reflections": [],
                "tasks": [],
                "streaks": []
            }
            
            # 1. Scores
            if "scores" in sections:
                scores_result = await db.execute(
                    select(DisciplineScore).filter(
                        DisciplineScore.user_id == user_id,
                        DisciplineScore.score_date >= start_date,
                        DisciplineScore.score_date <= end_date,
                        DisciplineScore.period_type == "daily"
                    ).order_by(DisciplineScore.score_date)
                )
                report_data["scores"] = [
                    {
                        "date": s.score_date.isoformat(),
                        "total": float(s.raw_score),
                        "habits": float(s.habit_score),
                        "tasks": float(s.task_score),
                        "reflection": float(s.reflection_score)
                    } for s in scores_result.scalars().all()
                ]
                
            # 2. Habit Logs
            if "habits" in sections:
                habits_result = await db.execute(
                    select(HabitLog, HabitTemplate)
                    .join(HabitTemplate, HabitLog.habit_id == HabitTemplate.id)
                    .filter(
                        HabitLog.user_id == user_id,
                        HabitLog.log_date >= start_date,
                        HabitLog.log_date <= end_date
                    ).order_by(HabitLog.log_date)
                )
                for log, template in habits_result:
                    report_data["habits"].append({
                        "date": log.log_date.isoformat(),
                        "name": template.name,
                        "completed": log.completed,
                        "value": float(log.numeric_value) if log.numeric_value else None,
                        "notes": log.notes
                    })
            
            # 3. Tasks
            if "tasks" in sections:
                tasks_result = await db.execute(
                    select(PlannedTask)
                    .join(User, PlannedTask.user_id == User.id)
                    .filter(
                        PlannedTask.user_id == user_id,
                        PlannedTask.created_at >= datetime.combine(start_date, datetime.min.time()),
                        PlannedTask.created_at <= datetime.combine(end_date, datetime.max.time())
                    ).order_by(PlannedTask.created_at)
                )
                report_data["tasks"] = [
                    {
                        "title": t.title,
                        "completed": t.completed,
                        "priority": t.priority_rank,
                        "actual_mins": t.actual_mins,
                        "note": t.completion_note
                    } for t in tasks_result.scalars().all()
                ]
                    
            # 4. Reflections
            if "reflections" in sections:
                ref_result = await db.execute(
                    select(ReflectionEntry).filter(
                        ReflectionEntry.user_id == user_id,
                        ReflectionEntry.entry_date >= start_date,
                        ReflectionEntry.entry_date <= end_date
                    ).order_by(ReflectionEntry.entry_date)
                )
                report_data["reflections"] = [
                    {
                        "date": r.entry_date.isoformat(),
                        "mood": r.mood_score,
                        "energy": r.energy_score,
                        "answers": r.answers
                    } for r in ref_result.scalars().all()
                ]
                
            # 5. Streaks
            if "streaks" in sections:
                streaks_result = await db.execute(
                    select(Streak, HabitTemplate)
                    .join(HabitTemplate, Streak.habit_id == HabitTemplate.id)
                    .filter(Streak.user_id == user_id)
                )
                report_data["streaks"] = [
                    {
                        "habit": template.name,
                        "current": s.current_streak,
                        "longest": s.longest_streak
                    } for s, template in streaks_result
                ]

        # Generate Output
        print(f"[REPORT] Data fetched, generating file output in {format_} format...")

        if format_ == "json":
            output_path = os.path.join(storage_dir, f"report_{job_id}.json")
            with open(output_path, "w") as f:
                json.dump(report_data, f, indent=2)
            print(f"[REPORT] Successfully generated JSON: {output_path}")
            return output_path

        if format_ == "pdf" and WEASYPRINT_AVAILABLE:
            html_content = f"""
            <html>
                <head>
                    <style>
                        body {{ font-family: sans-serif; padding: 40px; color: #333; }}
                        h1 {{ color: #4F46E5; }}
                        .section {{ margin-bottom: 30px; }}
                        table {{ width: 100%; border-collapse: collapse; }}
                        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                        th {{ background-color: #f3f4f6; }}
                    </style>
                </head>
                <body>
                    <h1>DisciplineOS {report_type.capitalize()} Report</h1>
                    <p><strong>User:</strong> {report_data['user']}</p>
                    <p><strong>Period:</strong> {report_data['period']}</p>
                    <p><strong>Generated:</strong> {report_data['generated_at']}</p>
                    
                    <div class="section">
                        <h2>Daily Scores</h2>
                        <table>
                            <tr><th>Date</th><th>Total Score</th><th>Habits</th><th>Tasks</th></tr>
                            {"".join([f"<tr><td>{s['date']}</td><td>{s['total']:.1f}</td><td>{s['habits']:.1f}</td><td>{s['tasks']:.1f}</td></tr>" for s in report_data['scores']])}
                        </table>
                    </div>
                    
                    <div class="section">
                        <h2>Habit Completion</h2>
                        <table>
                            <tr><th>Date</th><th>Habit</th><th>Completed</th></tr>
                            {"".join([f"<tr><td>{h['date']}</td><td>{h['name']}</td><td>{'Yes' if h['completed'] else 'No'}</td></tr>" for h in report_data['habits']])}
                        </table>
                    </div>

                    <div class="section">
                        <h2>Active Streaks</h2>
                        <table>
                            <tr><th>Habit</th><th>Current</th><th>Longest</th></tr>
                            {"".join([f"<tr><td>{s['habit']}</td><td>{s['current']}</td><td>{s['longest']}</td></tr>" for s in report_data['streaks']])}
                        </table>
                    </div>
                </body>
            </html>
            """
            output_path = os.path.join(storage_dir, f"report_{job_id}.pdf")
            try:
                HTML(string=html_content).write_pdf(output_path)
                print(f"[REPORT] Successfully generated PDF: {output_path}")
            except Exception as e:
                print(f"[REPORT] PDF generation failed: {e}. Falling back to TXT.")
                format_ = "txt"

        if format_ != "pdf" or not WEASYPRINT_AVAILABLE:
            # Fallback to plain text
            output_path = os.path.join(storage_dir, f"report_{job_id}.txt")
            with open(output_path, "w") as f:
                f.write(f"DisciplineOS {report_type.capitalize()} Report\n")
                f.write(f"User: {report_data['user']}\n")
                f.write(f"Period: {report_data['period']}\n\n")
                f.write("--- DAILY SCORES ---\n")
                for s in report_data['scores']:
                    f.write(f"{s['date']}: {s['total']:.1f} (H: {s['habits']:.1f}, T: {s['tasks']:.1f})\n")
                f.write("\n--- STREAKS ---\n")
                for s in report_data['streaks']:
                    f.write(f"{s['habit']}: Current {s['current']}, Longest {s['longest']}\n")
            print(f"[REPORT] Successfully generated TXT: {output_path}")
                    
        return output_path
        
    except Exception as e:
        print(f"[REPORT ERROR] Task failed for job {job_id}: {str(e)}")
        traceback.print_exc()
        return None
