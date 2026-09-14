import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from pgvector.django import VectorField

from apps.ml.constants import EMBEDDING_DIMENSIONS


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
    # Jellyfin
    jellyfin_server_url = models.URLField(blank=True)
    jellyfin_token = models.CharField(max_length=255, blank=True)
    jellyfin_user_id = models.CharField(max_length=64, blank=True)
    # OpenSubtitles — guardamos o token, nunca a senha: ela é trocada por
    # token uma vez, no momento de conectar a conta.
    opensubtitles_api_key = models.CharField(max_length=255, blank=True)
    opensubtitles_username = models.CharField(max_length=100, blank=True)
    opensubtitles_token = models.CharField(max_length=512, blank=True)
    # Real-Debrid
    realdebrid_api_key = models.CharField(max_length=255, blank=True)
    # Prowlarr
    prowlarr_url = models.URLField(blank=True)
    prowlarr_api_key = models.CharField(max_length=255, blank=True)

    # ── tocar direto do torrent ──────────────────────────────────────────
    #
    # Desligado por padrão, e é escolha de produto: tocar direto do torrent põe
    # o IP desta máquina no enxame, visível a qualquer outro par. O Real-Debrid
    # não faz isso — ele baixa em nome do usuário e entrega por HTTP, e o
    # enxame nunca vê a máquina de casa. Ligar por padrão seria tomar essa
    # decisão por quem não leu o aviso.
    torrent_direto_permitido = models.BooleanField(default=False)

    # Quanto disco o cache de torrent pode ocupar, em bytes. `0` é ilimitado:
    # baixa o filme inteiro e não apaga nada.
    #
    # Dez gigabytes é o padrão, e não é um número redondo por acaso — foi
    # medido que esta máquina tem 11 GB livres. Quem tiver mais disco muda na
    # tela; quem quiser guardar os filmes põe zero.
    torrent_cache_bytes = models.BigIntegerField(default=10 * 1024 ** 3)
    # ML
    taste_profile_embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)
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