import logging
import time

from django.utils.deprecation import MiddlewareMixin

from .rate_limit import RateLimiter

from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.exceptions import ValidationError

logger = logging.getLogger('apps.requests')

class JWTAuthMiddleware:
    """
    Autentica a conexão WebSocket pelo ticket de uso único.

    Uso: ws://host/ws/caminho/?ticket=<ticket>

    O ticket é emitido por POST /api/auth/ws-ticket/, vale 30 segundos e vale
    uma vez só. Ele existe porque URL de WebSocket aparece em log de servidor,
    de proxy e no histórico do navegador — e um JWT ali dentro vaza junto,
    válido por toda a sua vida útil. O ticket vaza sem serventia: já foi
    consumido.

    Esta classe lia `?token=`, que é exatamente o que o ticket veio evitar, e
    o cliente nunca mandou esse parâmetro. Resultado: toda conexão caía em
    AnonymousUser e nada em tempo real funcionava.
    """

    PREFIXO = 'ws_ticket:'

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Transforma o scope em dict para podermos alterá-lo
        scope = dict(scope)
        params = parse_qs(scope.get('query_string', b'').decode())
        tickets = params.get('ticket', [])

        scope['user'] = (
            await self._usuario_do_ticket(tickets[0]) if tickets else AnonymousUser()
        )

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _usuario_do_ticket(self, ticket: str):
        from django.contrib.auth import get_user_model

        chave = f'{self.PREFIXO}{ticket}'
        user_id = cache.get(chave)
        if not user_id:
            return AnonymousUser()

        # Uso único: apagar antes de resolver o usuário fecha a janela em que
        # duas conexões simultâneas aproveitariam o mesmo ticket.
        cache.delete(chave)

        try:
            return get_user_model().objects.get(id=user_id)
        except (get_user_model().DoesNotExist, ValueError, ValidationError):
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