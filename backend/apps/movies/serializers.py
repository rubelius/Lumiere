from rest_framework import serializers

from .models import Movie, TorrentRelease
from .utils import calculate_quality_score, parse_quality_from_title


class MovieListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagens de filmes"""
    current_ranking = serializers.SerializerMethodField()

    tmdb_rating = serializers.FloatField(allow_null=True, read_only=True)
    imdb_rating = serializers.FloatField(allow_null=True, read_only=True)
    letterboxd_rating = serializers.FloatField(allow_null=True, read_only=True)
    average_user_rating = serializers.FloatField(allow_null=True, read_only=True)
    
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

    tmdb_rating = serializers.FloatField(allow_null=True, read_only=True)
    imdb_rating = serializers.FloatField(allow_null=True, read_only=True)
    letterboxd_rating = serializers.FloatField(allow_null=True, read_only=True)
    average_user_rating = serializers.FloatField(allow_null=True, read_only=True)
    
    class Meta:
        model = Movie
        fields = '__all__'
    
    def get_current_ranking(self, obj):
        return obj.ranking_2026 or obj.ranking_2025
    
    def get_best_releases(self, obj):
        """Retorna os 5 melhores releases disponíveis usando cache do prefetch"""
        # Se os torrents já vieram na query principal do viewset, isso não bate no banco!
        releases = obj.torrent_releases.all()[:5]
        return TorrentReleaseSerializer(releases, many=True).data
    
    def get_similar_movies(self, obj):
        """Retorna filmes similares (se existirem) - N+1 Mitigado pelo detail view"""
        from apps.ml.models import MovieSimilarity
        similarities = MovieSimilarity.objects.filter(
            movie=obj
        ).select_related('similar_movie')[:10]
        
        return [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            # Garantindo conversão limpa se o dado vier nulo ou None
            'similarity': float(sim.overall_similarity) if sim.overall_similarity is not None else 0.0,
            'type': str(sim.similarity_type)
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
    """Serializer para criar múltiplos releases de uma vez - OTIMIZADO PARA BULK"""
    movie_id = serializers.UUIDField()
    releases = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def create(self, validated_data):
        """Cria múltiplos releases usando 1 query via bulk_create - CORREÇÃO N+1 #4"""
        movie_id = validated_data['movie_id']
        releases_data = validated_data['releases']
        
        instances_to_create = []
        
        for release_data in releases_data:
            # Roda as regras de negócio em memória, sem bater no banco
            quality_data = parse_quality_from_title(release_data['title'])
            release_data.update(quality_data)
            
            scores = calculate_quality_score(release_data)
            release_data.update(scores)
            
            # Adiciona o ID do filme e cria a instância na memória (sem salvar)
            release_data['movie_id'] = movie_id
            
            # Precisamos remover campos que não pertencem ao model (como info_hash duplicado se houver)
            valid_fields = {k: v for k, v in release_data.items() if hasattr(TorrentRelease, k)}
            instances_to_create.append(TorrentRelease(**valid_fields))
        
        # Salva tudo de uma vez ignorando conflitos de duplicatas (ex: info_hash repetido)
        # O batch_size evita estourar o limite de bytes do PostgreSQL em inserts muito grandes
        created_instances = TorrentRelease.objects.bulk_create(
            instances_to_create,
            ignore_conflicts=True, 
            batch_size=500
        )
        
        return TorrentReleaseSerializer(created_instances, many=True).data