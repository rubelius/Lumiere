"""
Testes da autenticação do WebSocket.

O contrato é o ticket: emitido por /api/auth/ws-ticket/, válido por 30
segundos e por uma única conexão. O middleware lia `?token=`, parâmetro que o
cliente nunca mandou, então toda conexão caía em AnonymousUser — sem erro,
sem log, apenas nada em tempo real funcionando.
"""

import pytest
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache

from apps.core.middleware import JWTAuthMiddleware


def conecta(query: str):
    """Roda o middleware e devolve o usuário que ele pôs no scope."""
    capturado = {}

    async def interno(scope, receive, send):
        capturado['user'] = scope['user']

    async def nada():
        return None

    async_to_sync(JWTAuthMiddleware(interno))(
        {'type': 'websocket', 'query_string': query.encode()}, nada, nada)
    return capturado['user']


@pytest.fixture(autouse=True)
def limpa():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db(transaction=True)
def test_ticket_valido_autentica():
    user = get_user_model().objects.create_user(username='ws', password='x')
    cache.set('ws_ticket:abc', str(user.id), timeout=30)

    assert conecta('ticket=abc') == user


@pytest.mark.django_db(transaction=True)
def test_ticket_e_de_uso_unico():
    """
    Ticket que sobrevive à conexão vira credencial reutilizável — e ele viaja
    na URL, que é exatamente onde não se guarda credencial duradoura.
    """
    user = get_user_model().objects.create_user(username='ws2', password='x')
    cache.set('ws_ticket:abc', str(user.id), timeout=30)

    assert conecta('ticket=abc') == user
    assert isinstance(conecta('ticket=abc'), AnonymousUser)


@pytest.mark.django_db
def test_ticket_inexistente_ou_expirado_nao_autentica():
    assert isinstance(conecta('ticket=naoexiste'), AnonymousUser)


@pytest.mark.django_db
def test_sem_ticket_e_anonimo():
    assert isinstance(conecta(''), AnonymousUser)


@pytest.mark.django_db
def test_jwt_cru_na_url_nao_serve_mais():
    """
    O ticket existe para tirar o JWT da URL, que aparece em log de servidor,
    de proxy e no histórico. Aceitar `?token=` manteria o vazamento aberto.
    """
    from rest_framework_simplejwt.tokens import AccessToken

    user = get_user_model().objects.create_user(username='ws3', password='x')
    jwt = str(AccessToken.for_user(user))

    assert isinstance(conecta(f'token={jwt}'), AnonymousUser)
