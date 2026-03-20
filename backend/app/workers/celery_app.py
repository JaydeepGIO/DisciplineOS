from celery import Celery
from ..config import settings

celery_app = Celery(
    "disciplineos",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.analytics_tasks",
        "app.workers.tasks.streak_tasks",
        "app.workers.tasks.report_tasks",
        "app.workers.tasks.notification_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule_filename="celerybeat-schedule",
)

# Import schedules
from .schedules import BEAT_SCHEDULE
celery_app.conf.beat_schedule = BEAT_SCHEDULE
