from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification, NotificationPreference
from .serializers import (NotificationPreferenceSerializer,
                          NotificationSerializer)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para notificações do usuário"""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        """Retorna apenas notificações do usuário"""
        return Notification.objects.filter(
            user=self.request.user
        )
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Conta notificações não lidas"""
        count = self.get_queryset().filter(read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marca notificação como lida"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Marca todas como lidas"""
        updated = self.get_queryset().filter(read=False).update(
            read=True,
            read_at=timezone.now()
        )
        return Response({'marked_read': updated})
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dispensa notificação"""
        notification = self.get_object()
        notification.dismissed = True
        notification.save()
        return Response({'status': 'dismissed'})
    
    @action(detail=False, methods=['get'])
    def preferences(self, request):
        """Retorna preferências do usuário"""
        prefs, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(prefs)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_preferences(self, request):
        """Atualiza preferências"""
        prefs, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(
            prefs,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)