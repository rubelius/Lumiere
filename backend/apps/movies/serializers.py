from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Movie, TorrentRelease, WatchHistory
from .utils import calculate_quality_score, parse_quality_from_title


def campos_da_listagem() -> list:
    """
    Colunas que a listagem precisa carregar do banco.

    Derivada de MovieListSerializer para não haver duas listas divergindo: um
    campo lido pelo serializer e ausente do `.only()` vira consulta extra por
    filme, sem erro e com o resultado certo — só cem vezes mais caro.

    Campo calculado fica de fora: `watched` não é coluna, e pedi-lo ao
    `.only()` derruba a listagem inteira com FieldDoesNotExist. Filtrar pelo
    modelo preserva a derivação — continua não havendo duas listas para manter
    em sincronia — e ainda protege de qualquer campo calculado futuro.
    """
    colunas = {f.name for f in Movie._meta.get_fields()}
    return [c for c in MovieListSerializer.Meta.fields if c in colunas]


def ids_assistidos(user, filmes) -> set:
    """
    Quais destes filmes o usuário já viu, numa consulta só.

    A alternativa óbvia — perguntar por filme dentro do serializer — é o N+1
    que já custou caro nesta listagem antes: uma página de 20 cards viraria 21
    consultas, e o resultado sairia correto, que é justamente o que faz esse
    tipo de defeito passar despercebido.
    """
    if not (user and getattr(user, 'is_authenticated', False)):
        return set()

    ids = [f.id for f in filmes if getattr(f, 'id', None)]
    if not ids:
        return set()

    return set(
        WatchHistory.objects.filter(user=user, movie_id__in=ids, completed=True)
        .values_list('movie_id', flat=True)
    )


class MovieListSerializer(serializers.ModelSerializer):
    """
    Serializer otimizado para as listas (Home e Library).
    Traz apenas o essencial para montar cards bonitos e ricos em detalhes visuais,
    mas deixa listas gigantes (cast, alternative_titles) de fora para não pesar a rede.
    """
    watched = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField)
    def get_watched(self, obj) -> bool:
        """
        Se este usuário já viu o filme.

        Lê o conjunto que a view montou numa consulta só. Sem esse conjunto no
        contexto responde False, e não vai ao banco: um fallback silencioso por
        filme reintroduziria exatamente o N+1 que o `only()` desta listagem já
        causou uma vez — resultado certo, custo cem vezes maior, nada acusando.
        """
        return obj.id in self.context.get('assistidos', frozenset())

    class Meta:
        model = Movie
        fields = [
            'watched',
            'id', 'title', 'original_title', 'overview', 'year', 'director', 
            'poster_url', 'ranking_current', 'tmdb_rating',
            'length_minutes', 'background_url', 'country', 'tagline', 'in_plex', 'genres', 'trailer_url',
            
            # ── METADADOS PREMIUM EXPOSTOS PARA A LISTA ──
            'logo_url', 'cinematographer', 'composer', 'writer', 'streaming_providers',
            'mpaa_rating', 'color', 'collection_name' 
        ]

class MovieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movie
        exclude = ['embedding', 'embedding_model']

class TorrentReleaseSerializer(serializers.ModelSerializer):
    # ReadOnlyField nao carrega tipo: o schema saía como string
    size_gb = serializers.FloatField(read_only=True)
    class Meta:
        model = TorrentRelease
        fields = [
            'id', 'info_hash', 'title', 'size_bytes', 'size_gb',
            'resolution', 'is_remux', 'is_4k', 'has_hdr', 'has_dolby_vision',
            'video_codec', 'audio_codec', 'has_atmos', 'has_dtsx',
            'audio_channels', 'release_group', 'seeders', 'leechers',
            'quality_score', 'video_score', 'audio_score', 'hdr_score',
            'instantly_available', 'in_realdebrid', 'realdebrid_status',
            'realdebrid_progress', 'found_at'
        ]
        read_only_fields = [
            'quality_score', 'video_score', 'audio_score', 
            'hdr_score', 'release_score', 'seeds_score'
        ]
    
    def create(self, validated_data):
        quality_data = parse_quality_from_title(validated_data['title'])
        validated_data.update(quality_data)
        scores = calculate_quality_score(validated_data)
        validated_data.update(scores)
        return super().create(validated_data)


class PlaybackSourceSerializer(serializers.Serializer):
    """Fonte de reprodução resolvida na ordem Real-Debrid > Jellyfin > Plex."""

    source = serializers.ChoiceField(choices=['realdebrid', 'jellyfin', 'plex'])
    stream_url = serializers.URLField()
    label = serializers.CharField()
    container = serializers.CharField(allow_null=True)
    quality = serializers.CharField(allow_blank=True)


class SubtitleSerializer(serializers.Serializer):
    """Legenda disponível no OpenSubtitles para um filme."""

    file_id = serializers.IntegerField()
    nome = serializers.CharField()
    idioma = serializers.CharField()
    downloads = serializers.IntegerField()
    hearing_impaired = serializers.BooleanField()
    do_upload_do_autor = serializers.BooleanField()
    release = serializers.CharField(allow_blank=True)


class SimilarMovieSerializer(serializers.Serializer):
    """Forma de cada item de MovieDetailSerializer.similar_movies."""
    movie = MovieListSerializer(read_only=True)
    similarity = serializers.FloatField(read_only=True)
    type = serializers.CharField(read_only=True)
    watched = serializers.BooleanField(read_only=True)


class WatchStateSerializer(serializers.ModelSerializer):
    """Onde o usuário parou, para o player retomar."""
    fraction = serializers.SerializerMethodField()

    class Meta:
        model = WatchHistory
        fields = ['progress_seconds', 'runtime_seconds', 'completed',
                  'times_watched', 'fraction', 'last_watched_at']
        read_only_fields = fields

    @extend_schema_field(serializers.FloatField)
    def get_fraction(self, obj) -> float:
        return round(obj.fracao_assistida, 4)


class MovieDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pesado para a página individual do filme.
    Expõe todo o modelo menos o embedding, então o frontend já recebe:
    - cast (Atores com fotos)
    - alternative_titles (Outros nomes do filme)
    - budget & revenue (Orçamento e Bilheteria)
    - tspdt_history (O gráfico histórico de evolução do filme)
    """
    # Mantemos o nome 'current_ranking' aqui pro frontend antigo não quebrar
    current_ranking = serializers.SerializerMethodField() 
    best_releases = serializers.SerializerMethodField()
    similar_movies = serializers.SerializerMethodField()
    watch_state = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        # 'embedding' e um vetor de EMBEDDING_DIMENSIONS posicoes, usado so pelo recomendador:
        # dezenas de KB por filme na rede quando preenchido, e nenhum cliente le.
        exclude = ['embedding', 'embedding_model']
    
    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_current_ranking(self, obj):
        return obj.ranking_current
    
    @extend_schema_field(TorrentReleaseSerializer(many=True))
    def get_best_releases(self, obj):
        """
        As melhores cópias, pela nota de qualidade que o acervo já calcula.

        Faltava o ORDER BY: `list(...)[:5]` devolvia cinco quaisquer, e o
        campo chama-se `best_releases`. Um REMUX 2160p e um WEB-DL 720p têm a
        mesma chance de aparecer numa consulta sem ordenação — e a tela
        apresentava o resultado como se fosse a seleção do melhor.

        Cacheada no Real-Debrid desempata: entre duas cópias de nota
        parecida, a que toca agora vale mais que a que exigiria baixar.
        """
        melhores = (
            obj.torrent_releases
            .order_by('-in_realdebrid', '-quality_score', '-seeders')[:5]
        )
        return TorrentReleaseSerializer(melhores, many=True).data
    
    @extend_schema_field(WatchStateSerializer(allow_null=True))
    def get_watch_state(self, obj):
        """
        Onde este usuário parou neste filme.

        Vai no detalhe para o player não precisar de uma segunda ida ao
        servidor só para saber de onde retomar — a informação chega junto com
        a ficha que ele já pede.
        """
        usuario = getattr(self.context.get('request'), 'user', None)
        if not (usuario and getattr(usuario, 'is_authenticated', False)):
            return None

        registro = WatchHistory.objects.filter(user=usuario, movie=obj).first()
        return WatchStateSerializer(registro).data if registro else None

    @extend_schema_field(SimilarMovieSerializer(many=True))
    def get_similar_movies(self, obj):
        from apps.ml.models import MovieSimilarity
        from apps.ml.similarity import desprioriza_assistidos, diversifica

        # Sem order_by o Postgres devolve na ordem que quiser. Hoje sai certo
        # porque as linhas foram inseridas em ordem de similaridade, mas isso
        # é acidente do arranjo físico, não garantia — e o acidente acaba na
        # primeira vez que uma dessas linhas for reescrita.
        vizinhos = list(
            MovieSimilarity.objects.filter(movie=obj)
            .select_related('similar_movie').order_by('-overall_similarity')
        )

        # Uma consulta para as 50 vizinhanças, não uma por card.
        usuario = getattr(self.context.get('request'), 'user', None)
        assistidos = ids_assistidos(usuario, [v.similar_movie for v in vizinhos])

        # O que já foi visto desce ANTES de diversificar e cortar: descer
        # depois do corte não mudaria nada, porque o que interessa é quem
        # ocupa as dez vagas.
        similarities = diversifica(
            desprioriza_assistidos(vizinhos, assistidos),
            limite=10,
        )

        return [{
            'movie': MovieListSerializer(
                sim.similar_movie, context={'assistidos': assistidos}).data,
            'similarity': float(sim.overall_similarity) if sim.overall_similarity is not None else 0.0,
            'type': str(sim.similarity_type),
            'watched': sim.similar_movie_id in assistidos,
        } for sim in similarities]


class TorrentReleaseCreateSerializer(serializers.Serializer):
    movie_id = serializers.UUIDField()
    releases = serializers.ListField(child=serializers.DictField(), min_length=1)
    
    def create(self, validated_data):
        movie_id = validated_data['movie_id']
        releases_data = validated_data['releases']
        instances_to_create = []
        
        for release_data in releases_data:
            quality_data = parse_quality_from_title(release_data['title'])
            release_data.update(quality_data)
            scores = calculate_quality_score(release_data)
            release_data.update(scores)
            release_data['movie_id'] = movie_id
            
            valid_fields = {k: v for k, v in release_data.items() if hasattr(TorrentRelease, k)}
            instances_to_create.append(TorrentRelease(**valid_fields))
        
        created_instances = TorrentRelease.objects.bulk_create(
            instances_to_create, ignore_conflicts=True, batch_size=500
        )
        return TorrentReleaseSerializer(created_instances, many=True).data

class ProgressoSerializer(serializers.Serializer):
    """
    O que o player reporta enquanto o filme roda.

    Os dois valores vêm do elemento <video> (`currentTime` e `duration`), em
    segundos e fracionários. A duração vem do arquivo, não do metadado do
    acervo: um REMUX costuma divergir do `length_minutes` do TMDB em minutos,
    e é a do arquivo que diz onde o filme de fato acaba.
    """
    position = serializers.FloatField(min_value=0)
    duration = serializers.FloatField(min_value=0, required=False, default=0)


class WatchHistorySerializer(serializers.ModelSerializer):
    """Estado de exibição devolvido ao player depois de gravar o progresso."""
    fraction = serializers.SerializerMethodField()

    class Meta:
        model = WatchHistory
        fields = ['movie', 'completed', 'times_watched', 'progress_seconds',
                  'runtime_seconds', 'fraction', 'last_watched_at']
        read_only_fields = fields

    @extend_schema_field(serializers.FloatField)
    def get_fraction(self, obj) -> float:
        return round(obj.fracao_assistida, 4)


class ArchiveStatsSerializer(serializers.Serializer):
    """
    Números do acervo, para a home poder exibi-los sem inventá-los.

    `hours` é a soma real das durações, não a contagem de filmes vezes 1.8;
    `countries` é a contagem distinta, não a constante 92.
    """
    movies = serializers.IntegerField(read_only=True)
    hours = serializers.IntegerField(read_only=True)
    countries = serializers.IntegerField(read_only=True)
