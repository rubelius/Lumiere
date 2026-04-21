# lumiere/celery.py

import os

from celery import Celery
from celery.schedules import crontab

# Set default Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumiere.settings')

app = Celery('lumiere')

# Load config from Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all apps
app.autodiscover_tasks()

# Periodic tasks schedule
app.conf.beat_schedule = {
    # Sync Letterboxd diaries every 6 hours
    'sync-letterboxd-diaries': {
        'task': 'apps.tasks.integrations.sync_all_letterboxd_diaries',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    
    # Check Real-Debrid downloads every 5 minutes
    'check-realdebrid-downloads': {
        'task': 'apps.tasks.downloads.check_realdebrid_status',
        'schedule': crontab(minute='*/5'),
    },
    
    # Prepare upcoming sessions (24h before)
    'prepare-upcoming-sessions': {
        'task': 'apps.tasks.sessions.auto_prepare_sessions',
        'schedule': crontab(minute=0, hour='*/1'),
    },
    
    # Send session reminders (2h before)
    'send-session-reminders': {
        'task': 'apps.tasks.sessions.send_session_reminders',
        'schedule': crontab(minute='*/30'),
    },
    
    # Retrain ML models daily at 3 AM
    'retrain-ml-models': {
        'task': 'apps.tasks.ml.retrain_all_users',
        'schedule': crontab(minute=0, hour=3),
    },
    
    # Update movie embeddings for new movies
    'update-movie-embeddings': {
        'task': 'apps.tasks.ml.update_movie_embeddings',
        'schedule': crontab(minute=0, hour=4),
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Task de debug"""
    print(f'Request: {self.request!r}')