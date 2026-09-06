"""
Testes do cliente Prowlarr.

Não havia nenhum — apps/integrations/tests.py estava vazio —, e é por isso
que a busca de releases nunca funcionou sem ninguém notar: ela estourava
FieldError na primeira release encontrada.

O contrato que estes testes travam é o que o parser DEVOLVE, porque é isso que
vai direto para os `defaults` de update_or_create. Uma chave a mais derruba a
gravação inteira.
"""

import httpx
import pytest

from apps.integrations.prowlarr import ProwlarrClient, ProwlarrIndisponivel
from apps.movies.models import TorrentRelease


def item(**extra):
    """Um resultado do Prowlarr, na forma que a API devolve."""
    base = {
        'title': 'Stalker 1979 2160p UHD BluRay REMUX HEVC DTS-HD MA 5.1',
        'infoHash': 'A' * 40,
        'magnetUrl': 'magnet:?xt=urn:btih:aaa',
        'size': 75_000_000_000,
        'seeders': 42,
        'leechers': 3,
        'indexerId': 7,
        'indexer': 'Tracker X',
        'publishDate': '2024-01-01T00:00:00Z',
        'downloadUrl': 'https://tracker/x.torrent',
    }
    base.update(extra)
    return base


def parseia(*itens):
    return ProwlarrClient('http://prowlarr:9696', 'k')._parse_results(list(itens))


# ── o contrato com o modelo ───────────────────────────────────────────────

def test_so_devolve_campos_que_o_modelo_tem():
    """
    O dict do parser vira `defaults` de update_or_create. `download_url` era
    extraído e ia junto: FieldError na primeira release, busca inteira em 500.
    Este é o teste que faltava.
    """
    colunas = {f.name for f in TorrentRelease._meta.get_fields()}
    for chave in parseia(item())[0]:
        assert chave in colunas, f'{chave} não é campo de TorrentRelease'


def test_traz_o_que_a_tela_precisa_para_escolher():
    r = parseia(item())[0]
    assert r['title'].startswith('Stalker')
    assert r['info_hash'] == 'a' * 40          # normalizado para minúsculas
    assert r['size_bytes'] == 75_000_000_000
    assert r['seeders'] == 42
    assert r['indexer_name'] == 'Tracker X'


# ── os valores que derrubavam a busca ─────────────────────────────────────

@pytest.mark.parametrize('valor', [None, '', 'lixo'])
def test_seeders_nulo_nao_derruba_o_calculo_de_score(valor):
    """
    `.get('seeders', 0)` só protege contra chave AUSENTE. O Prowlarr manda
    `"seeders": null` para indexador que não reporta swarm, e o None chegava
    ao score, onde `None >= 100` derrubava a busca inteira — nenhuma das
    outras releases era salva.
    """
    from apps.movies.utils import calculate_quality_score

    r = parseia(item(seeders=valor))[0]
    assert r['seeders'] == 0
    calculate_quality_score(r)   # não pode levantar


@pytest.mark.parametrize('valor', [None, '', '   '])
def test_release_sem_info_hash_e_descartada(valor):
    """
    info_hash é a chave de deduplicação e é unique. String vazia é um valor
    LEGÍTIMO para coluna unique: a primeira release sem hash criava a linha, e
    todas as seguintes caíam em cima dela num UPDATE — inclusive as de outros
    filmes, porque `movie` vai nos defaults. Três releases viravam uma.
    """
    assert parseia(item(infoHash=valor)) == []


def test_uma_release_ruim_nao_leva_as_boas_junto():
    boas = parseia(item(), item(infoHash=None), item(infoHash='B' * 40))
    assert len(boas) == 2


def test_tamanho_invalido_vira_zero():
    assert parseia(item(size=None))[0]['size_bytes'] == 0


# ── falha da integração ───────────────────────────────────────────────────

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


@pytest.mark.asyncio
async def test_chave_invalida_nao_vira_lista_vazia(monkeypatch):
    """
    Devolver [] para qualquer erro fazia a tela dizer "nenhum release
    encontrado" quando a integração estava quebrada. O usuário não tinha como
    distinguir um filme sem cópia de uma chave de API errada.
    """
    c = ProwlarrClient('http://prowlarr:9696', 'errada')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(status=401)))

    with pytest.raises(ProwlarrIndisponivel):
        await c.search_movie('Stalker', 1979)


@pytest.mark.asyncio
async def test_servidor_fora_do_ar_avisa(monkeypatch):
    c = ProwlarrClient('http://prowlarr:9696', 'k')

    async def estoura(*a, **kw):
        raise httpx.ConnectError('sem rota')

    monkeypatch.setattr(c.client, 'get', estoura)
    with pytest.raises(ProwlarrIndisponivel):
        await c.search_movie('Stalker', 1979)


@pytest.mark.asyncio
async def test_resposta_que_nao_e_json_avisa(monkeypatch):
    """200 com HTML de proxy vazava como 500 sem explicação."""
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(texto='<html>')))

    with pytest.raises(ProwlarrIndisponivel):
        await c.search_movie('Stalker', 1979)


@pytest.mark.asyncio
async def test_busca_bem_sucedida_devolve_releases(monkeypatch):
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload=[item()])))

    achados = await c.search_movie('Stalker', 1979)
    assert len(achados) == 1
    assert achados[0]['info_hash'] == 'a' * 40


# ── a consulta ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_filme_sem_ano_nao_procura_pela_palavra_None(monkeypatch):
    """
    `year` é anulável no acervo, e interpolá-lo punha "None" na busca: o
    indexador procurava pelo literal e devolvia zero, e a tela dizia "sem
    releases" em vez de "faltou o ano".
    """
    capturado = {}
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload=[]), capturado))

    await c.search_movie('Stalker', None)
    assert 'None' not in capturado['params']['query']


@pytest.mark.asyncio
async def test_imdb_entra_na_consulta_e_nao_como_parametro(monkeypatch):
    """
    `imdbId` não é parâmetro do /api/v1/search: chave desconhecida é ignorada
    em silêncio, então passá-la não desambiguava remake nenhum. O Prowlarr
    espera o IMDb dentro da própria consulta.
    """
    capturado = {}
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload=[]), capturado))

    await c.search_movie('Stalker', 1979, imdb_id='tt0079944')
    assert 'imdbId' not in capturado['params']
    assert 'tt0079944' in capturado['params']['query']


def _responde(resposta, capturado=None):
    async def falso(url, params=None, **kw):
        if capturado is not None:
            capturado['url'] = url
            capturado['params'] = params
        return resposta
    return falso
