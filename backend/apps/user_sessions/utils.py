# apps/sessions/utils.py

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_session_update(session_id: str, data: dict):
    """
    Envia atualização de sessão via WebSocket
    
    Usage:
        send_session_update(
            session_id=str(session.id),
            data={'status': 'preparing', 'progress': 25}
        )
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'session_{session_id}',
        {
            'type': 'session_update',
            'data': data
        }
    )


def send_download_progress(session_id: str, movie_id: str, progress: int):
    """Envia progresso de download"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'session_{session_id}',
        {
            'type': 'download_progress',
            'data': {
                'movie_id': movie_id,
                'progress': progress
            }
        }
    )