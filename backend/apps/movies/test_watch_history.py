"""
Testes do histórico de exibição.

O contrato que importa: `completed` é o que a interface chama de "assistido",
e `registra_progresso` avisa uma única vez que o filme acabou de ser
concluído — é esse aviso que dispara o retreino do perfil de gosto, e
dispará-lo a cada ping repetiria trabalho sem informação nova.
"""

import pytest

from apps.movies.models import Movie, WatchHistory


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Stalker', year=1979, length_minutes=162)


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(username='cinefilo', password='x')


def registro(usuario, filme, **kwargs):
    return WatchHistory.objects.create(user=usuario, movie=filme, **kwargs)


@pytest.mark.django_db
def test_progresso_abaixo_do_limite_nao_conclui(usuario, filme):
    r = registro(usuario, filme)
    assert r.registra_progresso(segundos=4000, duracao=9720) is False
    assert r.completed is False
    assert r.times_watched == 0


@pytest.mark.django_db
def test_passar_do_limite_conclui_e_avisa_uma_vez(usuario, filme):
    """
    Só a primeira travessia devolve True. O player manda progresso de tempos
    em tempos; se cada ping depois do fim dissesse "concluiu agora", o perfil
    de gosto seria retreinado em loop pelo mesmo filme.
    """
    r = registro(usuario, filme)
    assert r.registra_progresso(segundos=8800, duracao=9720) is True
    assert r.completed is True
    assert r.times_watched == 1

    assert r.registra_progresso(segundos=9000, duracao=9720) is False
    assert r.times_watched == 1


@pytest.mark.django_db
def test_creditos_nao_impedem_de_marcar_como_visto(usuario, filme):
    """
    Exigir 100% deixaria o histórico vazio: quase ninguém assiste os créditos
    até o fim, e muitos param assim que a última cena termina.
    """
    r = registro(usuario, filme)
    # 91% — parou nos créditos.
    assert r.registra_progresso(segundos=8845, duracao=9720) is True


@pytest.mark.django_db
def test_duracao_desconhecida_nunca_conclui_sozinha(usuario, filme):
    """
    Sem duração não há fração, e chutar concluiria o filme no primeiro
    segundo. Melhor não marcar do que marcar errado: um filme marcado como
    visto some das sugestões.
    """
    r = registro(usuario, filme)
    assert r.registra_progresso(segundos=5000, duracao=0) is False
    assert r.fracao_assistida == 0.0
    assert r.completed is False


@pytest.mark.django_db
def test_rever_incrementa_em_vez_de_criar_linha_nova(usuario, filme):
    """
    Rever é sinal mais forte, não um segundo filme. Uma linha por par mantém
    a pergunta "já vi?" como um EXISTS barato em toda listagem do acervo.
    """
    r = registro(usuario, filme)
    r.registra_progresso(segundos=9000, duracao=9720)
    r.save()

    r.completed = False              # o player recomeçou do zero
    r.registra_progresso(segundos=9000, duracao=9720)
    r.save()

    assert WatchHistory.objects.filter(user=usuario, movie=filme).count() == 1
    assert r.times_watched == 2


@pytest.mark.django_db
def test_um_registro_por_filme_por_usuario(usuario, filme):
    from django.db import IntegrityError

    registro(usuario, filme)
    with pytest.raises(IntegrityError):
        registro(usuario, filme)


@pytest.mark.django_db
def test_progresso_negativo_nao_vira_posicao(usuario, filme):
    """O <video> pode reportar tempo negativo em seek; o campo é PositiveInteger."""
    r = registro(usuario, filme)
    r.registra_progresso(segundos=-30, duracao=9720)
    assert r.progress_seconds == 0


@pytest.mark.django_db
def test_fracao_nunca_passa_de_um(usuario, filme):
    """
    A duração do arquivo diverge do metadado, e o <video> aceita seek além do
    fim. Sem o teto, a fração passaria de 1 e a barra de progresso da tela
    estouraria o próprio trilho.
    """
    r = registro(usuario, filme)
    r.registra_progresso(segundos=12000, duracao=9720)
    assert r.fracao_assistida == 1.0
