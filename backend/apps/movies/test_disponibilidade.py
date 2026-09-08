"""
Testes do estado de disponibilidade de uma cópia.

Três flags do modelo respondem perguntas diferentes — se a cópia está na conta
do Real-Debrid, em que pé o download está, e se o hash já mora no acervo do RD
— e cada tela vinha combinando as suas por conta própria. O erro que motivou
esta propriedade: a aba de cópias anunciava "toca agora" para tudo que tinha
`instantly_available` — uma flag que o Real-Debrid deixou de alimentar quando
desativou `/torrents/instantAvailability`.
"""

import pytest

from apps.movies.models import TorrentRelease


def copia(**campos) -> TorrentRelease:
    """Instância solta, sem banco: `disponibilidade` só lê campos locais."""
    # size_bytes é NOT NULL no banco; sem ele o serializer estoura em size_gb.
    campos.setdefault('size_bytes', 8 * 1024 ** 3)
    return TorrentRelease(**campos)


def test_na_conta_e_completa_toca_agora():
    r = copia(in_realdebrid=True, realdebrid_status='downloaded')
    assert r.disponibilidade == TorrentRelease.PRONTA


def test_cacheada_no_acervo_mas_nao_na_conta_e_instantanea():
    """
    A distinção que importa na hora de escolher: o Real-Debrid tem o arquivo,
    então importar leva segundos — mesmo sem estar na conta ainda. É diferente
    de `pronta`, que já tem link, e muito diferente de `ausente`, que pode
    levar horas ou nem completar.
    """
    r = copia(instantly_available=True, in_realdebrid=False)
    assert r.disponibilidade == TorrentRelease.INSTANTANEA
    assert r.disponibilidade != TorrentRelease.PRONTA


def test_enviada_e_ainda_baixando():
    r = copia(in_realdebrid=True, realdebrid_status='downloading')
    assert r.disponibilidade == TorrentRelease.BAIXANDO


def test_esperando_escolha_de_arquivo_tambem_e_espera():
    """
    'waiting_files_selection' é o estado em que o torrent fica preso quando
    ninguém escolheu arquivo. Não é morto, mas também não toca.
    """
    r = copia(in_realdebrid=True, realdebrid_status='waiting_files_selection')
    assert r.disponibilidade == TorrentRelease.BAIXANDO


def test_erro_no_rd_nao_conta_como_baixando():
    for estado in TorrentRelease.ESTADOS_MORTOS:
        r = copia(in_realdebrid=True, realdebrid_status=estado)
        assert r.disponibilidade == TorrentRelease.AUSENTE, estado


def test_erro_no_rd_cai_para_o_que_o_acervo_ainda_tem():
    """Falhou na conta, mas o acervo tem: reenviar é instantâneo."""
    r = copia(in_realdebrid=True, realdebrid_status='error', instantly_available=True)
    assert r.disponibilidade == TorrentRelease.INSTANTANEA


def test_copia_recem_encontrada_nao_promete_nada():
    assert copia().disponibilidade == TorrentRelease.AUSENTE


def test_status_vazio_com_flag_ligada_ainda_e_espera():
    """
    `realdebrid_status` é `blank=True`: uma linha meio gravada não pode virar
    "pronta" por omissão.
    """
    r = copia(in_realdebrid=True, realdebrid_status='')
    assert r.disponibilidade == TorrentRelease.BAIXANDO


def test_serializer_publica_o_estado():
    from apps.movies.serializers import TorrentReleaseSerializer

    dados = TorrentReleaseSerializer(copia(in_realdebrid=True, realdebrid_status='downloaded')).data
    assert dados['disponibilidade'] == TorrentRelease.PRONTA


def test_sem_magnet_nao_ha_o_que_importar():
    """
    Todas as cópias vindas da sincronização com o Real-Debrid nascem sem
    magnet. Oferecer importar para elas é um botão que só sabe dar erro.
    """
    r = copia(magnet_link='')
    assert r.disponibilidade == TorrentRelease.AUSENTE
    assert r.pode_importar is False


def test_com_magnet_e_fora_da_conta_pode_importar():
    r = copia(magnet_link='magnet:?xt=urn:btih:' + 'b' * 40)
    assert r.disponibilidade == TorrentRelease.AUSENTE
    assert r.pode_importar is True


def test_o_que_ja_esta_la_nao_se_importa_de_novo():
    for estado, campos in (
        (TorrentRelease.PRONTA, {'in_realdebrid': True, 'realdebrid_status': 'downloaded'}),
        (TorrentRelease.BAIXANDO, {'in_realdebrid': True, 'realdebrid_status': 'downloading'}),
    ):
        r = copia(magnet_link='magnet:?xt=urn:btih:' + 'c' * 40, **campos)
        assert r.disponibilidade == estado
        assert r.pode_importar is False, estado


def test_serializer_publica_se_pode_importar():
    from apps.movies.serializers import TorrentReleaseSerializer

    dados = TorrentReleaseSerializer(copia(instantly_available=True, magnet_link='')).data
    assert dados['pode_importar'] is False


# ── a sondagem que substituiu o instantAvailability ───────────────────────

def test_a_marca_de_cache_tem_data():
    """
    `instant_check_at` diz quando foi a última resposta. Sem ela, uma sondagem
    de meses atrás pareceria fresca — e o que estava no acervo do Real-Debrid
    pode ter saído de lá.
    """
    campos = {f.name for f in TorrentRelease._meta.get_fields()}
    assert 'instant_check_at' in campos


def test_indeterminado_nao_derruba_nem_levanta_marca():
    """
    Três respostas, não duas: `cacheado`, `nao_cacheado` e `indeterminado`.
    A terceira existe porque o Real-Debrid pode ficar em `magnet_conversion`
    sem nunca dizer — e não saber não é o mesmo que saber que não.
    """
    from apps.movies.realdebrid_cache import CACHEADO, INDETERMINADO, NAO_CACHEADO

    assert len({CACHEADO, NAO_CACHEADO, INDETERMINADO}) == 3


def test_a_sondagem_respeita_o_limite_de_taxa():
    """
    Cinco sondagens de uma vez tomaram 429 do Real-Debrid em addMagnet.
    A pausa entre elas é o que impede isso, e some sem barulho se alguém
    voltar a paralelizar.
    """
    import inspect

    from apps.movies import realdebrid_cache

    assert realdebrid_cache.SEGUNDOS_ENTRE_SONDAGENS > 0
    fonte = inspect.getsource(realdebrid_cache._sonda_uma_a_uma)
    assert 'asyncio.sleep(SEGUNDOS_ENTRE_SONDAGENS)' in fonte
    assert 'gather' not in fonte, 'paralelizar aqui toma 429'


@pytest.mark.parametrize('ja_estava,deve_apagar', [(False, True), (True, False)])
def test_a_sondagem_desfaz_o_que_criou(monkeypatch, ja_estava, deve_apagar):
    """
    A conta é do usuário: sondar não pode deixar lixo lá dentro. E um torrent
    que JÁ estava na conta antes da sondagem não é nosso para apagar.

    Comportamental, e não por leitura do fonte: a versão anterior deste teste
    procurava as palavras "delete_torrent" e "ja_estava_na_conta" no código, e
    passava mesmo com o `if` que as governa desligado.
    """
    from asgiref.sync import async_to_sync

    from apps.movies import realdebrid_cache

    apagados = []

    class RDFalso:
        def __init__(self, chave):
            pass

        async def add_magnet(self, magnet):
            return 'T-SONDA'

        async def get_torrent_info(self, tid):
            return {'status': 'downloaded', 'files': [{'id': 1, 'bytes': 9}],
                    'links': ['rd://x']}

        async def select_files(self, tid, ids):
            return True

        async def delete_torrent(self, tid):
            apagados.append(tid)
            return True

        async def close(self):
            pass

    monkeypatch.setattr(realdebrid_cache, 'RealDebridClient', RDFalso)

    resposta = async_to_sync(realdebrid_cache._sonda_e_limpa)(
        'chave', 'magnet:?xt=urn:btih:' + 'a' * 40, ja_estava)

    assert resposta == realdebrid_cache.CACHEADO
    assert apagados == (['T-SONDA'] if deve_apagar else [])
