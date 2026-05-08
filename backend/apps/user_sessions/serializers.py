from rest_framework import serializers
from django.db.models import Sum
from django.db import transaction
from apps.movies.serializers import MovieListSerializer, TorrentReleaseSerializer
from apps.movies.models import Movie
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


class CinemaSessionSerializer(serializers.ModelSerializer):
    """Serializer unificado e otimizado contra queries N+1"""
    movie_count = serializers.SerializerMethodField()
    theme = SessionThemeSerializer(read_only=True)
    first_movie_poster = serializers.SerializerMethodField()
    session_movies = serializers.SerializerMethodField()
    
    movie_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = CinemaSession
        fields = [
            'id', 'name', 'description', 'emoji', 'scheduled_date',
            'status', 'theme_type', 'theme', 'movie_count',
            'first_movie_poster', 'preparation_progress', 'download_progress',
            'estimated_duration_minutes', 'all_downloads_ready',
            'all_movies_selected', 'playlist_created',
            'session_movies', 'movie_ids', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'user', 'status', 'all_movies_selected',
            'all_torrents_found', 'all_downloads_ready',
            'preparation_progress', 'download_progress',
            'created_at', 'updated_at'
        ]

    def get_movie_count(self, obj):
        # OTIMIZAÇÃO: Usa o tamanho da lista que já tá na memória em vez de .count() no banco
        return len(obj.session_movies.all())

    def get_first_movie_poster(self, obj):
        movies = obj.session_movies.all()
        if movies:
            return movies[0].movie.poster_url if movies[0].movie else None
        return None

    def get_session_movies(self, obj):
        # OTIMIZAÇÃO CLAUDE: Só popula a lista de filmes se for a tela de detalhes (retrieve)
        if self.context.get('detail', False):
            return SessionMovieSerializer(
                obj.session_movies.all(),
                many=True,
                context=self.context
            ).data
        return None

    def create(self, validated_data):
        movie_ids = validated_data.pop('movie_ids', [])
        validated_data['user'] = self.context['request'].user

        # Usando transação atômica: ou tudo salva perfeito, ou o banco recusa
        with transaction.atomic():
            session = CinemaSession.objects.create(**validated_data)

            if movie_ids:
                existing_count = Movie.objects.filter(id__in=movie_ids).count()
                if existing_count != len(movie_ids):
                    raise serializers.ValidationError({'movie_ids': 'IDs inválidos.'})

                SessionMovie.objects.bulk_create([
                    SessionMovie(session=session, movie_id=movie_id, order=order)
                    for order, movie_id in enumerate(movie_ids)
                ])

                total_duration = Movie.objects.filter(id__in=movie_ids).aggregate(
                    total=Sum('length_minutes')
                )['total'] or 0

                session.estimated_duration_minutes = total_duration
                session.all_movies_selected = True
                session.save(update_fields=[
                    'estimated_duration_minutes', 
                    'all_movies_selected', 
                    'updated_at'
                ])

        return session

    def update(self, instance, validated_data):
        movie_ids = validated_data.pop('movie_ids', None)
        
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            
            if movie_ids is not None:
                instance.session_movies.all().delete()
                
                if movie_ids:
                    SessionMovie.objects.bulk_create([
                        SessionMovie(session=instance, movie_id=movie_id, order=order)
                        for order, movie_id in enumerate(movie_ids)
                    ])
                    
                    total_duration = Movie.objects.filter(id__in=movie_ids).aggregate(
                        total=Sum('length_minutes')
                    )['total'] or 0
                    
                    instance.estimated_duration_minutes = total_duration
                    instance.all_movies_selected = len(movie_ids) > 0
                else:
                    instance.estimated_duration_minutes = 0
                    instance.all_movies_selected = False
                    
                instance.save(update_fields=['estimated_duration_minutes', 'all_movies_selected'])
        
        return instance