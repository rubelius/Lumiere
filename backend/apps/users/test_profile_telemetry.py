"""
Testes da telemetria do perfil.

O contrato: os números descrevem o USUÁRIO. Antes descreviam o acervo — uma
conta recém-criada exibia 39.866 horas de exibição e 25.908 obras assistidas,
porque eram a soma e a contagem do catálogo inteiro.
"""

import pytest
from rest_framework.test import APIClient

from apps.movies.models import Movie, WatchHistory


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(username='novato', password='x')


@pytest.fixture
def cliente(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@pytest.fixture
def acervo(db):
    """Um catálogo grande, que o perfil NÃO pode reportar como assistido."""
    return [
        Movie.objects.create(title=f'Filme {i}', year=1950 + i, length_minutes=120,
                             director=f'Diretor {i}', country='EUA',
                             genres=['Drama'], tmdb_rating=8.0)
        for i in range(30)
    ]


@pytest.mark.django_db
def test_conta_nova_nao_herda_o_acervo(cliente, acervo):
    """
    Este é o defeito, na sua forma mais pura: quem nunca assistiu nada via os
    números do catálogo inteiro no lugar dos seus.
    """
    r = cliente.get('/api/profile/telemetry/')
    assert r.status_code == 200
    assert r.data['stats']['moviesWatched'] == 0
    assert r.data['stats']['watchTimeHours'] == 0
    assert r.data['history'] == []


@pytest.mark.django_db
def test_conta_o_que_foi_assistido(cliente, usuario, acervo):
    for filme in acervo[:3]:
        WatchHistory.objects.create(user=usuario, movie=filme, completed=True,
                                    times_watched=1)

    dados = cliente.get('/api/profile/telemetry/').data
    assert dados['stats']['moviesWatched'] == 3
    assert dados['stats']['watchTimeHours'] == 6      # 3 x 120 min
    assert len(dados['history']) == 3


@pytest.mark.django_db
def test_filme_comecado_e_nao_terminado_nao_conta(cliente, usuario, acervo):
    WatchHistory.objects.create(user=usuario, movie=acervo[0], completed=False,
                                progress_seconds=600)
    assert cliente.get('/api/profile/telemetry/').data['stats']['moviesWatched'] == 0


@pytest.mark.django_db
def test_sem_nota_a_media_e_nula_e_nao_zero(cliente, usuario, acervo):
    """
    Zero diria "avaliou tudo com zero". "Ainda não avaliou" é outra coisa, e a
    tela precisa poder distinguir para não chamar ninguém de crítico severo.
    """
    WatchHistory.objects.create(user=usuario, movie=acervo[0], completed=True)
    dados = cliente.get('/api/profile/telemetry/').data
    assert dados['stats']['averageRating'] is None
    assert dados['stats']['ratedCount'] == 0


@pytest.mark.django_db
def test_media_usa_a_nota_do_usuario_nao_a_do_tmdb(cliente, usuario, acervo):
    # O acervo inteiro tem tmdb_rating 8.0; a nota do usuário é outra coisa.
    WatchHistory.objects.create(user=usuario, movie=acervo[0], completed=True, rating=3.0)
    WatchHistory.objects.create(user=usuario, movie=acervo[1], completed=True, rating=4.0)

    dados = cliente.get('/api/profile/telemetry/').data
    assert dados['stats']['averageRating'] == 3.5


@pytest.mark.django_db
def test_historico_de_outro_usuario_nao_aparece(cliente, acervo, django_user_model):
    outro = django_user_model.objects.create_user(username='outro', password='x')
    WatchHistory.objects.create(user=outro, movie=acervo[0], completed=True)
    assert cliente.get('/api/profile/telemetry/').data['stats']['moviesWatched'] == 0


@pytest.mark.django_db
def test_conquistas_sao_alcancadas_nao_dadas(cliente, usuario, acervo):
    """Antes eram dois elogios fixos, exibidos para quem nunca viu nada."""
    assert cliente.get('/api/profile/telemetry/').data['achievements'] == []

    for filme in acervo[:10]:
        WatchHistory.objects.create(user=usuario, movie=filme, completed=True)
    titulos = [c['title'] for c in cliente.get('/api/profile/telemetry/').data['achievements']]
    assert 'PERFIL CALIBRADO' in titulos


@pytest.mark.django_db
def test_paises_saem_do_que_foi_assistido(cliente, usuario, acervo):
    """Os percentuais eram literais: EUA 45%, FRA 20%, ITA 15%, sempre."""
    fr = Movie.objects.create(title='Francês', year=1960, country='FRA', length_minutes=90)
    WatchHistory.objects.create(user=usuario, movie=acervo[0], completed=True)  # EUA
    WatchHistory.objects.create(user=usuario, movie=fr, completed=True)

    paises = {p['c']: p['p'] for p in cliente.get('/api/profile/telemetry/').data['charts']['countries']}
    assert paises == {'EUA': 50, 'FRA': 50}
