from celery import shared_task

@shared_task
def prepare_session(session_id: str):
    pass