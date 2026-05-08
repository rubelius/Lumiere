import uuid

from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from pgvector.django import VectorField


class Movie(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    # --------------------------------------------------------
    # 1. BASIC INFO
    # --------------------------------------------------------
    title = models.CharField(max_length=500)
    original_title = models.CharField(max_length=500, blank=True)
    year = models.IntegerField(null=True, blank=True)
    length_minutes = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=200, blank=True)
    countries = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    spoken_languages = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    color = models.CharField(max_length=10, blank=True)  # Col, BW, Mixed
    
    # --------------------------------------------------------
    # 2. CLASSIFICATION & THEMES
    # --------------------------------------------------------
    genres = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    primary_genre = models.CharField(max_length=100, blank=True)
    themes = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    moods = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    keywords = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    mpaa_rating = models.CharField(max_length=20, blank=True, help_text="R, PG-13, etc")
    
    # --------------------------------------------------------
    # 3. CAST, CREW & PRODUCTION
    # --------------------------------------------------------
    director = models.CharField(max_length=500, blank=True)
    co_directors = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    cast = models.JSONField(default=list, blank=True, help_text="Atores e personagens")
    crew = models.JSONField(default=list, blank=True, help_text="Equipe técnica principal")
    production_companies = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    
    # --------------------------------------------------------
    # 4. RANKINGS & HISTORY (TSPDT)
    # --------------------------------------------------------
    tspdt_id = models.CharField(max_length=20, null=True, blank=True, unique=True)
    ranking_current = models.IntegerField(null=True, blank=True, help_text="Ranking mais recente (ex: 2026)")
    tspdt_history = models.JSONField(default=dict, blank=True, help_text="Histórico completo de rankings ex: {'2008': 100, '2025': 45}")
    
    # --------------------------------------------------------
    # 5. EXTERNAL IDs
    # --------------------------------------------------------
    imdb_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    tmdb_id = models.IntegerField(unique=True, null=True, blank=True)
    letterboxd_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    # --------------------------------------------------------
    # 6. ENHANCED METADATA (Visuals & Context)
    # --------------------------------------------------------
    overview = models.TextField(blank=True)
    tagline = models.CharField(max_length=500, blank=True)
    poster_url = models.URLField(blank=True, max_length=500)
    background_url = models.URLField(blank=True, max_length=500)
    trailer_url = models.URLField(blank=True, max_length=500)
    collection_name = models.CharField(max_length=200, blank=True, null=True, help_text="Ex: The Lord of the Rings Collection")
    
    # Financials
    budget = models.BigIntegerField(null=True, blank=True)
    revenue = models.BigIntegerField(null=True, blank=True)
    
    # --------------------------------------------------------
    # 7. RATINGS
    # --------------------------------------------------------
    tmdb_rating = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    tmdb_vote_count = models.IntegerField(null=True, blank=True)
    imdb_rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    imdb_vote_count = models.IntegerField(null=True, blank=True)
    letterboxd_rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    
    # --------------------------------------------------------
    # 8. ML EMBEDDINGS (AI Search)
    # --------------------------------------------------------
    embedding = VectorField(dimensions=768, null=True, blank=True)
    embedding_model = models.CharField(max_length=100, blank=True)
    
    # --------------------------------------------------------
    # 9. AVAILABILITY & STATS (Plex/Real-Debrid)
    # --------------------------------------------------------
    in_plex = models.BooleanField(default=False)
    in_realdebrid = models.BooleanField(default=False)
    available_instantly = models.BooleanField(default=False)
    best_quality_available = models.CharField(max_length=100, blank=True)
    current_quality_score = models.IntegerField(null=True, blank=True)
    upgradeable = models.BooleanField(default=False)
    view_count = models.IntegerField(default=0)
    search_count = models.IntegerField(default=0)
    
    # --------------------------------------------------------
    # 10. TIMESTAMPS
    # --------------------------------------------------------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_checked = models.DateTimeField(null=True, blank=True)
    metadata_updated_at = models.DateTimeField(null=True, blank=True)

    # ── METADADOS PREMIUM ──
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    cinematographer = models.CharField(max_length=255, blank=True, null=True)
    composer = models.CharField(max_length=255, blank=True, null=True)
    writer = models.CharField(max_length=255, blank=True, null=True)
    
    # Usamos JSONField para guardar listas (arrays) de forma segura em qualquer banco
    alternative_titles = models.JSONField(default=list, blank=True, null=True)
    streaming_providers = models.JSONField(default=list, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['ranking_current', 'year']),
            models.Index(fields=['year', 'director']),
            models.Index(fields=['primary_genre', 'year']),
            GinIndex(fields=['genres']),
            GinIndex(fields=['keywords']),
            GinIndex(
                name='movie_search_idx',
                fields=['title'],
                opclasses=['gin_trgm_ops']
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.year})"



class TorrentRelease(models.Model):
    """Release de torrent com informações de qualidade"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name='torrent_releases')
    info_hash = models.CharField(max_length=40, unique=True)
    
    # Basic
    title = models.CharField(max_length=500)
    size_bytes = models.BigIntegerField()
    magnet_link = models.TextField(blank=True)
    
    # Indexer
    indexer_id = models.IntegerField(null=True, blank=True)
    indexer_name = models.CharField(max_length=100, blank=True)
    
    # Video Quality
    resolution = models.CharField(max_length=20, blank=True)  # 2160p, 1080p, 720p, 480p
    is_remux = models.BooleanField(default=False)
    is_4k = models.BooleanField(default=False)
    has_hdr = models.BooleanField(default=False)
    has_hdr10_plus = models.BooleanField(default=False)
    has_dolby_vision = models.BooleanField(default=False)
    video_codec = models.CharField(max_length=50, blank=True)  # HEVC, AVC, AV1
    video_bitrate_kbps = models.IntegerField(null=True, blank=True)
    
    # Audio Quality
    audio_codec = models.CharField(max_length=100, blank=True)
    has_atmos = models.BooleanField(default=False)
    has_dtsx = models.BooleanField(default=False)
    has_truehd = models.BooleanField(default=False)
    has_dts_hd_ma = models.BooleanField(default=False)
    audio_channels = models.CharField(max_length=10, blank=True)  # 7.1, 5.1, 2.0
    audio_bitrate_kbps = models.IntegerField(null=True, blank=True)
    audio_languages = ArrayField(models.CharField(max_length=50), blank=True, default=list)
    
    # Subtitles
    subtitle_languages = ArrayField(models.CharField(max_length=50), blank=True, default=list)
    has_hardcoded_subs = models.BooleanField(default=False)
    
    # Release Info
    release_group = models.CharField(max_length=100, blank=True)
    release_type = models.CharField(max_length=50, blank=True)  # remux, web-dl, bluray
    is_scene = models.BooleanField(default=False)
    edition = models.CharField(max_length=100, blank=True)  # Extended, Director's Cut
    is_proper = models.BooleanField(default=False)
    is_repack = models.BooleanField(default=False)
    
    # Availability
    seeders = models.IntegerField(default=0)
    leechers = models.IntegerField(default=0)
    upload_date = models.DateTimeField(null=True, blank=True)
    
    # Quality Scores (0-100)
    quality_score = models.IntegerField(default=0)  # Total score
    video_score = models.IntegerField(default=0)  # Max 30
    audio_score = models.IntegerField(default=0)  # Max 40
    hdr_score = models.IntegerField(default=0)  # Max 15
    release_score = models.IntegerField(default=0)  # Max 10
    seeds_score = models.IntegerField(default=0)  # Max 5
    
    # Real-Debrid Status
    in_realdebrid = models.BooleanField(default=False)
    realdebrid_id = models.CharField(max_length=100, blank=True)
    realdebrid_status = models.CharField(max_length=50, blank=True)  # downloading, downloaded, error
    realdebrid_progress = models.IntegerField(default=0)  # 0-100
    realdebrid_added_at = models.DateTimeField(null=True, blank=True)
    realdebrid_completed_at = models.DateTimeField(null=True, blank=True)
    realdebrid_links = models.JSONField(default=list, blank=True)  # Direct download links
    
    # Instant Availability
    instantly_available = models.BooleanField(default=False)
    instant_check_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    found_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seeder_check = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'torrent_releases'
        ordering = ['-quality_score', '-seeders']
        indexes = [
            models.Index(fields=['movie', '-quality_score']),
            models.Index(fields=['info_hash']),
            models.Index(fields=['resolution', 'is_remux', 'has_atmos']),
            models.Index(fields=['instantly_available']),
        ]
    
    def __str__(self):
        return f'{self.title} [{self.quality_score}/100]'
    
    @property
    def size_gb(self):
        return round(self.size_bytes / (1024**3), 2)