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
async def test_o_imdb_fica_fora_da_consulta(monkeypatch):
    """
    O oposto do que este teste afirmava antes.

    A sintaxe `{ImdbId:tt...}` só é entendida pelos indexadores que fazem
    busca por IMDb; os demais procuram as chaves literalmente e não casam com
    nada. Medido contra o Prowlarr real desta instalação, para "The Departed
    2006": com o token embutido responderam 2 indexadores e sobraram 15
    cópias; só com título e ano, responderam 9 e sobraram 178.

    Passar `imdbId` como parâmetro próprio também não serve: os indexadores
    que não o entendem devolvem o catálogo recente inteiro, e a relevância
    medida foi de 0% — 441 resultados, nenhum do filme pedido.
    """
    capturado = {}
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    monkeypatch.setattr(c.client, 'get', _responde(_Resposta(payload=[]), capturado))

    await c.search_movie('Stalker', 1979, imdb_id='tt0079944')

    consulta = capturado['params']['query']
    assert 'ImdbId' not in consulta
    assert 'tt0079944' not in consulta
    assert 'imdbId' not in capturado['params']
    assert consulta == 'Stalker 1979'


# ── o IMDb como filtro de conflito ────────────────────────────────────────

def test_release_de_outro_filme_e_descartada():
    """
    Descarte só por contradição declarada: a release diz ser outro IMDb.
    """
    achados = ProwlarrClient('http://p', 'k')._parse_results(
        [item(imdbId=253474), item(infoHash='B' * 40, imdbId=79944)],
        imdb_id='tt0079944')

    assert len(achados) == 1
    assert achados[0]['info_hash'] == 'b' * 40


def test_release_que_nao_declara_imdb_passa():
    """
    78% dos resultados medidos não declaram IMDb. Exigir declaração jogaria
    fora quase tudo que a busca encontra.
    """
    achados = ProwlarrClient('http://p', 'k')._parse_results(
        [item(), item(infoHash='B' * 40, imdbId=None)], imdb_id='tt0079944')

    assert len(achados) == 2


@pytest.mark.parametrize('sentinela', [0, '0', '', None])
def test_o_zero_do_prowlarr_nao_e_um_imdb_declarado(sentinela):
    """
    O Prowlarr manda `imdbId: 0` para "não sei", e o devolve em quase todo
    resultado. Tratar esse zero como id declarado fez o filtro descartar 257
    de 328 releases na medição — inclusive o melhor REMUX 2160p.
    """
    achados = ProwlarrClient('http://p', 'k')._parse_results(
        [item(imdbId=sentinela)], imdb_id='tt0079944')

    assert len(achados) == 1, 'sentinela de ausência tratada como conflito'


def test_sem_imdb_pedido_nada_e_filtrado():
    achados = ProwlarrClient('http://p', 'k')._parse_results(
        [item(imdbId=253474), item(infoHash='B' * 40, imdbId=1)])

    assert len(achados) == 2


# ── o tempo de espera ─────────────────────────────────────────────────────

def test_a_espera_cobre_uma_busca_real():
    """
    30s era menos do que a busca leva. Medido nesta instalação, com 9
    indexadores ativos: 40s para "The Departed 2006" e 100s para "Stalker
    1979" — quase toda busca real virava ProwlarrIndisponivel. O tempo é do
    indexador mais lento: "Generic Torznab" sozinho responde em 40s, os outros
    oito somados levam menos de 2.
    """
    from apps.integrations.prowlarr import SEGUNDOS_DE_ESPERA

    assert SEGUNDOS_DE_ESPERA >= 120, 'busca real de 100s estouraria'

    c = ProwlarrClient('http://p', 'k')
    assert c.client.timeout.read >= 120
    # Conectar é outra coisa: Prowlarr fora do ar deve falhar rápido, não
    # depois de dois minutos e meio segurando a requisição do usuário.
    assert c.client.timeout.connect <= 15


def _responde(resposta, capturado=None):
    async def falso(url, params=None, **kw):
        if capturado is not None:
            capturado['url'] = url
            capturado['params'] = params
        return resposta
    return falso


# ── qual titulo procurar ──────────────────────────────────────────────────

def test_procura_pelo_titulo_original_e_pelo_localizado():
    """
    O acervo guarda o título localizado, e os indexadores catalogam pelo
    original. Medido contra o Prowlarr real: "Os Infiltrados 2006" devolve 7
    cópias aproveitáveis, "The Departed 2006" devolve 179 — e 38% dos 25.908
    filmes do acervo estão nessa situação.
    """
    from apps.integrations.prowlarr import consultas_para

    assert consultas_para(['The Departed', 'Os Infiltrados'], 2006) == [
        'The Departed 2006', 'Os Infiltrados 2006']


def test_o_original_vem_primeiro():
    """O original é o que os trackers usam; a ordem reflete a aposta."""
    from apps.integrations.prowlarr import consultas_para

    assert consultas_para(['The Departed', 'Os Infiltrados'], 2006)[0].startswith('The Departed')


def test_titulo_em_kanji_nao_dispensa_o_localizado():
    """
    "東京物語" é o original de "Era Uma Vez em Tóquio", e tracker nenhum
    cataloga em kanji. Escolher um só dos títulos perde o filme nos dois
    sentidos — por isso são duas buscas, e não uma escolha.
    """
    from apps.integrations.prowlarr import consultas_para

    assert len(consultas_para(['東京物語', 'Era Uma Vez em Tóquio', 'Tokyo Story'], 1953)) == 3


def test_titulo_igual_ao_original_nao_vira_busca_dobrada():
    from apps.integrations.prowlarr import consultas_para

    assert consultas_para(['Stalker', 'Stalker'], 1979) == ['Stalker 1979']
    # Diferença de caixa é o mesmo título: uma busca só, com a grafia do
    # original, que é a que os trackers usam.
    assert consultas_para(['STALKER', 'Stalker'], 1979) == ['STALKER 1979']


def test_sem_ano_nenhuma_consulta_carrega_a_palavra_None():
    from apps.integrations.prowlarr import consultas_para

    for consulta in consultas_para(['Sunrise', 'Aurora'], None):
        assert 'None' not in consulta


def test_sem_titulo_algum_nao_ha_o_que_buscar():
    from apps.integrations.prowlarr import consultas_para

    assert consultas_para(['', None], 1979) == []


@pytest.mark.asyncio
async def test_as_duas_buscas_sao_fundidas_pelo_hash(monkeypatch):
    """
    O mesmo torrent aparece nas duas buscas quando o release cita os dois
    nomes. Sem a fusão ele viraria duas linhas idênticas na tela.
    """
    c = ProwlarrClient('http://prowlarr:9696', 'k')
    chamadas = []

    async def falso(url, params=None, **kw):
        chamadas.append(params['query'])
        return _Resposta(payload=[item(), item(infoHash='B' * 40)])

    monkeypatch.setattr(c.client, 'get', falso)
    achados = await c.search_movie('Os Infiltrados', 2006, original_title='The Departed')

    assert len(chamadas) == 2
    assert len(achados) == 2, 'o mesmo hash veio das duas buscas e virou duas linhas'


@pytest.mark.asyncio
async def test_uma_busca_que_cai_nao_leva_a_outra_junto(monkeypatch):
    """
    Se o título original respondeu e o localizado caiu, devolver o que veio é
    melhor que transformar tudo em erro.
    """
    c = ProwlarrClient('http://prowlarr:9696', 'k')

    async def falso(url, params=None, **kw):
        if 'Infiltrados' in params['query']:
            raise httpx.ConnectError('caiu')
        return _Resposta(payload=[item()])

    monkeypatch.setattr(c.client, 'get', falso)
    achados = await c.search_movie('Os Infiltrados', 2006, original_title='The Departed')

    assert len(achados) == 1


@pytest.mark.asyncio
async def test_se_todas_cairem_o_erro_sobe(monkeypatch):
    """"Não achei nada" e "a integração caiu" continuam sendo coisas diferentes."""
    c = ProwlarrClient('http://prowlarr:9696', 'k')

    async def falso(url, params=None, **kw):
        raise httpx.ConnectError('caiu')

    monkeypatch.setattr(c.client, 'get', falso)
    with pytest.raises(ProwlarrIndisponivel):
        await c.search_movie('Os Infiltrados', 2006, original_title='The Departed')
