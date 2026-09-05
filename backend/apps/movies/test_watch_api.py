"""
Testes das ações de exibição, do ponto de vista de quem chama a API.

O contrato que a tela depende: o player reporta posição, o filme vira
"assistido" ao cruzar o limite, e a partir daí some da frente nas sugestões e
aparece marcado em toda listagem.
"""

import pytest
from rest_framework.test import APIClient

from apps.movies.models import Movie, WatchHistory


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(username='cinefilo', password='x')


@pytest.fixture
def cliente(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Stalker', year=1979, length_minutes=162)


@pytest.mark.django_db
def test_progresso_grava_posicao_sem_concluir(cliente, filme):
    r = cliente.post(f'/api/movies/{filme.id}/progress/',
                     {'position': 600, 'duration': 9720}, format='json')
    assert r.status_code == 200
    assert r.data['completed'] is False
    assert r.data['progress_seconds'] == 600
    assert 0.06 < r.data['fraction'] < 0.07


@pytest.mark.django_db
def test_chegar_ao_fim_marca_como_assistido(cliente, filme):
    r = cliente.post(f'/api/movies/{filme.id}/progress/',
                     {'position': 9000, 'duration': 9720}, format='json')
    assert r.data['completed'] is True
    assert r.data['times_watched'] == 1


@pytest.mark.django_db
def test_sem_duracao_do_player_usa_o_metadado_do_acervo(cliente, filme):
    """
    O <video> nem sempre sabe a duração no primeiro ping. Cair no
    length_minutes é melhor que não concluir nunca — 162 min = 9720 s.
    """
    r = cliente.post(f'/api/movies/{filme.id}/progress/',
                     {'position': 9000}, format='json')
    assert r.data['runtime_seconds'] == 9720
    assert r.data['completed'] is True


@pytest.mark.django_db
def test_marcar_a_mao_e_desmarcar(cliente, filme, usuario):
    """
    Desmarcar não apaga o histórico: devolve o filme às sugestões e preserva
    quantas vezes já foi visto, porque essa contagem alimenta o perfil.
    """
    assert cliente.post(f'/api/movies/{filme.id}/watched/').data['completed'] is True

    r = cliente.delete(f'/api/movies/{filme.id}/watched/')
    assert r.data['completed'] is False
    assert r.data['times_watched'] == 1
    assert WatchHistory.objects.filter(user=usuario, movie=filme).exists()


@pytest.mark.django_db
def test_marcar_duas_vezes_nao_infla_a_contagem(cliente, filme):
    cliente.post(f'/api/movies/{filme.id}/watched/')
    r = cliente.post(f'/api/movies/{filme.id}/watched/')
    assert r.data['times_watched'] == 1


@pytest.mark.django_db
def test_listagem_marca_o_que_ja_foi_visto(cliente, usuario):
    visto = Movie.objects.create(title='Solaris', year=1972)
    novo = Movie.objects.create(title='O Espelho', year=1975)
    WatchHistory.objects.create(user=usuario, movie=visto, completed=True, times_watched=1)

    r = cliente.get('/api/movies/')
    assert r.status_code == 200
    por_titulo = {m['title']: m['watched'] for m in r.data['results']}
    assert por_titulo['Solaris'] is True
    assert por_titulo['O Espelho'] is False


@pytest.mark.django_db
def test_anonimo_nao_vaza_historico_de_outro(usuario, filme, django_user_model):
    """
    O conjunto de assistidos é por usuário. Se vazasse entre contas, uma
    pessoa veria a marcação de outra e as sugestões viriam despriorizadas
    pelo gosto alheio.
    """
    outro = django_user_model.objects.create_user(username='outro', password='x')
    WatchHistory.objects.create(user=outro, movie=filme, completed=True)

    c = APIClient()
    c.force_authenticate(user=usuario)
    r = c.get('/api/movies/')
    assert all(m['watched'] is False for m in r.data['results'])
