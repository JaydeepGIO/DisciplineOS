from celery import shared_task

@shared_task(name="app.workers.tasks.notification_tasks.send_habit_reminders")
def send_habit_reminders():
    # Stub for now
    pass
