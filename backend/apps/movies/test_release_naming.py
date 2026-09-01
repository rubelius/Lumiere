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
