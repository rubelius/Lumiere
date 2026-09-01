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

# O autodiscovery procura um módulo `tasks` DENTRO de cada app instalada. Aqui
# as tasks moram em `apps/tasks/<assunto>.py`, e `apps.tasks` não é uma app
# instalada — então nada disso era encontrado e o beat disparava tarefas não
# registradas. Importar explicitamente é o que as torna conhecidas.
app.conf.imports = (
    'apps.tasks.backup',
    'apps.tasks.cache',
    'apps.tasks.downloads',
    'apps.tasks.integrations',
    'apps.tasks.ml',
    'apps.tasks.recommendations',
    'apps.tasks.sessions',
    'apps.tasks.torrents',
)

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
    
    # Traz para o acervo o que entrou na conta Real-Debrid por fora do
    # Lumière. Minuto 15 para não competir com as tarefas do minuto 0.
    'sync-realdebrid-account': {
        'task': 'apps.tasks.downloads.sync_realdebrid_account',
        'schedule': crontab(minute=15),
    },
    
    # DESATIVADAS: apontavam para tasks que não existem. apps/tasks/sessions.py
    # só tem o stub `prepare_session`, então o beat disparava NotRegistered a
    # cada hora e a cada 30 min. Reativar quando as tasks forem escritas.
    # 'prepare-upcoming-sessions': {
    #     'task': 'apps.tasks.sessions.auto_prepare_sessions',
    #     'schedule': crontab(minute=0, hour='*/1'),
    # },
    # 'send-session-reminders': {
    #     'task': 'apps.tasks.sessions.send_session_reminders',
    #     'schedule': crontab(minute='*/30'),
    # },
    
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