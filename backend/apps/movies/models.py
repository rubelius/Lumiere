import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from pgvector.django import HnswIndex, VectorField

from apps.ml.constants import EMBEDDING_DIMENSIONS

class Movie(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    # --------------------------------------------------------
    # 1. BASIC INFO
    # --------------------------------------------------------
    title = models.CharField(max_length=500)
    original_title = models.CharField(max_length=500, blank=True)
    alternative_titles = models.JSONField(default=list, blank=True, null=True) # <-- Movido pra cá
    year = models.IntegerField(null=True, blank=True)
    length_minutes = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=200, blank=True)
    countries = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    spoken_languages = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    color = models.CharField(max_length=10, blank=True)
    
    # --------------------------------------------------------
    # 2. CLASSIFICATION & THEMES
    # --------------------------------------------------------
    genres = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    primary_genre = models.CharField(max_length=100, blank=True)
    themes = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    moods = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    keywords = ArrayField(models.CharField(max_length=100), blank=True, default=list)
    mpaa_rating = models.CharField(max_length=20, blank=True, help_text="R, PG-13, etc")
    festivals = models.JSONField(default=list, blank=True, help_text="Premiações e Festivais (ex: Cannes, Oscars)")
    
    # --------------------------------------------------------
    # 3. CAST, CREW & PRODUCTION
    # --------------------------------------------------------
    director = models.CharField(max_length=500, blank=True)
    co_directors = ArrayField(models.CharField(max_length=200), blank=True, default=list)
    cinematographer = models.CharField(max_length=255, blank=True, null=True) # <-- Movido pra cá
    composer = models.CharField(max_length=255, blank=True, null=True)        # <-- Movido pra cá
    writer = models.CharField(max_length=255, blank=True, null=True)          # <-- Movido pra cá
    cast = models.JSONField(default=list, blank=True, help_text="Atores e personagens")
    crew = models.JSONField(default=list, blank=True, help_text="Equipe técnica principal")
    production_companies = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    
    # --------------------------------------------------------
    # 4. RANKINGS & HISTORY (TSPDT)
    # --------------------------------------------------------
    tspdt_id = models.CharField(max_length=20, null=True, blank=True, unique=True)
    ranking_current = models.IntegerField(null=True, blank=True, help_text="Ranking mais recente")
    tspdt_history = models.JSONField(default=dict, blank=True, help_text="Ex: {'2008': 100, '2025': 45}")
    
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
    logo_url = models.URLField(max_length=500, blank=True, null=True) # <-- Movido pra cá
    collection_name = models.CharField(max_length=200, blank=True, null=True)
    
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
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)
    embedding_model = models.CharField(max_length=100, blank=True)
    
    # --------------------------------------------------------
    # 9. AVAILABILITY & STATS
    # --------------------------------------------------------
    streaming_providers = models.JSONField(default=list, blank=True, null=True) # <-- Movido pra cá
    in_plex = models.BooleanField(default=False)
    # A chave do filme dentro do servidor Plex. É lida em
    # apps/integrations/views.py para montar a playlist de uma sessão, e era
    # escrita em dois lugares — mas não existia no modelo: a atribuição na
    # task não fazia nada, e o `save(update_fields=[...])` da view levantava
    # ValueError no primeiro filme que casasse.
    plex_rating_key = models.CharField(max_length=64, blank=True, default='')
    # Campo morto: nada no projeto escreve ou lê. Mantido para não perder
    # dado antigo, mas quem quer saber do Real-Debrid olha os dois abaixo.
    in_realdebrid = models.BooleanField(default=False)
    # "Já dá play": tem cópia na conta do Real-Debrid, com link.
    available_instantly = models.BooleanField(default=False)
    # "Um clique e dá play": o acervo do Real-Debrid tem o arquivo, mas
    # ele ainda não foi importado para a conta. É um terceiro estado —
    # anunciá-lo como OFFLINE esconde as cópias mais fáceis de conseguir.
    cached_in_realdebrid = models.BooleanField(default=False)
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

    # --------------------------------------------------------
    # 11. OMDB & EXTRA METADATA
    # --------------------------------------------------------
    omdb_checked = models.BooleanField(default=False, help_text="Evita gastar cota da API OMDb duas vezes no mesmo filme")
    rotten_tomatoes_rating = models.CharField(max_length=20, blank=True, null=True)
    metacritic_rating = models.CharField(max_length=20, blank=True, null=True)
    awards_summary = models.CharField(max_length=500, blank=True, null=True, help_text="Texto bruto do OMDb. Ex: Won 3 Oscars...")
    
    # --------------------------------------------------------
    # 12. CINEPHILE & WIKIDATA METADATA
    # --------------------------------------------------------
    wikidata_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    mubi_id = models.CharField(max_length=50, blank=True, null=True, help_text="ID oficial da MUBI")
    aspect_ratio = models.CharField(max_length=50, blank=True, null=True)
    filming_locations = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    bechdel_status = models.CharField(max_length=50, blank=True, null=True, help_text="Passed / Failed / etc")
    wikidata_checked = models.BooleanField(default=False)

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
            # Sem índice, cada busca por similaridade varre os 25 mil vetores.
            # Tolerável para uma consulta; inviável para o cálculo em massa que
            # o recomendador exige. HNSW porque a extensão instalada é 0.8.1 e
            # ele dispensa a etapa de treino que o IVFFlat pede.
            HnswIndex(
                name='movie_embedding_hnsw',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.year})"

class TorrentRelease(models.Model):
    # ... Mantenha o resto do seu modelo TorrentRelease exatamente como estava ...
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name='torrent_releases')
    info_hash = models.CharField(max_length=40, unique=True)
    
    title = models.CharField(max_length=500)
    size_bytes = models.BigIntegerField()
    magnet_link = models.TextField(blank=True)
    
    indexer_id = models.IntegerField(null=True, blank=True)
    indexer_name = models.CharField(max_length=100, blank=True)
    
    resolution = models.CharField(max_length=20, blank=True)
    is_remux = models.BooleanField(default=False)
    is_4k = models.BooleanField(default=False)
    has_hdr = models.BooleanField(default=False)
    has_hdr10_plus = models.BooleanField(default=False)
    has_dolby_vision = models.BooleanField(default=False)
    video_codec = models.CharField(max_length=50, blank=True)
    video_bitrate_kbps = models.IntegerField(null=True, blank=True)
    
    audio_codec = models.CharField(max_length=100, blank=True)
    has_atmos = models.BooleanField(default=False)
    has_dtsx = models.BooleanField(default=False)
    has_truehd = models.BooleanField(default=False)
    has_dts_hd_ma = models.BooleanField(default=False)
    audio_channels = models.CharField(max_length=10, blank=True)
    audio_bitrate_kbps = models.IntegerField(null=True, blank=True)
    audio_languages = ArrayField(models.CharField(max_length=50), blank=True, default=list)
    
    subtitle_languages = ArrayField(models.CharField(max_length=50), blank=True, default=list)
    has_hardcoded_subs = models.BooleanField(default=False)
    
    release_group = models.CharField(max_length=100, blank=True)
    release_type = models.CharField(max_length=50, blank=True)
    is_scene = models.BooleanField(default=False)
    edition = models.CharField(max_length=100, blank=True)
    is_proper = models.BooleanField(default=False)
    is_repack = models.BooleanField(default=False)
    
    seeders = models.IntegerField(default=0)
    leechers = models.IntegerField(default=0)
    upload_date = models.DateTimeField(null=True, blank=True)
    
    quality_score = models.IntegerField(default=0)
    video_score = models.IntegerField(default=0)
    audio_score = models.IntegerField(default=0)
    hdr_score = models.IntegerField(default=0)
    release_score = models.IntegerField(default=0)
    seeds_score = models.IntegerField(default=0)
    
    in_realdebrid = models.BooleanField(default=False)
    realdebrid_id = models.CharField(max_length=100, blank=True)
    realdebrid_status = models.CharField(max_length=50, blank=True)
    realdebrid_progress = models.IntegerField(default=0)
    realdebrid_added_at = models.DateTimeField(null=True, blank=True)
    realdebrid_completed_at = models.DateTimeField(null=True, blank=True)
    realdebrid_links = models.JSONField(default=list, blank=True)
    
    # "O acervo do Real-Debrid tem este arquivo, e importar seria instantâneo."
    # A fonte mudou: era `/torrents/instantAvailability`, que o provedor
    # desativou, e hoje é a sondagem de apps/movies/realdebrid_cache.py.
    # `instant_check_at` diz quando foi a última resposta — sem isso, uma marca
    # de meses atrás pareceria fresca.
    instantly_available = models.BooleanField(default=False)
    instant_check_at = models.DateTimeField(null=True, blank=True)
    
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
    
    # Estados do Real-Debrid para um torrent. 'downloaded' é o único em que o
    # arquivo já existe na conta e pode tocar; o resto ainda depende de algo.
    ESTADOS_CONCLUIDOS = ('downloaded',)
    ESTADOS_MORTOS = ('error', 'magnet_error', 'virus', 'dead')

    PRONTA = 'pronta'
    INSTANTANEA = 'instantanea'
    BAIXANDO = 'baixando'
    AUSENTE = 'ausente'

    @property
    def disponibilidade(self) -> str:
        """
        Em que pé esta cópia está, do ponto de vista de quem quer assistir.

        Duas flags — `in_realdebrid` e `realdebrid_status` — respondem
        perguntas diferentes, e cada tela combinava as suas por conta própria.

        - `pronta`: está na conta e completa, com link. Toca agora.
        - `instantanea`: não está na conta, mas o acervo do Real-Debrid tem o
          arquivo — importar leva segundos.
        - `baixando`: já foi enviada, e o Real-Debrid ainda está buscando.
        - `ausente`: nem uma coisa nem outra. Importar pode demorar, ou nem
          completar.

        A diferença entre `pronta` e `instantanea` é de conta, não de espera; a
        que separa as duas de `ausente` é a que importa na hora de escolher.

        `instantanea` chegou a ser removido: vinha de
        `/torrents/instantAvailability`, que o provedor desativou (403,
        error_code 37). Voltou com outra fonte, em
        apps/movies/realdebrid_cache.py — uma sondagem que adiciona o magnet,
        observa se o Real-Debrid entrega os metadados na hora, e desfaz o que
        criou. Medido: 2 segundos para responder, contra os 9 que o caso sem
        resposta leva para desistir.
        """
        if self.in_realdebrid and self.realdebrid_status in self.ESTADOS_CONCLUIDOS:
            return self.PRONTA
        if self.in_realdebrid and self.realdebrid_status not in self.ESTADOS_MORTOS:
            return self.BAIXANDO
        if self.instantly_available:
            return self.INSTANTANEA
        return self.AUSENTE

    @property
    def pode_importar(self) -> bool:
        """
        Se faz sentido oferecer o botão de enviar ao Real-Debrid.

        Não basta o estado: sem magnet link não há o que enviar. As cópias
        descobertas pela sincronização com o Real-Debrid nascem sem magnet
        — vêm de torrents que já estão na conta —, então oferecer importar
        para elas é um botão que só sabe dar erro.
        """
        if not self.magnet_link:
            return False
        return self.disponibilidade == self.AUSENTE

    # De onde vem cada ponto, e quanto vale no máximo. A tela precisa poder
    # responder "por que 57 e não 90?" sem que ninguém abra o código.
    TETOS_DO_SCORE = (
        ('video', 'Vídeo', 30),
        ('audio', 'Áudio', 40),
        ('hdr', 'HDR', 15),
        ('release', 'Grupo', 10),
        ('seeds', 'Semeadores', 5),
    )

    @property
    def motivos_do_score(self) -> list:
        """
        A conta do score, parcela a parcela.

        Um REMUX 2160p somando 57 parece defeito e quase nunca é: são 30 de
        vídeo, que é o teto, e o que falta costuma estar no áudio sem Atmos, na
        ausência de Dolby Vision e num torrent sem semeadores. Sem a conta à
        vista, a única leitura possível é desconfiar do número.
        """
        motivos = {
            'video': self._motivo_do_video(),
            'audio': self._motivo_do_audio(),
            'hdr': self._motivo_do_hdr(),
            'release': self._motivo_do_grupo(),
            'seeds': (f'{self.seeders} semeando' if self.seeders
                      else 'ninguém semeando'),
        }
        return [
            {
                'chave': chave,
                'rotulo': rotulo,
                'pontos': getattr(self, f'{chave}_score', 0) or 0,
                'teto': teto,
                'motivo': motivos[chave],
            }
            for chave, rotulo, teto in self.TETOS_DO_SCORE
        ]

    def _motivo_do_video(self) -> str:
        if self.is_remux:
            return 'remux, sem recompressão'
        if self.is_4k:
            return '2160p recomprimido'
        return self.resolution or 'resolução não identificada'

    def _motivo_do_audio(self) -> str:
        if self.has_atmos:
            faixa = 'Dolby Atmos'
        elif self.has_dtsx:
            faixa = 'DTS:X'
        elif self.audio_codec:
            faixa = self.audio_codec
        else:
            faixa = 'áudio não identificado no nome'
        canais = f', {self.audio_channels}' if self.audio_channels else ''
        return f'{faixa}{canais}'

    def _motivo_do_hdr(self) -> str:
        if self.has_dolby_vision:
            return 'Dolby Vision'
        if self.has_hdr10_plus:
            return 'HDR10+'
        if self.has_hdr:
            return 'HDR10'
        return 'sem HDR'

    def _motivo_do_grupo(self) -> str:
        return self.release_group or 'grupo não identificado no nome'


    def __str__(self):
        return f'{self.title} [{self.quality_score}/100]'
    
    @property
    def size_gb(self):
        return round(self.size_bytes / (1024**3), 2)

class WatchHistory(models.Model):
    """
    O que este usuário já viu, e onde parou.

    O projeto só sabia o que o Letterboxd importou — sinal de fora, que chega
    atrasado e depende de o usuário manter um diário lá. Sem registro próprio
    não dá para marcar um filme como visto na tela, nem para tirar da frente o
    que já foi visto quando o recomendador sugere, nem para o perfil de gosto
    aprender com o que aconteceu no próprio player.

    Uma linha por (usuário, filme): rever é comum numa cinemateca e conta como
    sinal mais forte, então revisão incrementa `times_watched` em vez de criar
    linha nova. Assim a pergunta "já vi?", que roda em toda listagem, continua
    sendo um EXISTS barato.
    """

    ORIGENS = [
        ('player', 'Assistido no player'),
        ('letterboxd', 'Importado do diário Letterboxd'),
        ('manual', 'Marcado à mão'),
    ]

    # Fração da duração a partir da qual o filme conta como visto. Créditos,
    # pós-crédito e o costume de parar antes do fim fazem 100% quase nunca
    # acontecer; exigir o fim exato deixaria o histórico praticamente vazio.
    FRACAO_PARA_CONCLUIR = 0.9

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watch_history')
    movie = models.ForeignKey(
        'Movie', on_delete=models.CASCADE, related_name='watches')

    first_watched_at = models.DateTimeField(auto_now_add=True)
    last_watched_at = models.DateTimeField(auto_now=True)
    times_watched = models.PositiveIntegerField(default=0)

    # Onde parou, para retomar. Guardado em segundos porque é o que o elemento
    # <video> entrega, e converter na gravação perderia precisão à toa.
    progress_seconds = models.PositiveIntegerField(default=0)
    runtime_seconds = models.PositiveIntegerField(
        default=0, help_text='Duração real do arquivo, que costuma divergir do metadado.')

    completed = models.BooleanField(
        default=False,
        help_text='Passou de FRACAO_PARA_CONCLUIR. É isto que a interface chama de "assistido".')
    source = models.CharField(max_length=20, choices=ORIGENS, default='player')
    rating = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name_plural = 'Watch histories'
        constraints = [
            models.UniqueConstraint(fields=['user', 'movie'], name='um_registro_por_filme_por_usuario'),
        ]
        indexes = [
            # A listagem pergunta "quais destes filmes este usuário já viu?"
            # para cada página do acervo; sem índice isso varre a tabela.
            models.Index(fields=['user', 'completed']),
            models.Index(fields=['user', '-last_watched_at']),
        ]

    def __str__(self):
        estado = 'visto' if self.completed else f'{self.fracao_assistida:.0%}'
        return f'{self.user} — {self.movie} ({estado})'

    @property
    def fracao_assistida(self) -> float:
        """Quanto do filme foi visto, de 0 a 1. Zero quando a duração é desconhecida."""
        if not self.runtime_seconds:
            return 0.0
        return min(1.0, self.progress_seconds / self.runtime_seconds)

    def registra_progresso(self, segundos: int, duracao: int) -> bool:
        """
        Anota onde o usuário está e devolve se ISTO concluiu o filme agora.

        Devolver "concluiu agora" em vez de "está concluído" é o que permite
        ao chamador reagir uma única vez — retreinar o perfil de gosto a cada
        ping de progresso de um filme já visto seria trabalho repetido sem
        nenhuma informação nova.
        """
        self.progress_seconds = max(0, int(segundos))
        if duracao > 0:
            self.runtime_seconds = int(duracao)

        concluiu_agora = (
            not self.completed
            and self.fracao_assistida >= self.FRACAO_PARA_CONCLUIR
        )
        if concluiu_agora:
            self.completed = True
            self.times_watched += 1

        return concluiu_agora
