import asyncio
from celery import shared_task
from ...services.report_service import generate_user_report

def run_async(coro):
    return asyncio.run(coro)

@shared_task(name="app.workers.tasks.report_tasks.generate_report")
def generate_report(user_id: str, job_id: str, config: dict):
    return run_async(generate_user_report(user_id, job_id, config))
