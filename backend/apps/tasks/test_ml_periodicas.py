"""
Testes das tarefas periódicas de ML.

As três rodam sozinhas pelo beat, então errar aqui é errar em silêncio: o
retreino que não alcança ninguém, o resultado que não serializa e a fusão de
amostras que muda de execução para execução.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.integrations.models import LetterboxdDiary
from apps.movies.models import Movie, WatchHistory
from apps.tasks import ml
from apps.tasks.ml import (amostras_de_gosto, retrain_all_users,
                           update_movie_embeddings)


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(username='cinefilo', password='x')


@pytest.fixture
def agendados(monkeypatch):
    chamadas = []
    monkeypatch.setattr(ml.train_user_taste_profile, 'apply_async',
                        lambda *a, **kw: chamadas.append(kw.get('args', a)))
    return chamadas


# ── o alcance do retreino diário ──────────────────────────────────────────

@pytest.mark.django_db
def test_quem_so_assiste_no_lumiere_e_retreinado(usuario, agendados):
    """
    O defeito de origem: o filtro era `letterboxd_connected=True`, mas o perfil
    aprende de DUAS fontes. Quem só assiste aqui dentro — o caso principal do
    produto — nunca era alcançado pela tarefa das 3h.
    """
    filme = Movie.objects.create(title='Stalker', year=1979)
    WatchHistory.objects.create(user=usuario, movie=filme, completed=True)
    assert usuario.letterboxd_connected is False

    retrain_all_users()

    assert len(agendados) == 1


@pytest.mark.django_db
def test_quem_so_tem_diario_continua_sendo_retreinado(usuario, agendados):
    filme = Movie.objects.create(title='Solaris', year=1972)
    LetterboxdDiary.objects.create(user=usuario, movie=filme, matched=True,
                                   film_name='Solaris', film_year=1972)

    retrain_all_users()

    assert len(agendados) == 1


@pytest.mark.django_db
def test_quem_nao_tem_nada_nao_e_agendado(usuario, agendados):
    """Agendar a mais é barato, mas não a ponto de agendar para o vazio."""
    retrain_all_users()

    assert agendados == []


@pytest.mark.django_db
def test_exibicao_incompleta_nao_conta(usuario, agendados):
    filme = Movie.objects.create(title='Stalker', year=1979)
    WatchHistory.objects.create(user=usuario, movie=filme, completed=False)

    retrain_all_users()

    assert agendados == []


@pytest.mark.django_db
def test_o_usuario_e_agendado_uma_vez_so(usuario, agendados):
    """
    O JOIN com duas relações multiplica linhas: sem `.distinct()`, quem tem
    dez filmes vistos viraria dez agendamentos do mesmo retreino.
    """
    for i in range(4):
        filme = Movie.objects.create(title=f'Filme {i}', year=1979)
        WatchHistory.objects.create(user=usuario, movie=filme, completed=True)
        LetterboxdDiary.objects.create(user=usuario, movie=filme, matched=True,
                                       film_name=f'Filme {i}', film_year=1979)

    retrain_all_users()

    assert len(agendados) == 1


# ── o resultado que precisa caber no backend ──────────────────────────────

@pytest.mark.django_db
def test_a_tarefa_das_quatro_devolve_algo_serializavel(monkeypatch):
    """
    Devolver o AsyncResult fazia a tarefa terminar o trabalho e falhar ao
    GUARDAR o resultado — o serializador é JSON. Todo dia às 4h a execução
    ficava registrada como falha.
    """
    import kombu.utils.json as kjson

    Movie.objects.create(title='Sem embedding', year=2000)

    class Despacho:
        id = 'abc-123'

    monkeypatch.setattr(ml.generate_movie_embeddings, 'apply_async',
                        lambda *a, **kw: Despacho())

    resultado = update_movie_embeddings()

    kjson.dumps(resultado)  # levanta TypeError se não serializar
    assert resultado['agendados'] == 1
    assert resultado['task_id'] == 'abc-123'


@pytest.mark.django_db
def test_sem_pendentes_tambem_devolve_algo_serializavel():
    import kombu.utils.json as kjson

    kjson.dumps(update_movie_embeddings())


def test_o_lote_das_quatro_e_ordenado():
    """
    Sem ORDER BY o Postgres pode devolver as mesmas 1000 linhas noite após
    noite, e o resto do acervo nunca sai da fila.
    """
    import inspect

    codigo = '\n'.join(
        l for l in inspect.getsource(update_movie_embeddings).split('\n')
        if not l.strip().startswith('#'))
    assert ".order_by('id')" in codigo


# ── a fusão das amostras ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_reexibicao_sem_nota_nao_apaga_a_nota_alta(usuario):
    """
    O dict colapsa várias exibições do mesmo filme na mesma chave, e a última
    gravação vence. Sem ordenação, uma reexibição sem nota podia sobrescrever
    a nota alta — e o resultado mudava entre execuções.
    """
    import numpy as np

    filme = Movie.objects.create(title='Stalker', year=1979,
                                 embedding=np.zeros(1024).tolist())
    LetterboxdDiary.objects.create(user=usuario, movie=filme, matched=True,
                                   film_name='Stalker', film_year=1979,
                                   rating=Decimal('5.0'), watched_date=date(2020, 1, 1))
    LetterboxdDiary.objects.create(user=usuario, movie=filme, matched=True,
                                   film_name='Stalker', film_year=1979,
                                   rating=None, rewatch=True,
                                   watched_date=date(2024, 1, 1))

    amostras = amostras_de_gosto(usuario)

    assert len(amostras) == 1
    assert amostras[0].nota == 5.0
    assert amostras[0].avaliado is True


@pytest.mark.django_db
def test_entre_duas_notas_vence_a_maior(usuario):
    import numpy as np

    filme = Movie.objects.create(title='Solaris', year=1972,
                                 embedding=np.zeros(1024).tolist())
    for nota, quando in [('3.0', date(2024, 1, 1)), ('4.5', date(2019, 1, 1))]:
        LetterboxdDiary.objects.create(user=usuario, movie=filme, matched=True,
                                       film_name='Solaris', film_year=1972,
                                       rating=Decimal(nota), watched_date=quando)

    amostras = amostras_de_gosto(usuario)

    assert amostras[0].nota == 4.5
