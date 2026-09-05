"""
Testes da conversão SRT -> WebVTT.

Legenda que não converte falha em silêncio: o <track> simplesmente não mostra
nada, sem erro. Por isso os casos aqui são os formatos torpes que legenda de
internet realmente tem.
"""

from apps.movies.subtitles import srt_para_vtt

SRT_SIMPLES = """1
00:00:01,000 --> 00:00:04,000
Primeira fala.

2
00:00:05,500 --> 00:00:08,250
Segunda fala,
em duas linhas.
"""


def test_gera_cabecalho_webvtt():
    assert srt_para_vtt(SRT_SIMPLES).startswith('WEBVTT\n\n')


def test_virgula_do_timestamp_vira_ponto():
    vtt = srt_para_vtt(SRT_SIMPLES)
    assert '00:00:01.000 --> 00:00:04.000' in vtt
    assert ',000 -->' not in vtt


def test_preserva_o_texto_e_as_quebras():
    vtt = srt_para_vtt(SRT_SIMPLES)
    assert 'Primeira fala.' in vtt
    assert 'Segunda fala,\nem duas linhas.' in vtt


def test_remove_numeracao_de_bloco():
    """Número solto viraria legenda se o arquivo estivesse malformado."""
    corpo = srt_para_vtt(SRT_SIMPLES).replace('WEBVTT\n\n', '')
    assert not any(l.strip() == '1' for l in corpo.split('\n'))


def test_tolera_bom_e_crlf():
    """Arquivo salvo no Windows, que é o caso comum."""
    vtt = srt_para_vtt('﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nOlá.\r\n')
    assert vtt.startswith('WEBVTT')
    assert '\r' not in vtt
    assert '00:00:01.000 --> 00:00:02.000' in vtt
    assert 'Olá.' in vtt


def test_remove_tags_de_posicionamento_ssa():
    """{\\an8} apareceria como texto na tela."""
    vtt = srt_para_vtt('1\n00:00:01,000 --> 00:00:02,000\n{\\an8}No topo.\n')
    assert '{\\an8}' not in vtt
    assert 'No topo.' in vtt


def test_preserva_italico_html():
    """<i> é válido nos dois formatos e carrega ênfase da fala."""
    vtt = srt_para_vtt('1\n00:00:01,000 --> 00:00:02,000\n<i>sussurrando</i>\n')
    assert '<i>sussurrando</i>' in vtt


def test_completa_hora_quando_o_timestamp_vem_curto():
    vtt = srt_para_vtt('1\n01:20,000 --> 01:25,000\nSem hora.\n')
    assert '00:01:20.000 --> 00:01:25.000' in vtt


def test_milissegundos_curtos_sao_preenchidos():
    vtt = srt_para_vtt('1\n00:00:01,5 --> 00:00:02,25\nOi.\n')
    assert '00:00:01.500 --> 00:00:02.250' in vtt


def test_ja_em_vtt_continua_valido():
    """Alguns provedores entregam VTT direto; passar de novo não pode estragar."""
    vtt = srt_para_vtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOi.\n')
    assert vtt.count('WEBVTT') == 1
    assert '00:00:01.000 --> 00:00:02.000' in vtt


def test_entrada_vazia_nao_quebra():
    for entrada in (None, '', '   '):
        assert srt_para_vtt(entrada).startswith('WEBVTT')


def test_legenda_que_e_so_um_numero_sobrevive():
    """
    Descartar toda linha só de dígitos apagava a fala, não a numeração: uma
    legenda que diz '1984' ou '911' simplesmente sumia da tela, e nada no
    arquivo indicava que ela existira.

    O que define numeração de bloco é a posição — logo antes do tempo.
    """
    srt = (
        '1\n'
        '00:00:01,000 --> 00:00:03,000\n'
        '1984\n'
        '\n'
        '2\n'
        '00:00:04,000 --> 00:00:06,000\n'
        '911\n'
    )
    vtt = srt_para_vtt(srt)

    assert '1984' in vtt, 'fala numérica descartada como se fosse numeração'
    assert '911' in vtt
    # A numeração de bloco continua sendo removida.
    assert '\n1\n' not in vtt
    assert '\n2\n' not in vtt


def test_numero_isolado_no_fim_do_arquivo_nao_e_confundido_com_numeracao():
    """Sem tempo depois dele, o número é conteúdo — não há bloco para numerar."""
    srt = (
        '1\n'
        '00:00:01,000 --> 00:00:03,000\n'
        '42\n'
    )
    assert '42' in srt_para_vtt(srt)
