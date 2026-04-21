import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class APIKey(models.Model):
    """API Key para integrações externas"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='api_keys'
    )
    
    name = models.CharField(max_length=200)
    key = models.CharField(max_length=64, unique=True)
    
    is_active = models.BooleanField(default=True)
    
    # Permissions
    can_read = models.BooleanField(default=True)
    can_write = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    
    # Usage tracking
    last_used = models.DateTimeField(null=True, blank=True)
    total_requests = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'api_keys'
        ordering = ['-created_at']
    
    @classmethod
    def generate_key(cls):
        """Gera API key segura"""
        return secrets.token_urlsafe(48)
    
    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.generate_key()
        super().save(*args, **kwargs)