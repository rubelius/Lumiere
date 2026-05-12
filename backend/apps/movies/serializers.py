from rest_framework import serializers
from .models import Movie, TorrentRelease
from .utils import calculate_quality_score, parse_quality_from_title


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
        fields = '__all__'

class MovieDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pesado para a página individual do filme.
    Como usa '__all__', o Frontend já tem acesso automático a:
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
        fields = '__all__'
    
    def get_current_ranking(self, obj):
        return obj.ranking_current
    
    def get_best_releases(self, obj):
        releases = list(obj.torrent_releases.all())[:5]
        return TorrentReleaseSerializer(releases, many=True).data
    
    def get_similar_movies(self, obj):
        from apps.ml.models import MovieSimilarity
        similarities = MovieSimilarity.objects.filter(
            movie=obj
        ).select_related('similar_movie')[:10]
        
        return [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            'similarity': float(sim.overall_similarity) if sim.overall_similarity is not None else 0.0,
            'type': str(sim.similarity_type)
        } for sim in similarities]


class TorrentReleaseSerializer(serializers.ModelSerializer):
    size_gb = serializers.ReadOnlyField()
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