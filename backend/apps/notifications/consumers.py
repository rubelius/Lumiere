# apps/notifications/consumers.py

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer para notificações em tempo real"""
    
    async def connect(self):
        # Resolve o erro do TypedDict e garante fallback seguro
        self.user = self.scope.get('user')  # type: ignore
        
        if not self.user or not getattr(self.user, 'is_authenticated', False):
            await self.close()
            return
        
        self.room_group_name = f'notifications_{self.user.id}'
        
        # Join notifications group
        await self.channel_layer.group_add(  # type: ignore
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send unread count on connect
        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': unread_count
        }))
    
    # Assinatura corrigida para bater exatamente com a classe base (code ao invés de close_code)
    async def disconnect(self, code):
        # Leave group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(  # type: ignore
                self.room_group_name,
                self.channel_name
            )
    
    # Assinatura corrigida para bater com a classe base (text_data=None, bytes_data=None)
    async def receive(self, text_data=None, bytes_data=None):
        """Handle messages from WebSocket"""
        if not text_data:
            return
            
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
            
            # STUB 3: Adicionados manipuladores para ações do front-end via WS
            elif message_type == 'mark_read':
                notification_id = data.get('notification_id')
                if notification_id:
                    await self.mark_notification_read(notification_id)
                    # Atualiza a contagem no cliente
                    unread_count = await self.get_unread_count()
                    await self.send(text_data=json.dumps({
                        'type': 'unread_count',
                        'count': unread_count
                    }))
                    
            elif message_type == 'mark_all_read':
                await self.mark_all_read()
                await self.send(text_data=json.dumps({
                    'type': 'unread_count',
                    'count': 0
                }))
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received in WebSocket")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
    
    async def notification_message(self, event):
        """Send notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': event['notification']
        }))
    
    @database_sync_to_async
    def get_unread_count(self):
        """Get unread notifications count"""
        from .models import Notification
        return Notification.objects.filter(
            user=self.user,
            read=False
        ).count()
        
    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Marca uma notificação específica como lida"""
        from .models import Notification
        try:
            notification = Notification.objects.get(id=notification_id, user=self.user)
            notification.read = True
            notification.save(update_fields=['read'])
        except Notification.DoesNotExist:
            pass
            
    @database_sync_to_async
    def mark_all_read(self):
        """Marca todas as notificações do usuário como lidas"""
        from .models import Notification
        Notification.objects.filter(user=self.user, read=False).update(read=True)