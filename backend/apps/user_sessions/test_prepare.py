"""
Testes da preparação de sessão.

A máquina de estados é planning -> preparing -> ready -> in_progress, e `start`
exige `ready`. A task que faz essa transição era um `pass`, então toda sessão
preparada ficava presa em `preparing`. O que estes testes cobram é justamente
a saída daquele estado.
"""

import pytest
from django.utils import timezone

from apps.movies.models import Movie, TorrentRelease
from apps.tasks.sessions import prepare_session
from apps.user_sessions.models import CinemaSession, SessionMovie


def cria_sessao(user, status='preparing', **kwargs):
    return CinemaSession.objects.create(
        user=user, name='Noite', status=status,
        scheduled_date=timezone.now() + timezone.timedelta(days=1), **kwargs)


def com_copia_no_realdebrid(movie, nota=90, links=('rd://x',)):
    return TorrentRelease.objects.create(
        movie=movie, title=f'{movie.title} 1080p', info_hash=f'h{movie.id.hex[:12]}', size_bytes=1,
        in_realdebrid=True, realdebrid_links=list(links), quality_score=nota)


@pytest.mark.django_db
def test_sessao_com_todos_os_filmes_disponiveis_fica_pronta(django_user_model):
    user = django_user_model.objects.create_user(username='a', password='x')
    sessao = cria_sessao(user)
    filme = Movie.objects.create(title='Alphaville', year=1965)
    copia = com_copia_no_realdebrid(filme)
    SessionMovie.objects.create(session=sessao, movie=filme, order=1)

    r = prepare_session(str(sessao.id))

    sessao.refresh_from_db()
    assert sessao.status == 'ready'
    assert r['prontos'] == 1
    item = SessionMovie.objects.get(session=sessao)
    assert item.selected_release == copia
    assert item.download_status == 'ready'


@pytest.mark.django_db
def test_filme_sem_copia_devolve_a_sessao_para_planning(django_user_model):
    """
    Não pode ficar em `preparing`: é justamente o estado do qual não se sai, e
    de onde o dono não consegue mexer na lista de filmes.
    """
    user = django_user_model.objects.create_user(username='b', password='x')
    sessao = cria_sessao(user)
    tem = Movie.objects.create(title='Alphaville', year=1965)
    com_copia_no_realdebrid(tem)
    nao_tem = Movie.objects.create(title='Que Horas Ela Volta?', year=2015)
    SessionMovie.objects.create(session=sessao, movie=tem, order=1)
    SessionMovie.objects.create(session=sessao, movie=nao_tem, order=2)

    r = prepare_session(str(sessao.id))

    sessao.refresh_from_db()
    assert sessao.status == 'planning'
    assert r['sem_copia'] == ['Que Horas Ela Volta?']
    assert SessionMovie.objects.get(movie=nao_tem).download_status == 'failed'


@pytest.mark.django_db
def test_copia_sem_links_nao_conta_como_disponivel(django_user_model):
    """
    A mesma regra do resolvedor de reprodução: registro no Real-Debrid sem
    links não toca. Aceitá-lo aqui deixaria a sessão `ready` para falhar
    depois, na hora de dar play.
    """
    user = django_user_model.objects.create_user(username='c', password='x')
    sessao = cria_sessao(user)
    filme = Movie.objects.create(title='Alphaville', year=1965)
    TorrentRelease.objects.create(
        movie=filme, title='sem links', info_hash='h0', size_bytes=1,
        in_realdebrid=True, realdebrid_links=[], quality_score=99)
    SessionMovie.objects.create(session=sessao, movie=filme, order=1)

    prepare_session(str(sessao.id))

    sessao.refresh_from_db()
    assert sessao.status == 'planning'


@pytest.mark.django_db
def test_escolhe_a_copia_de_maior_qualidade(django_user_model):
    user = django_user_model.objects.create_user(username='d', password='x')
    sessao = cria_sessao(user)
    filme = Movie.objects.create(title='Alphaville', year=1965)
    TorrentRelease.objects.create(
        movie=filme, title='720p', info_hash='hbaixa', size_bytes=1,
        in_realdebrid=True, realdebrid_links=['rd://a'], quality_score=40)
    melhor = TorrentRelease.objects.create(
        movie=filme, title='REMUX', info_hash='halta', size_bytes=1,
        in_realdebrid=True, realdebrid_links=['rd://b'], quality_score=95)
    SessionMovie.objects.create(session=sessao, movie=filme, order=1)

    prepare_session(str(sessao.id))

    assert SessionMovie.objects.get(session=sessao).selected_release == melhor


@pytest.mark.django_db
def test_reentrada_nao_atropela_sessao_ja_iniciada(django_user_model):
    """
    O Celery pode reexecutar a task. Refazer a preparação de uma sessão que já
    começou reescreveria o estado dela no meio da exibição.
    """
    user = django_user_model.objects.create_user(username='e', password='x')
    sessao = cria_sessao(user, status='in_progress')

    r = prepare_session(str(sessao.id))

    sessao.refresh_from_db()
    assert sessao.status == 'in_progress'
    assert r == {'skipped': 'in_progress'}


@pytest.mark.django_db
def test_add_movie_responde_erro_do_cliente_como_erro_do_cliente(client):
    """
    O movie_id ia cru para o create(). UUID malformado, filme inexistente e
    filme repetido — os três caminhos de erro mais comuns — viravam 500, como
    se o servidor tivesse quebrado.
    """
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    user = get_user_model().objects.create_user(username='add', password='x')
    api = APIClient()
    api.force_authenticate(user=user)

    sessao = cria_sessao(user, status='planning')
    filme = Movie.objects.create(title='Alphaville', year=1965)
    url = f'/api/sessions/{sessao.id}/add_movie/'

    assert api.post(url, {'movie_id': 'nao-e-uuid'}, format='json').status_code == 404
    assert api.post(
        url, {'movie_id': '00000000-0000-0000-0000-000000000000'},
        format='json').status_code == 404

    assert api.post(url, {'movie_id': str(filme.id)}, format='json').status_code == 200
    assert api.post(url, {'movie_id': str(filme.id)}, format='json').status_code == 409
