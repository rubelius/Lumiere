from rest_framework import serializers

from .models import Movie, TorrentRelease
from .utils import calculate_quality_score, parse_quality_from_title


class MovieListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagens de filmes"""
    current_ranking = serializers.SerializerMethodField()
    
    class Meta:
        model = Movie
        fields = [
            'id', 'title', 'original_title', 'year', 'director',
            'country', 'length_minutes', 'genres', 'primary_genre',
            'poster_url', 'backdrop_url', 'current_ranking',
            'tmdb_rating', 'imdb_rating', 'in_plex', 'available_instantly',
            'current_quality_score'
        ]
    
    def get_current_ranking(self, obj):
        """Retorna o ranking mais recente disponível"""
        return obj.ranking_2026 or obj.ranking_2025


class MovieDetailSerializer(serializers.ModelSerializer):
    """Serializer completo com todos os detalhes do filme"""
    current_ranking = serializers.SerializerMethodField()
    best_releases = serializers.SerializerMethodField()
    similar_movies = serializers.SerializerMethodField()
    
    class Meta:
        model = Movie
        fields = '__all__'
    
    def get_current_ranking(self, obj):
        return obj.ranking_2026 or obj.ranking_2025
    
    def get_best_releases(self, obj):
        """Retorna os 5 melhores releases disponíveis"""
        releases = obj.torrent_releases.all()[:5]
        return TorrentReleaseSerializer(releases, many=True).data
    
    def get_similar_movies(self, obj):
        """Retorna filmes similares (se existirem)"""
        from apps.ml.models import MovieSimilarity
        similarities = MovieSimilarity.objects.filter(
            movie=obj
        ).select_related('similar_movie')[:10]
        
        return [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            'similarity': float(sim.overall_similarity),
            'type': sim.similarity_type
        } for sim in similarities]


class TorrentReleaseSerializer(serializers.ModelSerializer):
    """Serializer para releases de torrent"""
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
        """Auto-parse quality from title on creation"""
        # Parse quality information
        quality_data = parse_quality_from_title(validated_data['title'])
        validated_data.update(quality_data)
        
        # Calculate quality scores
        scores = calculate_quality_score(validated_data)
        validated_data.update(scores)
        
        return super().create(validated_data)


class TorrentReleaseCreateSerializer(serializers.Serializer):
    """Serializer para criar múltiplos releases de uma vez"""
    movie_id = serializers.UUIDField()
    releases = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def create(self, validated_data):
        """Cria múltiplos releases e retorna lista"""
        movie_id = validated_data['movie_id']
        releases_data = validated_data['releases']
        
        created_releases = []
        for release_data in releases_data:
            release_data['movie_id'] = movie_id
            serializer = TorrentReleaseSerializer(data=release_data)
            serializer.is_valid(raise_exception=True)
            created_releases.append(serializer.save())
        
        return created_releases