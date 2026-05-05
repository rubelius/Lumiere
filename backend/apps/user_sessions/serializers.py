from rest_framework import serializers
from django.db.models import Sum

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
        # OTIMIZAÇÃO: Usa o cache do prefetch_related ao invés de rodar COUNT() no banco
        return len(obj.session_movies.all())
    
    def get_theme_name(self, obj):
        return obj.theme.name if obj.theme else None
    
    def get_first_movie_poster(self, obj):
        """Retorna poster do primeiro filme para preview - N+1 #2 CORRIGIDA"""
        # Acessa os dados já cacheados da query principal
        session_movies = obj.session_movies.all()
        if session_movies:
            first = session_movies[0]
            return first.movie.poster_url if first.movie else None
        return None


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
        movie_ids = validated_data.pop('movie_ids', [])
        validated_data['user'] = self.context['request'].user

        # Usando transação atômica: ou tudo salva, ou nada salva.
        with transaction.atomic():
            session = CinemaSession.objects.create(**validated_data)

            if movie_ids:
                # Valida se todos os IDs de filmes realmente existem no banco
                existing_count = Movie.objects.filter(id__in=movie_ids).count()
                if existing_count != len(movie_ids):
                    raise serializers.ValidationError(
                        {'movie_ids': 'One or more movie IDs do not exist.'}
                    )

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
        """Cria sessão com filmes - N+1 #3 CORRIGIDA"""
        movie_ids = validated_data.pop('movie_ids', [])
        validated_data['user'] = self.context['request'].user
        
        # Create session
        session = CinemaSession.objects.create(**validated_data)
        
        total_duration = 0
        if movie_ids:
            # 1. OTIMIZAÇÃO: Cria todos os SessionMovies em 1 única query
            session_movies_to_create = [
                SessionMovie(session=session, movie_id=movie_id, order=order)
                for order, movie_id in enumerate(movie_ids)
            ]
            SessionMovie.objects.bulk_create(session_movies_to_create)
            
            # 2. OTIMIZAÇÃO: Soma as durações em 1 única query no banco em vez de laço
            total_duration = Movie.objects.filter(id__in=movie_ids).aggregate(
                total=Sum('length_minutes')
            )['total'] or 0
        
        session.estimated_duration_minutes = total_duration
        session.all_movies_selected = len(movie_ids) > 0
        session.save()
        
        return session
    
    def update(self, instance, validated_data):
        """Atualiza sessão - OTIMIZADO"""
        movie_ids = validated_data.pop('movie_ids', None)
        
        # Update session fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update movies if provided
        if movie_ids is not None:
            # Remove existing
            instance.session_movies.all().delete()
            
            if movie_ids:
                # Add new using bulk_create
                session_movies_to_create = [
                    SessionMovie(session=instance, movie_id=movie_id, order=order)
                    for order, movie_id in enumerate(movie_ids)
                ]
                SessionMovie.objects.bulk_create(session_movies_to_create)
                
                # Recalcula duração
                total_duration = Movie.objects.filter(id__in=movie_ids).aggregate(
                    total=Sum('length_minutes')
                )['total'] or 0
                
                instance.estimated_duration_minutes = total_duration
                instance.all_movies_selected = len(movie_ids) > 0
                instance.save()
        
        return instance