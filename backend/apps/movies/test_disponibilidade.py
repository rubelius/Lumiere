"""
Testes do estado de disponibilidade de uma cópia.

Três flags do modelo respondem perguntas diferentes — se a cópia está na conta
do Real-Debrid, em que pé o download está, e se o hash já mora no acervo do RD
— e cada tela vinha combinando as suas por conta própria. O erro que motivou
esta propriedade: a aba de cópias anunciava "toca agora" para tudo que tinha
`instantly_available`, quando isso só quer dizer que a importação seria rápida.
"""

from apps.movies.models import TorrentRelease


def copia(**campos) -> TorrentRelease:
    """Instância solta, sem banco: `disponibilidade` só lê campos locais."""
    # size_bytes é NOT NULL no banco; sem ele o serializer estoura em size_gb.
    campos.setdefault('size_bytes', 8 * 1024 ** 3)
    return TorrentRelease(**campos)


def test_na_conta_e_completa_toca_agora():
    r = copia(in_realdebrid=True, realdebrid_status='downloaded')
    assert r.disponibilidade == TorrentRelease.PRONTA


def test_cacheada_no_rd_mas_nao_importada_nao_e_pronta():
    """
    O defeito de origem. `instantly_available` significa "o RD já tem esse
    arquivo", não "existe link para tocar": sem importar para a conta, não há
    o que reproduzir.
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


def test_erro_no_rd_cai_para_instantanea_se_o_acervo_ainda_tem():
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
    r = copia(instantly_available=True, magnet_link='')
    assert r.disponibilidade == TorrentRelease.INSTANTANEA
    assert r.pode_importar is False


def test_com_magnet_e_no_estado_certo_pode_importar():
    for estado in (TorrentRelease.INSTANTANEA, TorrentRelease.AUSENTE):
        r = copia(magnet_link='magnet:?xt=urn:btih:' + 'b' * 40,
                  instantly_available=(estado == TorrentRelease.INSTANTANEA))
        assert r.disponibilidade == estado
        assert r.pode_importar is True, estado


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
