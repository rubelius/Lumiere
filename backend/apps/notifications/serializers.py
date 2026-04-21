from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer para notificações"""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'message', 'priority',
            'action_url', 'action_text', 'data',
            'read', 'read_at', 'dismissed',
            'created_at', 'expires_at'
        ]
        read_only_fields = ['id', 'created_at']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer para preferências de notificação"""
    
    class Meta:
        model = NotificationPreference
        exclude = ['id', 'user']