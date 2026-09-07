"""
Testes da sincronização com Plex e Letterboxd.

Três defeitos motivaram estes testes: um campo que o modelo não tinha e que
duas rotinas escreviam, uma flag que só subia, e dois casamentos difusos que
escolhiam entre uma minoria sorteada pelo banco.
"""

import pytest

from apps.movies.models import Movie


@pytest.fixture
def acervo(db):
    """Um ano com mais candidatos do que qualquer fatia antiga deixaria passar."""
    for i in range(120):
        Movie.objects.create(title=f'Filme Qualquer {i}', original_title=f'Some Film {i}',
                             year=2006)
    return Movie.objects.create(title='Os Infiltrados', original_title='The Departed',
                                year=2006)


def codigo_de(fn) -> str:
    """
    O código da função, sem comentários.

    Procurar "[:100]" no fonte cru encontra o comentário que EXPLICA o defeito
    removido — o mesmo tropeço que uma guarda deste projeto já deu com
    docstrings. O que interessa é a instrução, não a prosa sobre ela.
    """
    import inspect

    return '\n'.join(
        linha for linha in inspect.getsource(fn).split('\n')
        if not linha.strip().startswith('#')
    )


# ── o campo que faltava ───────────────────────────────────────────────────

def test_o_modelo_tem_a_chave_do_plex():
    """
    Duas rotinas escreviam `movie.plex_rating_key` num modelo que não tinha o
    campo: na task a atribuição não fazia nada, e na view o
    `save(update_fields=[...])` levantava ValueError no primeiro filme que
    casasse. E apps/integrations/views.py LÊ esse campo para montar a playlist
    de uma sessão — o campo não era morto, estava faltando.
    """
    campos = {f.name for f in Movie._meta.get_fields()}
    assert 'plex_rating_key' in campos


@pytest.mark.django_db
def test_gravar_a_chave_do_plex_nao_levanta():
    filme = Movie.objects.create(title='Stalker', year=1979)
    filme.in_plex = True
    filme.plex_rating_key = '12345'
    filme.save(update_fields=['in_plex', 'plex_rating_key'])

    filme.refresh_from_db()
    assert filme.plex_rating_key == '12345'


# ── a flag que só subia ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_filme_apagado_do_plex_deixa_de_ser_marcado():
    """
    `in_plex` tinha três escritas no projeto, todas `= True`. Filme removido
    do servidor ficava anunciado como disponível para sempre.
    """
    ficou = Movie.objects.create(title='Fica', year=1979, in_plex=True,
                                 plex_rating_key='100')
    sumiu = Movie.objects.create(title='Some', year=1980, in_plex=True,
                                 plex_rating_key='200')

    vistas = {'100'}
    Movie.objects.filter(in_plex=True).exclude(plex_rating_key='').exclude(
        plex_rating_key__in=vistas).update(in_plex=False, plex_rating_key='')

    ficou.refresh_from_db(); sumiu.refresh_from_db()
    assert ficou.in_plex is True
    assert sumiu.in_plex is False


@pytest.mark.django_db
def test_filme_sem_chave_gravada_nao_e_desmarcado_por_suposicao():
    """
    Quem foi marcado antes do campo existir não tem chave. Desmarcá-lo seria
    trocar uma afirmação sem base por outra.
    """
    antigo = Movie.objects.create(title='Marcado antes', year=1979, in_plex=True,
                                  plex_rating_key='')

    Movie.objects.filter(in_plex=True).exclude(plex_rating_key='').exclude(
        plex_rating_key__in={'100'}).update(in_plex=False, plex_rating_key='')

    antigo.refresh_from_db()
    assert antigo.in_plex is True


def test_a_varredura_so_roda_com_leitura_boa():
    """
    Biblioteca vazia é indistinguível de leitura falha. Por isso a varredura
    fica atrás de `if vistas:` — sem isso, um erro do Plex desmarcaria o
    acervo inteiro.
    """
    from apps.tasks import integrations

    fonte = codigo_de(integrations.sync_plex_library)
    assert 'if vistas:' in fonte
    assert 'response.raise_for_status()' in fonte


# ── os casamentos difusos ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_o_casamento_do_diario_ve_o_acervo_inteiro_do_ano(acervo):
    """
    `[:100]` sem ORDER BY escolhia 100 linhas arbitrárias, e 95 dos 137 anos
    do acervo têm mais de 100 filmes. O filme certo podia nem entrar na
    amostra — e o casamento errado é permanente.
    """
    from apps.tasks import integrations

    assert '[:100]' not in codigo_de(integrations.sync_letterboxd_diary)
    assert Movie.objects.filter(year=2006).count() > 100


@pytest.mark.django_db
def test_o_diario_casa_pelo_titulo_original(acervo):
    """
    O Letterboxd cataloga pelo original e o acervo guarda o localizado. 38%
    dos 25.908 filmes têm os dois diferentes: comparar só com `title`
    procurava "The Departed" contra "Os Infiltrados".
    """
    from rapidfuzz import fuzz

    procurado = 'the departed'
    melhor, nota = None, 0
    for filme in Movie.objects.filter(year=2006):
        s = max(fuzz.ratio(procurado, (filme.title or '').lower()),
                fuzz.ratio(procurado, (filme.original_title or '').lower()))
        if s > nota:
            melhor, nota = filme, s

    assert melhor == acervo
    assert nota > 85, f'nota {nota} não passaria do limiar'

    # E só com o título localizado não passaria.
    so_localizado = max(
        fuzz.ratio(procurado, (f.title or '').lower())
        for f in Movie.objects.filter(year=2006))
    assert so_localizado <= 85, 'o teste não estaria provando nada'


@pytest.mark.django_db
def test_o_casamento_do_plex_ve_o_acervo_inteiro_do_ano():
    from apps.tasks import integrations

    assert '[:50]' not in codigo_de(integrations.sync_plex_library)


def test_o_sync_do_letterboxd_nao_reescreve_o_usuario_inteiro():
    """
    `user.save()` sem update_fields grava a linha toda a partir de uma cópia
    lida antes do scraping, que leva minutos.
    """
    from apps.tasks import integrations

    assert "user.save(update_fields=['letterboxd_last_sync'])" in codigo_de(
        integrations.sync_letterboxd_diary)
