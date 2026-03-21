from datetime import datetime, date, timedelta
from sqlalchemy.future import select
from sqlalchemy import and_, func, desc
from ..database import async_session
from ..models import User, DisciplineScore, HabitLog, HabitTemplate, TaskLog, PlannedTask, ReflectionEntry, Streak, DailyPlan, ReflectionTemplate
import os
import traceback
import json
import csv
import io
import zipfile
from typing import List, Dict, Any

# Try to import weasyprint for PDF generation
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

# Try to import fpdf2 for a basic driver-free fallback
try:
    from fpdf import FPDF
    FPDF_AVAILABLE = True
except Exception:
    FPDF_AVAILABLE = False

async def generate_user_report(user_id: str, job_id: str, config: dict):
    try:
        report_type = config.get("report_type", "weekly")
        
        def parse_date(val):
            if isinstance(val, date): return val
            if isinstance(val, str): return date.fromisoformat(val)
            return date.today()

        start_date = parse_date(config.get("period_start"))
        end_date = parse_date(config.get("period_end"))
        format_ = config.get("format", "pdf")
        
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        storage_dir = os.path.join(base_dir, "generated_reports")
        if not os.path.exists(storage_dir):
            os.makedirs(storage_dir)
            
        async with async_session() as db:
            # 1. User Profile
            user_result = await db.execute(select(User).filter(User.id == user_id))
            user = user_result.scalars().first()
            if not user:
                return None
                
            report_data = {
                "user_profile": {
                    "username": user.username,
                    "timezone": user.timezone,
                    "preferences": user.preferences
                },
                "period": f"{start_date} to {end_date}",
                "summary_metrics": {
                    "average_discipline_score": 0,
                    "top_performing_habit": "N/A",
                    "lowest_performing_habit": "N/A"
                },
                "time_series_data": [],
                "streak_data": [],
                "reflections": [],
                "tasks": []
            }

            # 2. Daily Data Aggregation (Time Series)
            # We iterate through each day in the range to ensure a complete context
            current_dt = start_date
            date_map = {}
            while current_dt <= end_date:
                date_map[current_dt.isoformat()] = {
                    "date": current_dt.isoformat(),
                    "score": 0.0,
                    "breakdown": {"habits": 0, "tasks": 0, "reflection": 0},
                    "habits_logged": [],
                    "tasks": [],
                    "reflection": None
                }
                current_dt += timedelta(days=1)

            # Fetch Scores
            scores_result = await db.execute(
                select(DisciplineScore).filter(
                    DisciplineScore.user_id == user_id,
                    DisciplineScore.score_date >= start_date,
                    DisciplineScore.score_date <= end_date,
                    DisciplineScore.period_type == "daily"
                )
            )
            scores = scores_result.scalars().all()
            if scores:
                avg_score = sum(float(s.raw_score) for s in scores) / len(scores)
                report_data["summary_metrics"]["average_discipline_score"] = round(avg_score, 1)
                for s in scores:
                    d_str = s.score_date.isoformat()
                    if d_str in date_map:
                        date_map[d_str]["score"] = float(s.raw_score)
                        date_map[d_str]["breakdown"] = {
                            "habits": float(s.habit_score),
                            "tasks": float(s.task_score),
                            "reflection": float(s.reflection_score)
                        }

            # Fetch Habit Logs with Templates
            habits_result = await db.execute(
                select(HabitLog, HabitTemplate)
                .join(HabitTemplate, HabitLog.habit_id == HabitTemplate.id)
                .filter(
                    HabitLog.user_id == user_id,
                    HabitLog.log_date >= start_date,
                    HabitLog.log_date <= end_date
                )
            )
            habit_performance = {}
            for log, template in habits_result:
                d_str = log.log_date.isoformat()
                is_completed = log.completion_ratio >= 1.0
                if d_str in date_map:
                    date_map[d_str]["habits_logged"].append({
                        "name": template.name,
                        "status": "completed" if is_completed else "missed",
                        "value": float(log.numeric_value) if log.numeric_value else (1.0 if is_completed else 0.0),
                        "notes": log.notes
                    })
                
                # For summary metrics
                if template.name not in habit_performance:
                    habit_performance[template.name] = {"total": 0, "completed": 0}
                habit_performance[template.name]["total"] += 1
                if is_completed:
                    habit_performance[template.name]["completed"] += 1

            if habit_performance:
                sorted_habits = sorted(
                    habit_performance.items(), 
                    key=lambda x: x[1]["completed"] / x[1]["total"], 
                    reverse=True
                )
                report_data["summary_metrics"]["top_performing_habit"] = sorted_habits[0][0]
                report_data["summary_metrics"]["lowest_performing_habit"] = sorted_habits[-1][0]

            # Fetch Tasks
            tasks_result = await db.execute(
                select(PlannedTask, TaskLog)
                .outerjoin(TaskLog, PlannedTask.id == TaskLog.planned_task_id)
                .join(DailyPlan, PlannedTask.daily_plan_id == DailyPlan.id)
                .filter(
                    PlannedTask.user_id == user_id,
                    DailyPlan.plan_date >= start_date,
                    DailyPlan.plan_date <= end_date
                )
            )
            for pt, log in tasks_result:
                # We need the plan date from the DailyPlan associated with this task
                # Re-fetching just plan date to be sure
                plan_result = await db.execute(select(DailyPlan.plan_date).filter(DailyPlan.id == pt.daily_plan_id))
                p_date = plan_result.scalar()
                d_str = p_date.isoformat()
                if d_str in date_map:
                    date_map[d_str]["tasks"].append({
                        "title": pt.title,
                        "priority": pt.priority_rank,
                        "completed": log.completed if log else False,
                        "actual_mins": log.actual_mins if log else 0,
                        "reflection": log.completion_note if log else None
                    })

            # Fetch Reflections
            ref_result = await db.execute(
                select(ReflectionEntry, ReflectionTemplate)
                .outerjoin(ReflectionTemplate, ReflectionEntry.template_id == ReflectionTemplate.id)
                .filter(
                    ReflectionEntry.user_id == user_id,
                    ReflectionEntry.entry_date >= start_date,
                    ReflectionEntry.entry_date <= end_date
                )
            )
            for entry, template in ref_result:
                d_str = entry.entry_date.isoformat()
                
                # Map UUID keys to human-readable question text
                readable_answers = {}
                if template and template.questions:
                    q_map = {q['id']: q['text'] for q in template.questions}
                    for q_id, ans in entry.answers.items():
                        q_text = q_map.get(str(q_id), f"Question_{str(q_id)[:8]}")
                        # If ans is a dict, get the text or rating; otherwise use it directly
                        if isinstance(ans, dict):
                            readable_answers[q_text] = ans.get('text') if ans.get('text') is not None else ans.get('rating')
                        else:
                            readable_answers[q_text] = ans
                else:
                    readable_answers = entry.answers # Fallback to raw if no template

                if d_str in date_map:
                    date_map[d_str]["reflection"] = {
                        "mood": entry.mood_score,
                        "energy": entry.energy_score,
                        "notes": readable_answers
                    }
                
                report_data["reflections"].append({
                    "date": d_str,
                    "mood": entry.mood_score,
                    "energy": entry.energy_score,
                    "answers": readable_answers
                })

            report_data["time_series_data"] = list(date_map.values())

            # 3. Streak Data
            streaks_result = await db.execute(
                select(Streak, HabitTemplate)
                .join(HabitTemplate, Streak.habit_id == HabitTemplate.id)
                .filter(
                    Streak.user_id == user_id,
                    HabitTemplate.is_active == True,
                    HabitTemplate.deleted_at == None,
                    (Streak.current_streak > 0) | (Streak.longest_streak > 0)
                )
            )
            for s, template in streaks_result:
                report_data["streak_data"].append({
                    "habit": template.name,
                    "current": s.current_streak,
                    "longest": s.longest_streak
                })

        # --- EXPORT GENERATION ---

        if format_ == "json":
            output_path = os.path.join(storage_dir, f"report_{job_id}.json")
            with open(output_path, "w") as f:
                json.dump(report_data, f, indent=2)
            return output_path

        elif format_ == "csv":
            # For CSV, we'll create a ZIP with multiple tables to avoid data loss
            zip_path = os.path.join(storage_dir, f"report_{job_id}.zip")
            with zipfile.ZipFile(zip_path, 'w') as zf:
                # 1. Daily Summary CSV
                summary_io = io.StringIO()
                writer = csv.writer(summary_io)
                writer.writerow(["Date", "Total_Score", "Habit_Score", "Task_Score", "Reflection_Score", "Mood", "Energy"])
                for d in report_data["time_series_data"]:
                    ref = d["reflection"] or {}
                    writer.writerow([
                        d["date"], d["score"], 
                        d["breakdown"]["habits"], d["breakdown"]["tasks"], d["breakdown"]["reflection"],
                        ref.get("mood", ""), ref.get("energy", "")
                    ])
                zf.writestr("daily_summary.csv", summary_io.getvalue())

                # 2. Detailed Habit Logs CSV
                habit_io = io.StringIO()
                writer = csv.writer(habit_io)
                writer.writerow(["Date", "Habit_Name", "Status", "Value", "Notes"])
                for d in report_data["time_series_data"]:
                    for h in d["habits_logged"]:
                        writer.writerow([d["date"], h["name"], h["status"], h["value"], h["notes"] or ""])
                zf.writestr("habit_details.csv", habit_io.getvalue())

                # 3. Detailed Task Logs CSV
                task_io = io.StringIO()
                writer = csv.writer(task_io)
                writer.writerow(["Date", "Task_Title", "Priority", "Completed", "Actual_Mins", "Reflection_Note"])
                for d in report_data["time_series_data"]:
                    for t in d["tasks"]:
                        writer.writerow([d["date"], t["title"], t["priority"], t["completed"], t["actual_mins"], t["reflection"] or ""])
                zf.writestr("task_details.csv", task_io.getvalue())

            return zip_path

        elif format_ == "pdf" and WEASYPRINT_AVAILABLE:
            # Enhanced PDF template mirroring the JSON richness
            html_content = f"""
            <html>
                <head>
                    <style>
                        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1f2937; background: #fff; }}
                        .header {{ border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }}
                        h1 {{ color: #4f46e5; margin: 0; font-size: 28px; }}
                        .meta {{ color: #6b7280; font-size: 14px; margin-top: 5px; }}
                        .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }}
                        .card {{ background: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; }}
                        .card-label {{ font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }}
                        .card-value {{ font-size: 24px; font-weight: 800; color: #111827; margin-top: 5px; }}
                        .section {{ margin-bottom: 40px; page-break-inside: avoid; }}
                        h2 {{ font-size: 20px; border-left: 4px solid #4f46e5; padding-left: 12px; margin-bottom: 20px; }}
                        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
                        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }}
                        th {{ background: #f3f4f6; font-weight: bold; color: #374151; }}
                        .status-pill {{ padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }}
                        .completed {{ background: #dcfce7; color: #166534; }}
                        .missed {{ background: #fee2e2; color: #991b1b; }}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>DisciplineOS Performance Report</h1>
                        <p class="meta">User: {report_data['user_profile']['username']} | Period: {report_data['period']}</p>
                    </div>

                    <div class="summary-grid">
                        <div class="card">
                            <div class="card-label">Avg Discipline Score</div>
                            <div class="card-value">{report_data['summary_metrics']['average_discipline_score']}</div>
                        </div>
                        <div class="card">
                            <div class="card-label">Top Habit</div>
                            <div class="card-value" style="font-size: 18px;">{report_data['summary_metrics']['top_performing_habit']}</div>
                        </div>
                        <div class="card">
                            <div class="card-label">Most Improved</div>
                            <div class="card-value" style="font-size: 18px;">{report_data['summary_metrics']['lowest_performing_habit']}</div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Daily Performance Trend</h2>
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Score</th><th>Habits</th><th>Tasks</th><th>Reflection</th></tr>
                            </thead>
                            <tbody>
                                {"".join([f"<tr><td>{d['date']}</td><td><strong>{d['score']:.1f}</strong></td><td>{d['breakdown']['habits']:.1f}</td><td>{d['breakdown']['tasks']:.1f}</td><td>{d['breakdown']['reflection']:.1f}</td></tr>" for d in report_data["time_series_data"] if d['score'] > 0])}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Streak Consistency</h2>
                        <table>
                            <thead>
                                <tr><th>Habit</th><th>Current Streak</th><th>Best Streak</th></tr>
                            </thead>
                            <tbody>
                                {"".join([f"<tr><td>{s['habit']}</td><td>{s['current']} days</td><td>{s['longest']} days</td></tr>" for s in report_data["streak_data"]])}
                            </tbody>
                        </table>
                    </div>
                    
                    <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 40px;">
                        Generated by DisciplineOS AI Engine on {report_data['generated_at']}
                    </p>
                </body>
            </html>
            """
            output_path = os.path.join(storage_dir, f"report_{job_id}.pdf")
            HTML(string=html_content).write_pdf(output_path)
            return output_path

        elif format_ == "pdf" and FPDF_AVAILABLE:
            # Basic PDF fallback using fpdf2 (No external drivers needed)
            output_path = os.path.join(storage_dir, f"report_{job_id}.pdf")
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Arial", "B", 16)
            pdf.cell(0, 10, "DisciplineOS Performance Report", ln=True, align="C")
            pdf.set_font("Arial", "", 10)
            pdf.cell(0, 10, f"User: {report_data['user_profile']['username']} | Period: {report_data['period']}", ln=True, align="C")
            pdf.ln(10)
            
            # Summary
            pdf.set_font("Arial", "B", 12)
            pdf.cell(0, 10, "Summary Metrics", ln=True)
            pdf.set_font("Arial", "", 10)
            pdf.cell(0, 8, f"Average Discipline Score: {report_data['summary_metrics']['average_discipline_score']}", ln=True)
            pdf.cell(0, 8, f"Top Performing Habit: {report_data['summary_metrics']['top_performing_habit']}", ln=True)
            pdf.ln(5)
            
            # Table Header
            pdf.set_font("Arial", "B", 10)
            pdf.cell(40, 10, "Date", border=1)
            pdf.cell(30, 10, "Score", border=1)
            pdf.cell(30, 10, "Habits", border=1)
            pdf.cell(30, 10, "Tasks", border=1)
            pdf.cell(30, 10, "Reflection", border=1)
            pdf.ln()
            
            pdf.set_font("Arial", "", 10)
            for d in report_data["time_series_data"]:
                if d["score"] > 0:
                    pdf.cell(40, 10, d["date"], border=1)
                    pdf.cell(30, 10, f"{d['score']:.1f}", border=1)
                    pdf.cell(30, 10, f"{d['breakdown']['habits']:.1f}", border=1)
                    pdf.cell(30, 10, f"{d['breakdown']['tasks']:.1f}", border=1)
                    pdf.cell(30, 10, f"{d['breakdown']['reflection']:.1f}", border=1)
                    pdf.ln()
            
            pdf.output(output_path)
            return output_path

        # Default fallback to TXT
        output_path = os.path.join(storage_dir, f"report_{job_id}.txt")
        with open(output_path, "w") as f:
            f.write(f"DisciplineOS Executive Summary\n")
            f.write(f"User: {report_data['user_profile']['username']}\n")
            f.write(f"Avg Score: {report_data['summary_metrics']['average_discipline_score']}\n\n")
            for d in report_data["time_series_data"]:
                if d["score"] > 0:
                    f.write(f"{d['date']}: {d['score']} (Mood: {d['reflection']['mood'] if d['reflection'] else 'N/A'})\n")
        return output_path
        
    except Exception as e:
        print(f"[REPORT ERROR] Task failed for job {job_id}: {str(e)}")
        traceback.print_exc()
        return None
