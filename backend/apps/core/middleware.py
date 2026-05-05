import logging
import time

from django.utils.deprecation import MiddlewareMixin

from .rate_limit import RateLimiter

from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger('apps.requests')

class JWTAuthMiddleware:
    """
    Channels middleware that authenticates via JWT token in query string.
    Usage: ws://host/ws/path/?token=<access_token>
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Transforma o scope em dict para podermos alterá-lo
        scope = dict(scope)
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            scope['user'] = await self._get_user(token_list[0])
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, raw_token: str):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            validated = AccessToken(raw_token)
            return User.objects.get(id=validated['user_id'])
        except (InvalidToken, TokenError, User.DoesNotExist):
            return AnonymousUser()

class RateLimitHeadersMiddleware(MiddlewareMixin):
    """Adiciona headers de rate limit nas respostas"""
    
    def process_response(self, request, response):
        if hasattr(request, 'user') and request.user.is_authenticated:
            key = f'user_{request.user.id}'
            max_requests = 1000  # Por dia
            
            info = RateLimiter.get_remaining(key, max_requests)
            
            response['X-RateLimit-Limit'] = str(info['limit'])
            response['X-RateLimit-Remaining'] = str(info['remaining'])
            response['X-RateLimit-Reset'] = str(info['reset_at'])
        
        return response


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log todas as requests com timing"""
    
    def process_request(self, request):
        request.start_time = time.time()
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            
            logger.info(
                'Request processed',
                extra={
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'user': str(request.user) if hasattr(request, 'user') else 'anonymous',
                    'ip': self.get_client_ip(request),
                }
            )
        
        return response
    
    @staticmethod
    def get_client_ip(request):
        """Get real client IP"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip