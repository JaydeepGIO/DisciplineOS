from celery.schedules import crontab

BEAT_SCHEDULE = {
    "check-broken-streaks-nightly": {
        "task": "app.workers.tasks.streak_tasks.check_broken_streaks",
        "schedule": crontab(hour=0, minute=1), # 00:01 UTC
    },
    "aggregate-weekly-scores-sunday": {
        "task": "app.workers.tasks.analytics_tasks.aggregate_weekly_scores",
        "schedule": crontab(hour=0, minute=5, day_of_week="sunday"), # Sunday 00:05 UTC
    },
    "aggregate-monthly-scores-1st": {
        "task": "app.workers.tasks.analytics_tasks.aggregate_monthly_scores",
        "schedule": crontab(hour=0, minute=10, day_of_month="1"), # 1st of each month 00:10 UTC
    },
    "send-habit-reminders": {
        "task": "app.workers.tasks.notification_tasks.send_habit_reminders",
        "schedule": crontab(minute="*"), # Every minute
    },
    "update-time-block-statuses": {
        "task": "app.workers.tasks.time_block_tasks.update_time_block_statuses",
        "schedule": crontab(minute="*"), # Every minute
    }
}
