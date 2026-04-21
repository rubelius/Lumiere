import logging
import time

from django.utils.deprecation import MiddlewareMixin

from .rate_limit import RateLimiter

logger = logging.getLogger('apps.requests')

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