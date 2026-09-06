# apps/movies/test_api.py

import pytest
from apps.movies.models import Movie
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        username='testuser',
        password='testpass123'
    )
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_movie():
    return Movie.objects.create(
        title='Test Movie',
        year=2020,
        director='Test Director'
    )


@pytest.mark.django_db
def test_list_movies(authenticated_client, sample_movie):
    response = authenticated_client.get('/api/movies/')
    assert response.status_code == 200
    assert len(response.data['results']) == 1


@pytest.mark.django_db
def test_unauthenticated_access(api_client):
    response = api_client.get('/api/movies/')
    assert response.status_code == 401

@pytest.mark.django_db
def test_listagem_nao_faz_consulta_extra_por_filme():
    """
    `.only()` com campo faltando não dá erro: o Django busca o campo ausente
    numa consulta separada, por objeto, e o resultado sai correto. Cinco
    campos do MovieListSerializer estavam fora da lista, e uma página de 20
    filmes custava 101 consultas — cem vezes mais do que sem otimização
    nenhuma.
    """
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    from apps.movies.models import Movie
    from apps.movies.serializers import MovieListSerializer, campos_da_listagem

    for i in range(5):
        Movie.objects.create(title=f'Filme {i}', year=2000 + i, ranking_current=i + 1)

    with CaptureQueriesContext(connection) as ctx:
        filmes = list(Movie.objects.only(*campos_da_listagem()).order_by('ranking_current')[:5])
        MovieListSerializer(filmes, many=True).data

    assert len(ctx.captured_queries) == 1, (
        f'{len(ctx.captured_queries)} consultas para 5 filmes: algum campo lido '
        f'pelo serializer ficou fora de campos_da_listagem()')


@pytest.mark.django_db
def test_campos_da_listagem_ignora_campo_calculado():
    """
    `watched` é SerializerMethodField, não coluna. Pedi-lo ao `.only()`
    derruba a listagem inteira com FieldDoesNotExist — foi o que aconteceu na
    primeira versão deste indicador.
    """
    from apps.movies.models import Movie
    from apps.movies.serializers import campos_da_listagem

    colunas = {f.name for f in Movie._meta.get_fields()}
    for campo in campos_da_listagem():
        assert campo in colunas, f'{campo} nao e coluna do modelo'


@pytest.mark.django_db
def test_campos_da_listagem_cobre_o_que_o_serializer_le():
    """
    O outro lado do contrato: coluna lida pelo serializer e ausente do
    `.only()` vira consulta extra por filme — resultado certo, cem vezes mais
    caro, e nada acusa.
    """
    from apps.movies.models import Movie
    from apps.movies.serializers import MovieListSerializer, campos_da_listagem

    colunas = {f.name for f in Movie._meta.get_fields()}
    lidos = {c for c in MovieListSerializer.Meta.fields if c in colunas}
    assert lidos == set(campos_da_listagem())


@pytest.mark.django_db
def test_archive_stats_soma_duracoes_em_vez_de_multiplicar(authenticated_client):
    """
    A home calculava as horas do acervo como `contagem * 1.8`. Nenhum filme
    era medido, e o número ficava ao lado de um contador verdadeiro, herdando
    a credibilidade dele.
    """
    from apps.movies.models import Movie

    # As durações são escolhidas para as duas fórmulas DISCORDAREM: a soma dá
    # 3h, a multiplicação daria 5h. Com valores que coincidem, o teste passaria
    # com a fórmula errada — foi o que aconteceu na primeira versão dele.
    for i in range(3):
        Movie.objects.create(title=f'Filme {i}', year=2000 + i,
                             length_minutes=60, country='BRA')

    dados = authenticated_client.get('/api/movies/archive-stats/').data
    assert dados['movies'] == 3
    assert dados['hours'] == 3            # 180 / 60. A multiplicação daria 5.
    assert dados['countries'] == 1        # não 92


@pytest.mark.django_db
def test_archive_stats_conta_paises_distintos(authenticated_client):
    from apps.movies.models import Movie

    for pais in ('BRA', 'FRA', 'FRA', 'JPN'):
        Movie.objects.create(title=f'F{pais}{Movie.objects.count()}', year=2000,
                             length_minutes=60, country=pais)
    assert authenticated_client.get('/api/movies/archive-stats/').data['countries'] == 3


@pytest.mark.django_db
def test_archive_stats_com_acervo_vazio_nao_estoura(authenticated_client):
    """Sum() devolve None num acervo vazio, e None/60 levantaria TypeError."""
    dados = authenticated_client.get('/api/movies/archive-stats/').data
    assert dados == {'movies': 0, 'hours': 0, 'countries': 0}


@pytest.mark.django_db
def test_best_releases_vem_ordenada_pela_nota(authenticated_client):
    """
    `list(...)[:5]` devolvia cinco cópias quaisquer, e o campo chama-se
    `best_releases`. Um REMUX 2160p e um WEB-DL 720p tinham a mesma chance de
    aparecer, e a tela apresentava aquilo como seleção do melhor.
    """
    from apps.movies.models import Movie, TorrentRelease

    filme = Movie.objects.create(title='Stalker', year=1979)
    for i, nota in enumerate([30, 95, 60, 10, 80, 45]):
        TorrentRelease.objects.create(
            movie=filme, title=f'Cópia {nota}', info_hash=f'{i:040d}',
            size_bytes=1, quality_score=nota, seeders=10)

    r = authenticated_client.get(f'/api/movies/{filme.id}/')
    notas = [x['quality_score'] for x in r.data['best_releases']]
    assert notas == sorted(notas, reverse=True)
    assert notas[0] == 95


@pytest.mark.django_db
def test_copia_cacheada_desempata(authenticated_client):
    """
    Entre duas cópias de nota parecida, a que já está no Real-Debrid toca
    agora — a outra exigiria baixar. A que toca vale mais.
    """
    from apps.movies.models import Movie, TorrentRelease

    filme = Movie.objects.create(title='Solaris', year=1972)
    TorrentRelease.objects.create(movie=filme, title='Melhor nota, sem cache',
                                  info_hash='a' * 40, size_bytes=1,
                                  quality_score=90, in_realdebrid=False)
    TorrentRelease.objects.create(movie=filme, title='Nota menor, cacheada',
                                  info_hash='b' * 40, size_bytes=1,
                                  quality_score=85, in_realdebrid=True)

    r = authenticated_client.get(f'/api/movies/{filme.id}/')
    assert r.data['best_releases'][0]['title'] == 'Nota menor, cacheada'


@pytest.mark.django_db
def test_marca_cacheadas_grava_quem_toca_agora(monkeypatch, django_user_model):
    """
    Sem esta checagem, toda release recém-encontrada voltava com
    instantly_available=False e a tela dizia que nenhuma tocava agora — a
    marcação só chegava horas depois, pela task noturna. Saber na hora é o
    ponto de buscar: é o que distingue "dá play" de "vai baixar".
    """
    from asgiref.sync import async_to_sync

    from apps.movies.models import Movie, TorrentRelease
    from apps.movies.views import _marca_cacheadas

    u = django_user_model.objects.create_user(username='u1', password='x',
                                              realdebrid_api_key='chave')
    filme = Movie.objects.create(title='Stalker', year=1979)
    cacheada = TorrentRelease.objects.create(movie=filme, title='A', size_bytes=1,
                                             info_hash='a' * 40)
    fria = TorrentRelease.objects.create(movie=filme, title='B', size_bytes=1,
                                         info_hash='b' * 40)

    async def falso(self, hashes):
        return {'a' * 40: True, 'b' * 40: False}

    monkeypatch.setattr(
        'apps.integrations.realdebrid.RealDebridClient.check_instant_availability', falso)

    falhou = async_to_sync(_marca_cacheadas)([cacheada, fria], u)

    cacheada.refresh_from_db(); fria.refresh_from_db()
    assert falhou is False
    assert cacheada.instantly_available is True
    assert fria.instantly_available is False
    assert cacheada.instant_check_at is not None


@pytest.mark.django_db
def test_falha_na_checagem_nao_marca_nada_como_offline(monkeypatch, django_user_model):
    """
    "Conferi e nenhuma está pronta" e "não consegui conferir" desenham telas
    diferentes. Tratá-las igual faria o acervo parecer offline por um blip de
    rede — e a release que ESTAVA cacheada perderia a marca.
    """
    from asgiref.sync import async_to_sync

    from apps.integrations.realdebrid import RealDebridIndisponivel
    from apps.movies.models import Movie, TorrentRelease
    from apps.movies.views import _marca_cacheadas

    u = django_user_model.objects.create_user(username='u2', password='x',
                                              realdebrid_api_key='chave')
    filme = Movie.objects.create(title='Solaris', year=1972)
    r = TorrentRelease.objects.create(movie=filme, title='A', size_bytes=1,
                                      info_hash='c' * 40, instantly_available=True)

    async def estoura(self, hashes):
        raise RealDebridIndisponivel('sem rota')

    monkeypatch.setattr(
        'apps.integrations.realdebrid.RealDebridClient.check_instant_availability', estoura)

    falhou = async_to_sync(_marca_cacheadas)([r], u)

    r.refresh_from_db()
    assert falhou is True
    assert r.instantly_available is True, 'a marca anterior não pode ser apagada'


@pytest.mark.django_db
def test_sem_chave_do_real_debrid_nao_e_falha(django_user_model, settings):
    """Não ter integração é diferente de ela estar quebrada."""
    # A chave da instância vem do .env e serviria de fallback; sem zerá-la o
    # teste chamaria a API de verdade em vez de exercitar o caminho sem chave.
    settings.REAL_DEBRID_API_KEY = None
    from asgiref.sync import async_to_sync

    from apps.movies.models import Movie, TorrentRelease
    from apps.movies.views import _marca_cacheadas

    u = django_user_model.objects.create_user(username='u3', password='x')
    filme = Movie.objects.create(title='X', year=2000)
    r = TorrentRelease.objects.create(movie=filme, title='A', size_bytes=1,
                                      info_hash='d' * 40)

    assert async_to_sync(_marca_cacheadas)([r], u) is False
