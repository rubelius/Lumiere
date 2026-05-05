import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class SessionConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer para atualizações de sessão em tempo real
    """
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        # SECURITY #1: Bloqueia conexões de usuários não autenticados
        if not self.user or not getattr(self.user, 'is_authenticated', False):
            await self.close()
            return

        self.session_id = self.scope['url_route']['kwargs']['session_id'] # type: ignore
        
        # SECURITY #1: Verifica se a sessão existe E se o usuário é o dono real dela ANTES de aceitar
        session_data = await self.verify_and_get_session()
        if not session_data:
            await self.close()
            return
        
        self.room_group_name = f'session_{self.session_id}'
        
        # Join room group
        await self.channel_layer.group_add(  # type: ignore
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial session state
        await self.send(text_data=json.dumps({
            'type': 'session_state',
            'data': session_data
        }))
    
    # Assinatura de código corrigida para o Strict mode do Pylance
    async def disconnect(self, code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(  # type: ignore
                self.room_group_name,
                self.channel_name
            )
    
    # Assinatura de código corrigida para o Strict mode do Pylance
    async def receive(self, text_data=None, bytes_data=None):
        """Recebe mensagens do WebSocket"""
        if not text_data:
            return
            
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            logger.error("Invalid JSON received in SessionConsumer")
        except Exception as e:
            logger.error(f"Error processing SessionConsumer message: {e}")
    
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
    def verify_and_get_session(self):
        """Busca dados da sessão do banco e valida posse de forma segura"""
        from apps.user_sessions.models import CinemaSession
        from apps.user_sessions.serializers import CinemaSessionDetailSerializer
        
        try:
            session = CinemaSession.objects.get(id=self.session_id)
            
            # SECURITY #1: Apenas o dono pode monitorar o estado da sessão via WebSocket
            if session.user_id != self.user.id: # type: ignore
                return None
                
            serializer = CinemaSessionDetailSerializer(session)
            return serializer.data
        except CinemaSession.DoesNotExist:
            return None