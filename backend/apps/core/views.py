# apps/core/views.py

import secrets
import redis
from celery import current_app
from django.core.cache import cache
from django.db import connection
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from apps.core.motor import estado_do_motor


@extend_schema(
    responses=inline_serializer(
        name='HealthCheck',
        fields={
            'status': serializers.CharField(),
            'checks': serializers.DictField(child=serializers.CharField()),
        },
    ),
    description='Estado do banco, do Redis e dos workers do Celery.',
)
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


@extend_schema(
    request=None,
    responses=inline_serializer(
        name='WebSocketTicket',
        fields={'ticket': serializers.CharField()},
    ),
    description='Ticket de uso único, válido por 30s, para abrir o WebSocket.',
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def issue_ws_ticket(request):
    """
    Gera um ticket de uso único de 30 segundos para conexão WebSocket.
    Protege o sistema contra vazamento de tokens em logs ou URLs.
    """
    # Gera um código aleatório seguro de 32 bytes
    ticket = secrets.token_urlsafe(32)
    
    # Salva no cache com a chave ws_ticket:<ticket> apontando para o ID do usuário
    cache.set(f'ws_ticket:{ticket}', str(request.user.id), timeout=30)
    
    return Response({'ticket': ticket})

@extend_schema(
    responses=OpenApiTypes.OBJECT,
    description=(
        'O estado do motor do ponto de vista da tela: dá para prometer que '
        'apertar o botão de buscar cópias vai adiantar alguma coisa?'
    ),
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def estado_do_motor_view(request):
    """
    Diferente de `/api/health/`, que responde a orquestrador.

    Aqui a pergunta é de produto: a tela deve ou não oferecer uma busca. A
    resposta fica guardada por meio minuto, porque perguntar aos workers custa
    o timeout inteiro justamente quando não há nenhum.
    """
    return Response(estado_do_motor())


@extend_schema(
    responses=OpenApiTypes.OBJECT,
    description=(
        'O painel de administração: o estado do Lumière inteiro. Cada painel '
        'diz DE ONDE o número vem, QUANDO foi medido e o que ele NÃO diz.'
    ),
)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def painel_admin_view(request):
    """
    Só para quem é equipe.

    `IsAdminUser` do DRF checa `is_staff`, e é o bastante: esta tela mostra
    tamanho de banco, contas, chave de integração em uso e o estado de cada
    serviço. Nenhuma dessas coisas é do usuário comum.
    """
    from apps.core.acoes import disponiveis
    from apps.core.graficos import monta_graficos
    from apps.core.painel import painel_guardado

    return Response({
        **painel_guardado(),
        # Os gráficos não entram no cache do painel: um deles conta execuções de
        # tarefa, e é justamente depois de apertar um botão que se quer ver o
        # número mudar.
        'graficos': monta_graficos(),
        'acoes': disponiveis(),
    })


@extend_schema(
    request=inline_serializer(name='AcaoDoPainel',
                              fields={'acao': serializers.CharField()}),
    responses=OpenApiTypes.OBJECT,
    description=(
        'Dispara uma das ações do painel. A lista é FECHADA: aceitar um nome '
        'de tarefa qualquer transformaria isto num executor remoto de qualquer '
        'coisa registrada no Celery.'
    ),
)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def acao_do_painel_view(request):
    """
    Enfileira e devolve o `task_id`. NÃO espera terminar: algumas destas levam
    minutos, e uma requisição presa nisso vira timeout com trabalho rodando do
    outro lado.
    """
    from apps.core.acoes import AcaoDesconhecida, executa

    try:
        return Response(executa(request.data.get('acao', ''), request.user))
    except AcaoDesconhecida as erro:
        return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as erro:  # noqa: BLE001
        # A fila fora do ar é o caso comum aqui, e "não consegui enfileirar" é
        # diferente de "a tarefa falhou" — quem lê precisa saber qual dos dois.
        return Response(
            {'detail': f'Não consegui enfileirar: {erro}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE)
