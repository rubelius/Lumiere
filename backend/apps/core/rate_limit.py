import time

from django.core.cache import cache
from rest_framework.exceptions import Throttled


class RateLimiter:
    """Rate limiter customizado usando Redis"""
    
    @staticmethod
    def check_rate_limit(
        key: str,
        max_requests: int,
        window_seconds: int,
        raise_exception: bool = True
    ) -> bool:
        """
        Verifica rate limit
        
        Args:
            key: Chave única (ex: user_id, ip_address)
            max_requests: Máximo de requests permitidos
            window_seconds: Janela de tempo em segundos
            raise_exception: Lançar exceção se excedido
        
        Returns:
            True se permitido, False se excedido
        
        Raises:
            Throttled se excedido e raise_exception=True
        """
        cache_key = f'rate_limit:{key}'
        
        # Get current count
        current = cache.get(cache_key)
        
        if current is None:
            # First request in window
            cache.set(cache_key, 1, window_seconds)
            return True
        
        if current >= max_requests:
            # Rate limit exceeded
            if raise_exception:
                ttl = cache.ttl(cache_key)
                raise Throttled(
                    detail=f'Rate limit exceeded. Try again in {ttl} seconds.',
                    wait=ttl
                )
            return False
        
        # Increment counter
        cache.incr(cache_key)
        return True
    
    @staticmethod
    def get_remaining(key: str, max_requests: int) -> dict:
        """
        Retorna informações sobre rate limit
        
        Returns:
            Dict com limit, remaining, reset_at
        """
        cache_key = f'rate_limit:{key}'
        current = cache.get(cache_key, 0)
        ttl = cache.ttl(cache_key) or 0
        
        return {
            'limit': max_requests,
            'remaining': max(0, max_requests - current),
            'reset_at': int(time.time()) + ttl
        }