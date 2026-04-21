from apps.movies.serializers import (MovieListSerializer,
                                     TorrentReleaseSerializer)
from rest_framework import serializers

from .models import CinemaSession, SessionMovie, SessionTheme


class SessionThemeSerializer(serializers.ModelSerializer):
    """Serializer para temas de sessão"""
    
    class Meta:
        model = SessionTheme
        fields = '__all__'


class SessionMovieSerializer(serializers.ModelSerializer):
    """Serializer para filmes dentro de uma sessão"""
    movie = MovieListSerializer(read_only=True)
    movie_id = serializers.UUIDField(write_only=True)
    selected_release = TorrentReleaseSerializer(read_only=True)
    
    class Meta:
        model = SessionMovie
        fields = [
            'id', 'movie', 'movie_id', 'order', 
            'selected_release', 'download_status', 
            'download_progress', 'notes'
        ]


class CinemaSessionListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de sessões"""
    movie_count = serializers.SerializerMethodField()
    theme_name = serializers.SerializerMethodField()
    first_movie_poster = serializers.SerializerMethodField()
    
    class Meta:
        model = CinemaSession
        fields = [
            'id', 'name', 'description', 'emoji', 'scheduled_date',
            'status', 'theme_type', 'theme_name', 'movie_count',
            'preparation_progress', 'download_progress',
            'estimated_duration_minutes', 'created_at',
            'first_movie_poster', 'all_downloads_ready'
        ]
    
    def get_movie_count(self, obj):
        return obj.session_movies.count()
    
    def get_theme_name(self, obj):
        return obj.theme.name if obj.theme else None
    
    def get_first_movie_poster(self, obj):
        """Retorna poster do primeiro filme para preview"""
        first = obj.session_movies.first()
        return first.movie.poster_url if first else None


class CinemaSessionDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhes de sessão"""
    session_movies = SessionMovieSerializer(many=True, read_only=True)
    theme = SessionThemeSerializer(read_only=True)
    movie_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = CinemaSession
        fields = '__all__'
        read_only_fields = [
            'user', 'status', 'all_movies_selected',
            'all_torrents_found', 'all_downloads_ready',
            'preparation_progress', 'download_progress',
            'created_at', 'updated_at'
        ]
    
    def create(self, validated_data):
        """Cria sessão com filmes"""
        movie_ids = validated_data.pop('movie_ids', [])
        validated_data['user'] = self.context['request'].user
        
        # Create session
        session = CinemaSession.objects.create(**validated_data)
        
        # Add movies
        for order, movie_id in enumerate(movie_ids):
            SessionMovie.objects.create(
                session=session,
                movie_id=movie_id,
                order=order
            )
        
        # Calculate estimated duration
        total_duration = sum([
            sm.movie.length_minutes or 0 
            for sm in session.session_movies.all()
        ])
        session.estimated_duration_minutes = total_duration
        session.all_movies_selected = len(movie_ids) > 0
        session.save()
        
        return session
    
    def update(self, instance, validated_data):
        """Atualiza sessão"""
        movie_ids = validated_data.pop('movie_ids', None)
        
        # Update session fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update movies if provided
        if movie_ids is not None:
            # Remove existing
            instance.session_movies.all().delete()
            
            # Add new
            for order, movie_id in enumerate(movie_ids):
                SessionMovie.objects.create(
                    session=instance,
                    movie_id=movie_id,
                    order=order
                )
        
        return instance