"""
Testes da recomendação personalizada.

O contrato que importa: sem perfil não se inventa recomendação, o que já foi
visto não volta, e um perfil formado por um autor só não devolve a
filmografia dele inteira.
"""

import pytest

from apps.ml.constants import EMBEDDING_DIMENSIONS
from apps.ml.models import UserTasteProfile
from apps.ml.similarity import MAX_POR_DIRETOR, recomenda_para
from apps.movies.models import Movie, WatchHistory


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(username='cinefilo', password='x')


def vetor(valor=0.1):
    return [valor] * EMBEDDING_DIMENSIONS


def com_perfil(usuario, v=None):
    return UserTasteProfile.objects.create(user=usuario, embedding=v or vetor())


@pytest.mark.django_db
def test_sem_perfil_nao_recomenda_nada(usuario):
    """
    Sem perfil o que daria para mostrar é popularidade, e apresentar
    popularidade como personalização é a mentira que a tela toda evita.
    """
    Movie.objects.create(title='Solaris', year=1972, embedding=vetor())
    assert recomenda_para(usuario) == []


@pytest.mark.django_db
def test_recomenda_filme_com_embedding(usuario):
    filme = Movie.objects.create(title='Solaris', year=1972, embedding=vetor())
    com_perfil(usuario)
    assert [f.id for f in recomenda_para(usuario)] == [filme.id]


@pytest.mark.django_db
def test_o_que_ja_foi_visto_nao_volta(usuario):
    """
    Diferente das obras correlatas, onde o visto só desce: aqui a pergunta é
    'o que vejo agora', e responder com o que a pessoa já viu não é resposta.
    """
    visto = Movie.objects.create(title='Visto', year=2000, embedding=vetor())
    novo = Movie.objects.create(title='Novo', year=2001, embedding=vetor())
    WatchHistory.objects.create(user=usuario, movie=visto, completed=True)
    com_perfil(usuario)

    assert [f.id for f in recomenda_para(usuario)] == [novo.id]


@pytest.mark.django_db
def test_filme_comecado_e_nao_terminado_ainda_pode_ser_recomendado(usuario):
    """Abandonar aos vinte minutos não é ter visto."""
    filme = Movie.objects.create(title='Abandonado', year=2000, embedding=vetor())
    WatchHistory.objects.create(user=usuario, movie=filme, completed=False,
                                progress_seconds=1200)
    com_perfil(usuario)

    assert [f.id for f in recomenda_para(usuario)] == [filme.id]


@pytest.mark.django_db
def test_um_diretor_nao_toma_a_lista(usuario):
    """
    Um perfil formado por muitos filmes do mesmo autor devolveria a
    filmografia dele inteira — o mesmo vício das obras correlatas, na tela
    onde ele seria mais visível.
    """
    for i in range(10):
        Movie.objects.create(title=f'Bergman {i}', year=1960 + i,
                             director='Ingmar Bergman', embedding=vetor())
    Movie.objects.create(title='Outro', year=1970, director='Tarkovsky',
                         embedding=vetor())
    com_perfil(usuario)

    diretores = [f.director for f in recomenda_para(usuario, limite=10)]
    assert diretores.count('Ingmar Bergman') == MAX_POR_DIRETOR


@pytest.mark.django_db
def test_filme_sem_embedding_nao_entra(usuario):
    """Sem vetor não há distância; entrar na lista seria entrar por acaso."""
    Movie.objects.create(title='Sem vetor', year=2000)
    com_perfil(usuario)
    assert recomenda_para(usuario) == []


@pytest.mark.django_db
def test_respeita_o_limite_pedido(usuario):
    for i in range(30):
        Movie.objects.create(title=f'Filme {i}', year=2000 + i,
                             director=f'Diretor {i}', embedding=vetor())
    com_perfil(usuario)
    assert len(recomenda_para(usuario, limite=5)) == 5
