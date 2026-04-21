import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class SessionTheme(models.Model):
    """Temas pré-definidos para sessões de cinema"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    emoji = models.CharField(max_length=10, default='🎬')
    
    # Criteria
    genres = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    countries = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    decades = ArrayField(models.IntegerField(), blank=True, default=list)
    directors = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    moods = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    keywords = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    
    is_predefined = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'session_themes'
        ordering = ['name']
    
    def __str__(self):
        return f'{self.emoji} {self.name}'


class CinemaSession(models.Model):
    """Sessão de cinema com filmes e configurações"""
    STATUS_CHOICES = [
        ('planning', 'Planning'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    THEME_TYPE_CHOICES = [
        ('predefined', 'Predefined'),
        ('custom', 'Custom'),
        ('ai_generated', 'AI Generated'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cinema_sessions')
    
    # Basic Info
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    emoji = models.CharField(max_length=10, default='🎬')
    
    # Scheduling
    scheduled_date = models.DateTimeField()
    estimated_duration_minutes = models.IntegerField(null=True, blank=True)
    actual_start_time = models.DateTimeField(null=True, blank=True)
    actual_end_time = models.DateTimeField(null=True, blank=True)
    
    # Theme
    theme_type = models.CharField(max_length=50, choices=THEME_TYPE_CHOICES)
    theme = models.ForeignKey(SessionTheme, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Custom Theme Criteria
    theme_genres = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    theme_countries = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    theme_decades = ArrayField(models.IntegerField(), blank=True, default=list)
    theme_directors = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    theme_actors = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    theme_moods = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    theme_keywords = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    
    # AI Theme
    ai_theme_prompt = models.TextField(blank=True)
    ai_theme_explanation = models.TextField(blank=True)
    
    # Quality Requirements
    min_resolution = models.CharField(max_length=20, default='1080p')
    prefer_remux = models.BooleanField(default=True)
    require_advanced_audio = models.BooleanField(default=False)
    preferred_audio_codecs = ArrayField(models.CharField(max_length=50), blank=True, default=list)
    require_hdr = models.BooleanField(default=False)
    max_file_size_gb = models.IntegerField(null=True, blank=True)
    
    # Automation
    auto_prepare = models.BooleanField(default=True)
    prepare_hours_before = models.IntegerField(default=24)
    auto_download = models.BooleanField(default=True)
    send_reminders = models.BooleanField(default=True)
    reminder_hours_before = models.IntegerField(default=2)
    
    # Status
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='planning')
    all_movies_selected = models.BooleanField(default=False)
    all_torrents_found = models.BooleanField(default=False)
    all_downloads_ready = models.BooleanField(default=False)
    playlist_created = models.BooleanField(default=False)
    preparation_progress = models.IntegerField(default=0)  # 0-100
    download_progress = models.IntegerField(default=0)  # 0-100
    
    # Plex Integration
    plex_playlist_id = models.CharField(max_length=100, blank=True)
    
    # Social
    is_public = models.BooleanField(default=False)
    shared_with_users = ArrayField(models.UUIDField(), blank=True, default=list)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'cinema_sessions'
        ordering = ['-scheduled_date']
        indexes = [
            models.Index(fields=['user', 'scheduled_date']),
            models.Index(fields=['status']),
            models.Index(fields=['scheduled_date']),
        ]
    
    def __str__(self):
        return f'{self.emoji} {self.name} - {self.scheduled_date.date()}'


class SessionMovie(models.Model):
    """Filme dentro de uma sessão de cinema"""
    DOWNLOAD_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('searching', 'Searching'),
        ('found', 'Found'),
        ('downloading', 'Downloading'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(CinemaSession, on_delete=models.CASCADE, related_name='session_movies')
    movie = models.ForeignKey('movies.Movie', on_delete=models.CASCADE)
    
    # Order
    order = models.IntegerField()
    
    # Selected Release
    selected_release = models.ForeignKey('movies.TorrentRelease', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Download Status
    download_status = models.CharField(max_length=50, choices=DOWNLOAD_STATUS_CHOICES, default='pending')
    download_progress = models.IntegerField(default=0)  # 0-100
    
    # Notes
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'session_movies'
        ordering = ['order']
        unique_together = [['session', 'movie']]
        indexes = [
            models.Index(fields=['session', 'order']),
        ]
    
    def __str__(self):
        return f'{self.order}. {self.movie.title} ({self.movie.year})'