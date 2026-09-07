"""
Testes de como o nome de uma release declara resolução.

A ordem antiga testava ['2160P', 'UHD', '4K'] primeiro, então qualquer nome que
mencionasse UHD virava 2160p — inclusive os que diziam 1080p com todas as
letras. O estrago não era só o rótulo: 2160p vale video_score 20 contra 15 do
1080p, então o arquivo menor subia à frente dos 2160p de verdade e passava por
um filtro de min_resolution que deveria barrá-lo.
"""

import pytest

from apps.movies.utils import (RESOLUCOES, parse_quality_from_title,
                               resolucao_do_titulo)


def resolve(titulo):
    return resolucao_do_titulo(titulo.upper())


# ── o token explícito vence ───────────────────────────────────────────────

@pytest.mark.parametrize('titulo', [
    'The Departed 2006 1080p UHD BluRay x265 HDR DD 5.1-Pahe.in',
    'The Departed 2006 1080p HEVC 10-bit SDR from 4K BluRay Source',
    'Stalker 1979 1080p remaster do UHD',
])
def test_uhd_na_fonte_nao_promove_um_1080p(titulo):
    """
    "1080p UHD BluRay" é um 1080p feito a partir do disco UHD: a palavra
    descreve a fonte do encode, não o arquivo. Duas das 28 cópias do acervo
    estavam gravadas como 2160p por causa disso.
    """
    assert resolve(titulo) == ('1080p', False)


def test_o_2160p_declarado_continua_sendo_4k():
    assert resolve('The.Departed.2006.2160p.UHD.BluRay.REMUX') == ('2160p', True)


@pytest.mark.parametrize('titulo,esperado', [
    ('Solaris 1972 720p BrRip', '720p'),
    ('Aurora 1927 480p DVDRip', '480p'),
])
def test_resolucoes_menores_sao_lidas_como_estao(titulo, esperado):
    assert resolve(titulo) == (esperado, False)


def test_versao_dupla_fica_com_a_maior():
    """O que se pode assistir é a melhor das duas que vêm no mesmo torrent."""
    assert resolve('Filme 2020 2160p e 1080p dual') == ('2160p', True)


# ── UHD só quando não há token ────────────────────────────────────────────

@pytest.mark.parametrize('titulo', [
    'The Departed 2006 REPACK COMPLETE UHD BLURAY',
    'Stalker 1979 4K Restoration BDRemux',
])
def test_sem_token_algum_o_uhd_decide(titulo):
    assert resolve(titulo) == ('2160p', True)


def test_sem_sinal_nenhum_cai_no_piso():
    assert resolve('The Departed (2006) BRRip XviD AC3') == ('480p', False)


# ── o contrato com quem consome ───────────────────────────────────────────

@pytest.mark.parametrize('titulo', [
    'x 1080p UHD', 'x 2160p', 'x UHD', 'x 720p', 'x nada', 'x 480p 4K',
])
def test_a_resolucao_devolvida_e_sempre_ordenavel(titulo):
    """
    `passa_no_filtro` faz RESOLUCOES.index(): um valor fora da lista manda a
    release para o fim da ordem em silêncio, e ela some do resultado.
    """
    resolucao, _ = resolve(titulo)
    assert resolucao in RESOLUCOES


@pytest.mark.parametrize('titulo', [
    'x 1080p UHD', 'x 2160p UHD', 'x UHD', 'x 720p', 'x nada',
])
def test_is_4k_nunca_discorda_da_resolucao(titulo):
    """Dois campos, uma verdade: score e filtro leem um cada."""
    resolucao, is_4k = resolve(titulo)
    assert is_4k == (resolucao == '2160p')


def test_o_parser_inteiro_usa_a_mesma_regra():
    dados = parse_quality_from_title('The Departed 2006 1080p UHD BluRay x265 HDR')
    assert dados['resolution'] == '1080p'
    assert dados['is_4k'] is False


# ── a sigla DV ────────────────────────────────────────────────────────────

@pytest.mark.parametrize('titulo', [
    'The.Departed.2006.DVDRip.XviD',
    'Solaris.1972.Criterion.DVD5',
    'The Departed 2006 REPACK COMPLETE UHD BLURAY 4KDVS',
])
def test_dv_dentro_de_outra_palavra_nao_e_dolby_vision(titulo):
    """
    `'DV' in titulo` casava como substring. Três das 28 cópias do acervo
    estavam marcadas como Dolby Vision sem que o nome dissesse nada disso.
    """
    assert parse_quality_from_title(titulo)['has_dolby_vision'] is False


@pytest.mark.parametrize('titulo', [
    'Aurora.1927.1080p.BluRay.DV.HDR10',
    'Stalker 1979 Dolby Vision 2160p',
    'Solaris.1972.2160p.DoVi.HDR',
    'Filme 2020 2160p Dolby-Vision',
])
def test_dolby_vision_de_verdade_continua_sendo_reconhecido(titulo):
    assert parse_quality_from_title(titulo)['has_dolby_vision'] is True
