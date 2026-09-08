"""
Testes da leitura de nomes de release.

Ligar um release ao filme errado é pior do que não ligar: o player tocaria
outra obra. Os casos abaixo são nomes reais, incluindo os que já me enganaram.
"""

import pytest

from apps.movies.release_naming import extrai_imdb_id, extrai_titulo_e_ano, parece_serie


@pytest.mark.parametrize('nome,esperado', [
    ('The.Lobster.2015.Bluray.1080p.DTS-HD.x264-Grym', ('The Lobster', 2015)),
    ('Beau Is Afraid (2023) [2160p] [4K] [WEB] [5.1] [YTS.MX]', ('Beau Is Afraid', 2023)),
    ('The.Wild.Robot.2024.2160p.UHD.Blu-ray.Remux.DV.HDR.HEVC.TrueHD', ('The Wild Robot', 2024)),
    ('The.Lobster.2015.1080i.BluRay.AVC.DTS-HD.MA.5.1-RARBG', ('The Lobster', 2015)),
])
def test_extrai_titulo_e_ano_de_nomes_reais(nome, esperado):
    assert extrai_titulo_e_ano(nome) == esperado


@pytest.mark.parametrize('nome,esperado', [
    # O título contém um número de quatro dígitos: o ano de lançamento é o
    # que vem seguido de marcador de qualidade, não o primeiro que aparece.
    ('2001.A.Space.Odyssey.1968.2160p.BluRay.REMUX', ('2001 A Space Odyssey', 1968)),
    ('Blade.Runner.2049.2017.2160p.UHD.BluRay', ('Blade Runner 2049', 2017)),
    ('1917.2019.1080p.BluRay.x264', ('1917', 2019)),
    ('Space.Odyssey.2010.1984.1080p.WEB-DL', ('Space Odyssey 2010', 1984)),
])
def test_nao_confunde_numero_do_titulo_com_ano(nome, esperado):
    assert extrai_titulo_e_ano(nome) == esperado


@pytest.mark.parametrize('nome', [
    '',
    'sem ano nenhum aqui',
    '2015',            # só o ano, sem título antes
    '1080p.BluRay',
])
def test_devolve_none_quando_nao_da_para_afirmar(nome):
    assert extrai_titulo_e_ano(nome) is None


@pytest.mark.parametrize('nome', [
    'Rick.and.Morty.S01.1080p.BluRay.REMUX.VC-1.TrueHD.5.1-NOGRP',
    'Rick and Morty (2013) [Season 1] BD-Remux 1080p',
    'S03E01 The Rickshank Rickdemption.mkv',
    'Breaking.Bad.Complete.Series.1080p',
])
def test_reconhece_serie(nome):
    assert parece_serie(nome) is True


@pytest.mark.parametrize('nome', [
    'The.Lobster.2015.Bluray.1080p',
    'Beau Is Afraid (2023) [2160p]',
])
def test_filme_nao_e_confundido_com_serie(nome):
    assert parece_serie(nome) is False


def test_extrai_imdb_id_quando_o_grupo_embute():
    nome = 'The Death of Robin Hood (2026) WEB.DL 2160p SDR {imdb-tt3227312}'
    assert extrai_imdb_id(nome) == 'tt3227312'


def test_sem_imdb_no_nome_devolve_none():
    assert extrai_imdb_id('The.Lobster.2015.Bluray.1080p') is None


from apps.movies.release_naming import normaliza_titulo


@pytest.mark.parametrize('release, acervo', [
    # O caso que apareceu na conta real: o release perde os dois-pontos.
    ('Avatar The Way of Water', 'Avatar: The Way of Water'),
    ("Guillermo del Toros Pinocchio", "Guillermo del Toro's Pinocchio"),
    ('Mulholland Dr', 'Mulholland Dr.'),
    ('Cidade de Deus', 'Cidade de Deus'),
    # Acento: o acervo é em português, os releases raramente têm.
    ('Martires', 'Mártires'),
    ('2001 A Space Odyssey', '2001: A Space Odyssey'),
    ('Amelie', 'Amélie'),
])
def test_pontuacao_e_acento_nao_sao_diferenca_de_conteudo(release, acervo):
    assert normaliza_titulo(release) == normaliza_titulo(acervo)


@pytest.mark.parametrize('a, b', [
    ('The Lobster', 'The Lobster Kid'),
    ('Beau Is Afraid', 'Finally Home: Making Beau is Afraid'),
    ('Pinocchio', "Guillermo del Toro's Pinocchio"),
    ('Blade Runner', 'Blade Runner 2049'),
    ('Alien', 'Aliens'),
])
def test_normalizar_nao_transforma_filmes_diferentes_em_iguais(a, b):
    """
    O acervo tem 26 mil filmes, e vários são o making-of ou a continuação de
    outro. Normalizar remove pontuação, não palavras: casar errado liga a
    cópia de um filme na ficha de outro, o que é pior que não casar.
    """
    assert normaliza_titulo(a) != normaliza_titulo(b)


def test_normalizar_titulo_vazio_nao_casa_com_nada():
    """
    String vazia é igual a string vazia. Sem esta guarda, todo filme sem
    título original casaria com qualquer release cujo título sumisse na
    extração.
    """
    assert normaliza_titulo('') == ''
    assert normaliza_titulo(None) == ''
    assert normaliza_titulo('...') == ''


@pytest.mark.parametrize('a, b', [
    ('Spider-Man', 'Spider Man'),          # hífen precisa virar espaço
    ("Toro's", 'Toros'),                   # apóstrofo precisa sumir
    ('Rock’n’Roll', 'Rocknroll'),          # apóstrofo tipográfico também
])
def test_pontuacao_tem_dois_comportamentos(a, b):
    """
    Apóstrofo some, o resto vira espaço. Tratar os dois igual quebra um dos
    casos: apóstrofo virando espaço separa palavra que era uma só, e
    pontuação sumindo junta palavra que era duas.
    """
    assert normaliza_titulo(a) == normaliza_titulo(b)


# ── esta cópia é deste filme? ─────────────────────────────────────────────

@pytest.mark.django_db
def test_copia_de_outro_filme_do_mesmo_ano_e_recusada():
    """
    O defeito de origem, com os nomes reais. Nenhum tracker cataloga
    "東京物語", então os indexadores casaram só o ANO e devolveram 44 cópias
    de filmes de 1953 — "From Here to Eternity", "Shane", "Peter Pan". A ficha
    ficou cheia de cópias de outros filmes.
    """
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(
        title='Era Uma Vez em Tóquio', original_title='東京物語', year=1953,
        alternative_titles=[{'title': 'Tokyo Story', 'country': 'US'}])

    assert e_do_filme('Tokyo.Story.1953.Criterion.1080p.BluRay.x265', filme) is True
    for intruso in [
        'From.Here.to.Eternity.1953.HDR.DV.2160p.UHD.HEVC.TrueHD.Atmos-SARTRE',
        'Shane 1953 2160p UHD Blu-ray Remux DV HDR HEVC FLAC1 0-CiNEPHiLES',
        'Peter Pan 1953 PROPER 1080p BluRay REMUX AVC DTS-HD MA 7 1-FraMeSToR',
    ]:
        assert e_do_filme(intruso, filme) is False, intruso


@pytest.mark.django_db
def test_o_ano_errado_e_recusado_mesmo_com_o_titulo_certo():
    """Remake tem o mesmo nome e não é o mesmo filme."""
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(title='Solaris', original_title='Солярис', year=1972)

    assert e_do_filme('Solaris.1972.Criterion.1080p.BluRay', filme) is True
    assert e_do_filme('Solaris.2002.1080p.BluRay', filme) is False


@pytest.mark.django_db
def test_o_imdb_no_nome_vale_mais_que_o_titulo():
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(title='Qualquer', original_title='Qualquer',
                                 year=1953, imdb_id='tt0046438')

    assert e_do_filme('Nome.Totalmente.Outro.1953.[tt0046438].1080p', filme) is True


@pytest.mark.django_db
def test_sem_ano_no_nome_a_copia_e_recusada():
    """
    Sem ano não dá para separar um remake do original, e é justamente aí que
    casar errado dói mais.
    """
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(title='Solaris', original_title='Solaris', year=1972)

    assert e_do_filme('Solaris 1080p BluRay x264', filme) is False


@pytest.mark.django_db
def test_a_busca_usa_o_titulo_que_os_trackers_conhecem():
    """
    "東京物語" não aparece em tracker nenhum; "Tokyo Story" aparece em todos, e
    mora nos títulos alternativos do TMDB — que o acervo já guarda para 16.934
    dos 25.908 filmes.
    """
    from apps.movies.models import Movie
    from apps.movies.release_naming import titulos_para_buscar

    filme = Movie.objects.create(
        title='Era Uma Vez em Tóquio', original_title='東京物語', year=1953,
        alternative_titles=[
            {'title': 'Cuentos de Tokyo', 'country': 'ES'},
            {'title': 'Tokyo Story', 'country': 'US'},
            {'title': 'Die Reise nach Tokyo', 'country': 'DE'},
        ])

    assert titulos_para_buscar(filme) == ['東京物語', 'Era Uma Vez em Tóquio', 'Tokyo Story']


@pytest.mark.django_db
def test_a_lista_de_busca_para_em_tres():
    """Cada consulta ao Prowlarr custa de 40 a 100 segundos."""
    from apps.movies.models import Movie
    from apps.movies.release_naming import titulos_para_buscar

    filme = Movie.objects.create(
        title='A', original_title='B', year=2000,
        alternative_titles=[{'title': f'Nome {i}', 'country': 'US'} for i in range(9)])

    assert len(titulos_para_buscar(filme)) <= 3


@pytest.mark.django_db
def test_o_prefixo_nao_confunde_franquia():
    """
    O casamento por prefixo aceita "Alien 3" para quem se chama "Alien" — e o
    que impede o estrago é a exigência do ANO, que roda antes. Sequência
    raramente estreia no mesmo ano do original.
    """
    from apps.movies.models import Movie
    from apps.movies.release_naming import _bate, e_do_filme

    # A regra crua é permissiva, e isso é reconhecido:
    assert _bate('alien 3', {'alien'}) is True
    # Mas o espaço impede o prefixo de virar substring solto:
    assert _bate('aliens', {'alien'}) is False

    alien = Movie.objects.create(title='Alien', original_title='Alien', year=1979)
    assert e_do_filme('Alien.1979.1080p.BluRay', alien) is True
    assert e_do_filme('Alien.3.1992.1080p.BluRay', alien) is False, 'o ano é a guarda'


@pytest.mark.django_db
def test_titulo_multiplo_de_tracker_russo_e_reconhecido():
    """
    Trackers russos e italianos empilham nomes com barra. Comparar a linha
    inteira recusava 12 cópias legítimas das 105 do acervo.
    """
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(title='Os Infiltrados', original_title='The Departed',
                                 year=2006)

    assert e_do_filme(
        'Отступники / The Departed [2006, США, триллер, BDRemux 2160p]', filme) is True


@pytest.mark.django_db
def test_entidade_html_no_nome_nao_atrapalha():
    from apps.movies.models import Movie
    from apps.movies.release_naming import e_do_filme

    filme = Movie.objects.create(title='2001: Uma Odisséia no Espaço',
                                 original_title='2001: A Space Odyssey', year=1968)

    assert e_do_filme(
        '2001 - Uma Odiss&eacute;ia no Espa&ccedil;o 1080p (1968) Dublado', filme) is True
