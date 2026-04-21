# apps/sessions/consumers.py

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class SessionConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer para atualizações de sessão em tempo real
    """
    
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'session_{self.session_id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial session state
        session_data = await self.get_session_data()
        await self.send(text_data=json.dumps({
            'type': 'session_state',
            'data': session_data
        }))
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Recebe mensagens do WebSocket"""
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
    
    async def session_update(self, event):
        """Envia atualização de sessão para WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'session_update',
            'data': event['data']
        }))
    
    async def download_progress(self, event):
        """Envia progresso de download"""
        await self.send(text_data=json.dumps({
            'type': 'download_progress',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def get_session_data(self):
        """Busca dados da sessão do banco"""
        from apps.sessions.models import CinemaSession
        from apps.sessions.serializers import CinemaSessionDetailSerializer
        
        try:
            session = CinemaSession.objects.get(id=self.session_id)
            serializer = CinemaSessionDetailSerializer(session)
            return serializer.data
        except CinemaSession.DoesNotExist:
            return None