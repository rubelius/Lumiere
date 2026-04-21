# apps/core/views.py

import redis
from celery import current_app
from django.core.cache import cache
from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Comprehensive health check
    
    Checks:
    - Database connectivity
    - Redis connectivity
    - Celery workers
    """
    health = {
        'status': 'healthy',
        'checks': {}
    }
    
    # Database
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        health['checks']['database'] = 'ok'
    except Exception as e:
        health['checks']['database'] = f'error: {str(e)}'
        health['status'] = 'unhealthy'
    
    # Redis
    try:
        cache.set('health_check', 'ok', 10)
        value = cache.get('health_check')
        health['checks']['redis'] = 'ok' if value == 'ok' else 'error'
    except Exception as e:
        health['checks']['redis'] = f'error: {str(e)}'
        health['status'] = 'unhealthy'
    
    # Celery
    try:
        inspect = current_app.control.inspect()
        stats = inspect.stats()
        
        if stats:
            health['checks']['celery'] = 'ok'
            health['checks']['celery_workers'] = len(stats)
        else:
            health['checks']['celery'] = 'no workers'
            health['status'] = 'degraded'
    except Exception as e:
        health['checks']['celery'] = f'error: {str(e)}'
        health['status'] = 'unhealthy'
    
    # Return appropriate status code
    status_code = status.HTTP_200_OK
    if health['status'] == 'unhealthy':
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif health['status'] == 'degraded':
        status_code = status.HTTP_200_OK
    
    return Response(health, status=status_code)


@api_view(['GET'])
@permission_classes([AllowAny])
def readiness_check(request):
    """
    Readiness check for Kubernetes
    
    Returns 200 if ready to serve traffic
    """
    # Quick check - just database
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return Response({'status': 'ready'})
    except:
        return Response(
            {'status': 'not ready'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def liveness_check(request):
    """
    Liveness check for Kubernetes
    
    Always returns 200 unless app is completely dead
    """
    return Response({'status': 'alive'})

