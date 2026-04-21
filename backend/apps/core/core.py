import hashlib
import json
from functools import wraps

from django.core.cache import cache


def cache_key(*args, **kwargs):
    """Gera chave de cache consistente"""
    key_data = {
        'args': args,
        'kwargs': kwargs
    }
    key_string = json.dumps(key_data, sort_keys=True)
    return hashlib.md5(key_string.encode()).hexdigest()


def cached_method(timeout=300, key_prefix=''):
    """
    Decorator para cachear resultado de método
    
    Usage:
        @cached_method(timeout=600, key_prefix='movie')
        def get_movie_data(self, movie_id):
            return expensive_operation()
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key_str = f"{key_prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            result = cache.get(cache_key_str)
            
            if result is None:
                # Execute function
                result = func(*args, **kwargs)
                
                # Cache result
                cache.set(cache_key_str, result, timeout)
            
            return result
        return wrapper
    return decorator


def invalidate_cache(key_pattern):
    """Invalida cache por padrão de chave"""
    from django_redis import get_redis_connection
    
    conn = get_redis_connection('default')
    keys = conn.keys(f'lumiere:*{key_pattern}*')
    
    if keys:
        conn.delete(*keys)


class CacheManager:
    """Gerenciador centralizado de cache"""
    
    @staticmethod
    def get_movie(movie_id: str, timeout=3600):
        """Cache de filme"""
        key = f'movie:{movie_id}'
        return cache.get(key)
    
    @staticmethod
    def set_movie(movie_id: str, data: dict, timeout=3600):
        """Set cache de filme"""
        key = f'movie:{movie_id}'
        cache.set(key, data, timeout)
    
    @staticmethod
    def invalidate_movie(movie_id: str):
        """Invalida cache de filme"""
        key = f'movie:{movie_id}'
        cache.delete(key)
    
    @staticmethod
    def get_user_recommendations(user_id: str):
        """Cache de recomendações"""
        key = f'recommendations:{user_id}'
        return cache.get(key)
    
    @staticmethod
    def set_user_recommendations(user_id: str, data: list, timeout=3600):
        """Set cache de recomendações"""
        key = f'recommendations:{user_id}'
        cache.set(key, data, timeout)
    
    @staticmethod
    def invalidate_user_recommendations(user_id: str):
        """Invalida recomendações do usuário"""
        key = f'recommendations:{user_id}'
        cache.delete(key)