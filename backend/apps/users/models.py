import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from pgvector.django import VectorField


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Profile
    display_name = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(blank=True)
    bio = models.CharField(max_length=500, blank=True)
    # Letterboxd
    letterboxd_username = models.CharField(max_length=50, unique=True, null=True, blank=True)
    letterboxd_connected = models.BooleanField(default=False)
    letterboxd_last_sync = models.DateTimeField(null=True, blank=True)
    # Plex
    plex_token = models.CharField(max_length=255, blank=True)
    plex_server_url = models.URLField(blank=True)
    plex_last_sync = models.DateTimeField(null=True, blank=True)
    # Real-Debrid
    realdebrid_api_key = models.CharField(max_length=255, blank=True)
    # Prowlarr
    prowlarr_url = models.URLField(blank=True)
    prowlarr_api_key = models.CharField(max_length=255, blank=True)
    # ML
    taste_profile_embedding = VectorField(dimensions=768, null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    # Status
    is_premium = models.BooleanField(default=False)
    premium_until = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['letterboxd_username']),
        ]