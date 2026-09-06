"""
Testes da checagem de cache no Real-Debrid.

É esta consulta que decide se a tela pode dizer "toca agora". Errar para o
lado otimista anuncia um filme que não vai tocar; errar para o pessimista faz
o acervo inteiro parecer offline.
"""

import httpx
import pytest

from apps.integrations.realdebrid import (RealDebridClient,
                                          RealDebridIndisponivel)


class _Resposta:
    def __init__(self, status=200, payload=None, texto=None):
        self.status_code = status
        self._payload = payload
        self._texto = texto

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError('erro', request=None, response=self)  # type: ignore

    def json(self):
        if self._texto is not None:
            raise ValueError('não é json')
        return self._payload


def _responde(*respostas, capturado=None):
    """Uma resposta por chamada, na ordem."""
    fila = list(respostas)

    async def falso(url, **kw):
        if capturado is not None:
            capturado.setdefault('urls', []).append(url)
        return fila.pop(0) if len(fila) > 1 else fila[0]

    return falso


@pytest.mark.asyncio
async def test_cacheado_e_nao_cacheado(monkeypatch):
    c = RealDebridClient('k')
    # Dicionário preenchido = cacheado; vazio = conhecido, mas sem arquivo.
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload={
        'a' * 40: {'rd': [{'1': {}}]},
        'b' * 40: {},
    })))

    r = await c.check_instant_availability(['A' * 40, 'B' * 40])
    assert r['a' * 40] is True
    assert r['b' * 40] is False


@pytest.mark.asyncio
async def test_chaves_saem_em_minusculas(monkeypatch):
    """O acervo guarda info_hash em minúsculas; devolver maiúsculas obrigaria
    cada chamador a lembrar de converter, e um que esquecesse leria tudo como
    não cacheado."""
    c = RealDebridClient('k')
    monkeypatch.setattr(c.client, 'get', _responde(
        _Resposta(payload={('C' * 40): {'rd': [{}]}})))

    r = await c.check_instant_availability(['c' * 40])
    assert set(r) == {'c' * 40}


@pytest.mark.asyncio
async def test_mais_de_cem_hashes_sao_todos_checados(monkeypatch):
    """
    O código antigo fatiava em `hashes[:100]` e seguia: do 101 em diante o
    hash nem voltava no dicionário, e o chamador lia ausência como "não
    cacheado". Um acervo com 300 releases tinha 200 delas invisíveis.
    """
    hashes = [f'{i:040x}' for i in range(250)]
    capturado = {}
    c = RealDebridClient('k')
    monkeypatch.setattr(c.client, 'get',
                        _responde(_Resposta(payload={}), capturado=capturado))

    r = await c.check_instant_availability(hashes)

    assert len(r) == 250, 'hash que não voltou some da resposta'
    assert len(capturado['urls']) == 3, '250 hashes = 3 chamadas de 100'


@pytest.mark.asyncio
async def test_hash_ausente_do_retorno_conta_como_nao_cacheado(monkeypatch):
    c = RealDebridClient('k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload={})))

    r = await c.check_instant_availability(['d' * 40])
    assert r['d' * 40] is False


@pytest.mark.asyncio
async def test_falha_de_rede_nao_vira_nada_cacheado(monkeypatch):
    """
    Devolver tudo False numa falha apagaria a disponibilidade do acervo
    inteiro: a tela diria que nenhum filme está pronto quando o problema é a
    integração.
    """
    c = RealDebridClient('k')

    async def estoura(*a, **kw):
        raise httpx.ConnectError('sem rota')

    monkeypatch.setattr(c.client, 'get', estoura)
    with pytest.raises(RealDebridIndisponivel):
        await c.check_instant_availability(['e' * 40])


@pytest.mark.asyncio
async def test_lista_vazia_nao_chama_a_api(monkeypatch):
    c = RealDebridClient('k')

    async def nao_deveria(*a, **kw):
        raise AssertionError('não deveria chamar a API sem hash nenhum')

    monkeypatch.setattr(c.client, 'get', nao_deveria)
    assert await c.check_instant_availability([]) == {}
    assert await c.check_instant_availability(['', '  ']) == {}
