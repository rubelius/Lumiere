import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


class NotificationService:
    """Serviço centralizado para criar e enviar notificações"""
    
    @staticmethod
    def create_notification(
        user,
        notification_type: str,
        title: str,
        message: str,
        priority: str = 'medium',
        action_url: str = '',
        action_text: str = '',
        data: dict = None,
        related_session_id=None,
        related_movie_id=None,
        send_email: bool = False,
        send_push: bool = False
    ):
        """
        Cria notificação e opcionalmente envia email/push
        
        Args:
            user: User object
            notification_type: Tipo da notificação
            title: Título
            message: Mensagem
            priority: low, medium, high, urgent
            action_url: URL para ação (opcional)
            action_text: Texto do botão de ação (opcional)
            data: Dados adicionais JSON
            related_session_id: ID da sessão relacionada
            related_movie_id: ID do filme relacionado
            send_email: Enviar email
            send_push: Enviar push notification
        
        Returns:
            Notification object
        """
        # Check user preferences
        try:
            prefs = user.notification_preferences
        except NotificationPreference.DoesNotExist:
            # Create default preferences
            prefs = NotificationPreference.objects.create(user=user)
        
        # Create notification
        notification = Notification.objects.create(
            user=user,
            type=notification_type,
            title=title,
            message=message,
            priority=priority,
            action_url=action_url,
            action_text=action_text,
            data=data or {},
            related_session_id=related_session_id,
            related_movie_id=related_movie_id,
        )
        
        # Send email if requested and enabled
        if send_email and prefs.enable_email:
            NotificationService._send_email(notification)
        
        # Send push if requested and enabled
        if send_push and prefs.enable_push:
            NotificationService._send_push(notification)
        
        # Send WebSocket update
        NotificationService._send_websocket(notification)
        
        return notification
    
    @staticmethod
    def _send_email(notification: Notification):
        """Envia notificação por email"""
        try:
            subject = f"[Lumière] {notification.title}"
            
            # Render HTML email
            html_message = render_to_string('emails/notification.html', {
                'notification': notification,
                'user': notification.user,
                'site_url': settings.FRONTEND_URL,
            })
            
            # Plain text fallback
            plain_message = f"{notification.title}\n\n{notification.message}"
            
            if notification.action_url:
                plain_message += f"\n\n{notification.action_text or 'View'}: {notification.action_url}"
            
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[notification.user.email],
                html_message=html_message,
                fail_silently=False,
            )
            
            notification.sent_email = True
            notification.save(update_fields=['sent_email'])
            
            logger.info(f"Email sent for notification {notification.id}")
        
        except Exception as e:
            logger.error(f"Failed to send email for notification {notification.id}: {e}")
    
    @staticmethod
    def _send_push(notification: Notification):
        """Envia push notification (implementar com Firebase FCM ou similar)"""
        try:
            # TODO: Implementar com Firebase Cloud Messaging
            # from firebase_admin import messaging
            
            # message = messaging.Message(
            #     notification=messaging.Notification(
            #         title=notification.title,
            #         body=notification.message,
            #     ),
            #     token=notification.user.fcm_token,
            # )
            
            # messaging.send(message)
            
            notification.sent_push = True
            notification.save(update_fields=['sent_push'])
            
            logger.info(f"Push sent for notification {notification.id}")
        
        except Exception as e:
            logger.error(f"Failed to send push for notification {notification.id}: {e}")
    
    @staticmethod
    def _send_websocket(notification: Notification):
        """Envia notificação via WebSocket"""
        from apps.notifications.serializers import NotificationSerializer
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        
        channel_layer = get_channel_layer()
        
        # Send to user's notification channel
        async_to_sync(channel_layer.group_send)(
            f'notifications_{notification.user.id}',
            {
                'type': 'notification_message',
                'notification': NotificationSerializer(notification).data
            }
        )
    
    # Convenience methods for common notifications
    
    @staticmethod
    def notify_session_ready(user, session):
        """Notifica que sessão está pronta"""
        return NotificationService.create_notification(
            user=user,
            notification_type='session_ready',
            title='🎬 Session Ready!',
            message=f'Your session "{session.name}" is ready to watch. All movies downloaded!',
            priority='high',
            action_url=f'/sessions/{session.id}',
            action_text='View Session',
            related_session_id=session.id,
            send_email=True,
            send_push=True,
        )
    
    @staticmethod
    def notify_session_reminder(user, session, hours_before):
        """Lembra usuário sobre sessão próxima"""
        return NotificationService.create_notification(
            user=user,
            notification_type='session_reminder',
            title='⏰ Session Starting Soon',
            message=f'"{session.name}" starts in {hours_before} hours!',
            priority='medium',
            action_url=f'/sessions/{session.id}',
            action_text='View Session',
            related_session_id=session.id,
            send_email=True,
            send_push=True,
        )
    
    @staticmethod
    def notify_download_complete(user, movie, session=None):
        """Notifica download completo"""
        message = f'Download complete for "{movie.title}" ({movie.year})'
        
        if session:
            message += f' in session "{session.name}"'
        
        return NotificationService.create_notification(
            user=user,
            notification_type='download_complete',
            title='✅ Download Complete',
            message=message,
            priority='low',
            action_url=f'/movies/{movie.id}',
            action_text='View Movie',
            related_movie_id=movie.id,
            related_session_id=session.id if session else None,
            send_email=False,
            send_push=True,
        )
    
    @staticmethod
    def notify_new_recommendations(user, count):
        """Notifica novas recomendações"""
        return NotificationService.create_notification(
            user=user,
            notification_type='recommendation_new',
            title='✨ New Recommendations',
            message=f'We found {count} new movies you might love!',
            priority='low',
            action_url='/recommendations',
            action_text='View Recommendations',
            send_email=False,
            send_push=False,
        )