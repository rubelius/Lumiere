"""
Testes do cliente OpenSubtitles.

Exercitam a forma da requisição — que é onde a integração quebra na prática —
sem depender da API real. O transporte é simulado, mas o código exercitado é
o de produção, cabeçalhos e parâmetros inclusive.
"""

import asyncio
import json

import httpx
import pytest

from apps.integrations import opensubtitles
from apps.integrations.opensubtitles import OpenSubtitlesClient

RESPOSTA_BUSCA = {
    'data': [
        {
            'attributes': {
                'language': 'pt-BR',
                'download_count': 4210,
                'hearing_impaired': False,
                'from_trusted': True,
                'release': 'Martyrs.2008.1080p.BluRay',
                'files': [{'file_id': 987654, 'file_name': 'Martyrs.pt-BR.srt'}],
            }
        },
        # Sem arquivo: não dá para baixar, tem de ser descartada.
        {'attributes': {'language': 'en', 'files': []}},
    ]
}


def _cliente(handler, token=''):
    c = OpenSubtitlesClient('chave-de-teste', token)
    c.client = httpx.AsyncClient(transport=httpx.MockTransport(handler), headers=c.client.headers)
    return c


def test_busca_manda_api_key_e_user_agent():
    capturado = {}

    def handler(req):
        capturado['headers'] = req.headers
        capturado['url'] = str(req.url)
        return httpx.Response(200, json=RESPOSTA_BUSCA)

    c = _cliente(handler)
    asyncio.run(c.buscar(imdb_id='tt0846297'))

    assert capturado['headers']['api-key'] == 'chave-de-teste'
    # Sem User-Agent a API responde 403.
    assert capturado['headers']['user-agent'] == opensubtitles.USER_AGENT


def test_imdb_id_vai_sem_o_prefixo_tt_e_sem_zeros():
    """A API espera a parte numérica: tt0133093 -> 133093."""
    capturado = {}

    def handler(req):
        capturado['url'] = str(req.url)
        return httpx.Response(200, json=RESPOSTA_BUSCA)

    asyncio.run(_cliente(handler).buscar(imdb_id='tt0133093'))
    assert 'imdb_id=133093' in capturado['url']


def test_busca_por_titulo_quando_nao_ha_imdb():
    capturado = {}

    def handler(req):
        capturado['url'] = str(req.url)
        return httpx.Response(200, json=RESPOSTA_BUSCA)

    asyncio.run(_cliente(handler).buscar(titulo='Martyrs', ano=2008))
    assert 'query=Martyrs' in capturado['url']
    assert 'year=2008' in capturado['url']


def test_sem_imdb_nem_titulo_nao_chama_a_api():
    def handler(req):
        raise AssertionError('não deveria ter chamado a API')

    assert asyncio.run(_cliente(handler).buscar()) == []


def test_resultado_e_resumido_e_descarta_o_que_nao_tem_arquivo():
    c = _cliente(lambda req: httpx.Response(200, json=RESPOSTA_BUSCA))
    r = asyncio.run(c.buscar(imdb_id='tt0846297'))

    assert len(r) == 1          # a entrada sem `files` sai
    assert r[0]['file_id'] == 987654
    assert r[0]['idioma'] == 'pt-BR'
    assert r[0]['downloads'] == 4210


def test_erro_http_na_busca_devolve_lista_vazia():
    """Provedor fora do ar não pode derrubar a tela do filme."""
    c = _cliente(lambda req: httpx.Response(503))
    assert asyncio.run(c.buscar(imdb_id='tt0846297')) == []


def test_download_exige_token_de_usuario():
    """A chave da aplicação não substitui o login: a cota é da conta."""
    def handler(req):
        raise AssertionError('não deveria chamar /download sem token')

    assert asyncio.run(_cliente(handler, token='').link_de_download(987654)) is None


def test_download_manda_bearer_e_o_file_id():
    capturado = {}

    def handler(req):
        capturado['auth'] = req.headers.get('authorization')
        capturado['corpo'] = json.loads(req.content)
        return httpx.Response(200, json={'link': 'https://cdn.exemplo/leg.srt'})

    link = asyncio.run(_cliente(handler, token='tok123').link_de_download(987654))

    assert link == 'https://cdn.exemplo/leg.srt'
    assert capturado['auth'] == 'Bearer tok123'
    assert capturado['corpo'] == {'file_id': 987654}
