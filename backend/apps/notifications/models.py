# Create your models here.
import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Notification(models.Model):
    """Notificação para usuário"""
    
    TYPE_CHOICES = [
        ('session_ready', 'Session Ready'),
        ('session_reminder', 'Session Reminder'),
        ('download_complete', 'Download Complete'),
        ('download_failed', 'Download Failed'),
        ('letterboxd_synced', 'Letterboxd Synced'),
        ('recommendation_new', 'New Recommendations'),
        ('movie_added_plex', 'Movie Added to Plex'),
        ('system', 'System Notification'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    
    # Content
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    
    # Links
    action_url = models.CharField(max_length=500, blank=True)
    action_text = models.CharField(max_length=100, blank=True)
    
    # Related objects (generic)
    related_session_id = models.UUIDField(null=True, blank=True)
    related_movie_id = models.UUIDField(null=True, blank=True)
    
    # Metadata
    data = models.JSONField(default=dict, blank=True)
    
    # Status
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    dismissed = models.BooleanField(default=False)
    
    # Delivery
    sent_email = models.BooleanField(default=False)
    sent_push = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'read']),
            models.Index(fields=['type']),
        ]
    
    def __str__(self):
        return f"{self.type}: {self.title}"
    
    def mark_as_read(self):
        """Marca como lida"""
        if not self.read:
            from django.utils import timezone
            self.read = True
            self.read_at = timezone.now()
            self.save(update_fields=['read', 'read_at'])


class NotificationPreference(models.Model):
    """Preferências de notificação do usuário"""
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # In-app
    enable_in_app = models.BooleanField(default=True)
    
    # Email
    enable_email = models.BooleanField(default=True)
    email_session_reminders = models.BooleanField(default=True)
    email_downloads = models.BooleanField(default=True)
    email_recommendations = models.BooleanField(default=False)
    email_weekly_digest = models.BooleanField(default=True)
    
    # Push
    enable_push = models.BooleanField(default=False)
    push_session_reminders = models.BooleanField(default=True)
    push_downloads = models.BooleanField(default=True)
    
    # Frequency
    digest_frequency = models.CharField(
        max_length=20,
        choices=[
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('never', 'Never'),
        ],
        default='weekly'
    )
    
    class Meta:
        db_table = 'notification_preferences'
    
    def __str__(self):
        return f"Preferences for {self.user.username}"