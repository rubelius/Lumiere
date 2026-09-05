from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Movie, TorrentRelease
from .utils import calculate_quality_score, parse_quality_from_title


def campos_da_listagem() -> list:
    """
    Colunas que a listagem precisa carregar do banco.

    Derivada de MovieListSerializer para não haver duas listas divergindo: um
    campo lido pelo serializer e ausente do `.only()` vira consulta extra por
    filme, sem erro e com o resultado certo — só cem vezes mais caro.
    """
    return list(MovieListSerializer.Meta.fields)


class MovieListSerializer(serializers.ModelSerializer):
    """
    Serializer otimizado para as listas (Home e Library).
    Traz apenas o essencial para montar cards bonitos e ricos em detalhes visuais,
    mas deixa listas gigantes (cast, alternative_titles) de fora para não pesar a rede.
    """
    class Meta:
        model = Movie
        fields = [
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
        releases = list(obj.torrent_releases.all())[:5]
        return TorrentReleaseSerializer(releases, many=True).data
    
    @extend_schema_field(SimilarMovieSerializer(many=True))
    def get_similar_movies(self, obj):
        from apps.ml.models import MovieSimilarity
        from apps.ml.similarity import diversifica

        # Sem order_by o Postgres devolve na ordem que quiser. Hoje sai certo
        # porque as linhas foram inseridas em ordem de similaridade, mas isso
        # é acidente do arranjo físico, não garantia — e o acidente acaba na
        # primeira vez que uma dessas linhas for reescrita.
        #
        # Busca as 50 e corta para 10 depois de diversificar: cortar antes
        # deixaria a cota de diretor sem nada para escolher.
        similarities = diversifica(
            MovieSimilarity.objects.filter(movie=obj)
            .select_related('similar_movie').order_by('-overall_similarity'),
            limite=10,
        )
        
        return [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            'similarity': float(sim.overall_similarity) if sim.overall_similarity is not None else 0.0,
            'type': str(sim.similarity_type)
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