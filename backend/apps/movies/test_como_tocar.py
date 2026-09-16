"""
A decisão do botão de projeção.

O defeito que originou este módulo: a tela decidia com
`available_instantly || cached_in_realdebrid`, uma conta que não sabe o que o
navegador aguenta. O botão pulsava prometendo projeção sobre um REMUX com DTS,
e a projeção vinha muda.
"""

import uuid

import pytest

from apps.movies.como_tocar import (ESCOLHER, NADA_IMEDIATO, QUANTAS_OFERECER,
                                    TOCA_AGORA, como_tocar)
from apps.movies.models import Movie, TorrentRelease


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Filme de Teste', year=2000)


def copia(filme, *, nota, audio='', video='AVC', imediata=False, na_conta=False,
          remux=False, magnet='magnet:?xt=urn:btih:' + 'a' * 40, semeadores=10):
    """
    Uma cópia com só o que a decisão lê.

    `imediata` é o acervo do Real-Debrid ter o arquivo; `na_conta` é já haver
    link. As duas contam como "toca agora" e é isso que o teste precisa poder
    distinguir de "ausente".
    """
    return TorrentRelease.objects.create(
        movie=filme,
        info_hash=uuid.uuid4().hex + uuid.uuid4().hex[:8],
        title=f'Cópia nota {nota} {audio or "sem audio"}',
        size_bytes=10 * 1024 ** 3,
        quality_score=nota,
        audio_codec=audio,
        video_codec=video,
        is_remux=remux,
        magnet_link=magnet,
        seeders=semeadores,
        instantly_available=imediata,
        in_realdebrid=na_conta,
        realdebrid_status='downloaded' if na_conta else '',
        realdebrid_links=['https://rd/link'] if na_conta else [],
    )


# ── o caminho feliz ───────────────────────────────────────────────────────

def test_sem_copia_nenhuma_nao_ha_o_que_tocar(filme):
    r = como_tocar(filme)
    assert r['decisao'] == NADA_IMEDIATO
    assert r['escolhida'] is None
    assert r['imediatas'] == []


def test_escolhe_a_melhor_nota_entre_as_que_tocam_agora(filme):
    copia(filme, nota=90, audio='AAC', imediata=False)   # ótima, mas não imediata
    boa = copia(filme, nota=70, audio='AAC', imediata=True)
    copia(filme, nota=40, audio='AAC', imediata=True)

    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['escolhida']['release_id'] == str(boa.id)


def test_o_link_na_conta_conta_tanto_quanto_o_acervo(filme):
    """
    `pronta` e `instantanea` são estados diferentes e servem para a mesma
    coisa: apertar play e assistir em segundos.
    """
    na_conta = copia(filme, nota=50, audio='AAC', na_conta=True)
    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['escolhida']['release_id'] == str(na_conta.id)


# ── a regra que motivou tudo ──────────────────────────────────────────────

def test_compatibilidade_e_requisito_e_nao_desempate(filme):
    """
    O caso exato do defeito: a de maior nota é a que o navegador recusa.

    Como desempate, a de 90 ganharia e o botão prometeria uma projeção muda.
    Como requisito, o botão pega a de 70 — pior nota, e assistível.
    """
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    aceitavel = copia(filme, nota=70, audio='AAC', imediata=True)

    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['escolhida']['release_id'] == str(aceitavel.id)
    assert r['escolhida']['precisa_converter'] == 'nada'


def test_so_pergunta_quando_nada_imediato_toca_no_navegador(filme):
    """Há o que tocar agora, mas tudo precisa de conversão: a escolha é do usuário."""
    melhor = copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    copia(filme, nota=60, audio='Dolby TrueHD', imediata=True)

    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    # A sugestão ao lado da pergunta é a de melhor nota entre as imediatas.
    assert r['escolhida']['release_id'] == str(melhor.id)
    assert r['escolhida']['precisa_converter'] == 'audio'
    assert len(r['imediatas']) == 2


def test_a_copia_sem_audio_declarado_nao_basta_para_prometer_projecao(filme):
    """
    A escolha do rigor, e ela custa: `talvez` são 31 das 63 cópias do acervo,
    então quase todo filme passa a cair na pergunta.

    O que se ganha é o botão parar de mentir. Uma cópia que não declara o
    codec de áudio PODE vir muda — o Lumière não sabe, e tratá-la como
    compatível seria afirmar que sabe.
    """
    sem_declarar = copia(filme, nota=80, audio='', imediata=True)
    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    assert r['escolhida']['release_id'] == str(sem_declarar.id)
    assert r['escolhida']['compatibilidade'] == 'talvez'
    # E ela continua sendo oferecida para tocar agora — só não em silêncio.
    assert [c['release_id'] for c in r['imediatas']] == [str(sem_declarar.id)]


def test_so_o_selo_toca_dispensa_a_pergunta(filme):
    declarada = copia(filme, nota=50, audio='AAC', imediata=True)
    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['escolhida']['release_id'] == str(declarada.id)
    assert r['escolhida']['compatibilidade'] == 'toca'


def test_nao_oferece_esperar_download_de_uma_copia_que_talvez_toque(filme):
    """
    Vender minutos de espera por uma promessa que não se pode fazer é pior que
    não oferecer nada.
    """
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    copia(filme, nota=85, audio='', imediata=False)   # talvez, precisa baixar

    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    assert r['melhor_para_navegador'] is None


def test_remux_sem_audio_declarado_continua_precisando_de_conversao(filme):
    """Decisão do usuário: REMUX sem áudio declarado é `nao_toca`."""
    copia(filme, nota=95, audio='', remux=True, imediata=True)
    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    assert r['escolhida']['precisa_converter'] == 'audio'


def test_sem_nada_imediato_nao_pergunta_o_que_nao_da_para_oferecer(filme):
    copia(filme, nota=90, audio='AAC', imediata=False)
    r = como_tocar(filme)
    assert r['decisao'] == NADA_IMEDIATO
    assert r['imediatas'] == []


# ── a cópia que o download iria buscar ────────────────────────────────────

def test_oferece_a_melhor_para_navegador_que_ainda_precisa_baixar(filme):
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)   # imediata, não toca
    alvo = copia(filme, nota=85, audio='AAC', imediata=False)  # toca, precisa baixar
    copia(filme, nota=50, audio='AAC', imediata=False)

    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    assert r['melhor_para_navegador']['release_id'] == str(alvo.id)


def test_nao_oferece_download_de_copia_sem_magnet(filme):
    """
    As cópias vindas da sincronização com o Real-Debrid nascem sem magnet.
    Oferecer o download delas é um botão que só sabe dar erro.
    """
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    copia(filme, nota=85, audio='AAC', imediata=False, magnet='')

    r = como_tocar(filme)
    assert r['decisao'] == ESCOLHER
    assert r['melhor_para_navegador'] is None


def test_nao_oferece_para_download_o_que_ja_esta_disponivel(filme):
    """Baixar o que já toca agora é oferecer espera em troca de nada."""
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    copia(filme, nota=85, audio='AAC', imediata=True)

    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['melhor_para_navegador'] is None


# ── a lista da pergunta ───────────────────────────────────────────────────

def test_a_lista_oferecida_tem_teto(filme):
    """Trinta e duas opções não são uma pergunta, são um formulário."""
    for i in range(QUANTAS_OFERECER + 4):
        copia(filme, nota=90 - i, audio='DTS', imediata=True)

    r = como_tocar(filme)
    assert len(r['imediatas']) == QUANTAS_OFERECER
    # E são as de melhor nota, em ordem.
    notas = [c['quality_score'] for c in r['imediatas']]
    assert notas == sorted(notas, reverse=True)


def test_a_resposta_tem_sempre_as_mesmas_chaves(filme):
    """Quem lê não deveria precisar descobrir quais chaves existem neste caso."""
    vazio = como_tocar(filme)
    copia(filme, nota=50, audio='AAC', imediata=True)
    cheio = como_tocar(filme)
    assert set(vazio) == set(cheio) == {
        'decisao', 'escolhida', 'melhor_para_navegador', 'para_torrent',
        'por_que_nao_torrent', 'por_que_nao_baixar', 'imediatas'}


# ── por que não dá para tocar direto ──────────────────────────────────────
# A tela dizia sempre "NENHUMA CÓPIA COM MAGNET PARA ENVIAR AO MOTOR" — uma das
# três razões, e quase nunca a verdadeira. Mandar procurar magnet quando magnet
# existe aos montes é mandar fazer o que não resolve.

def test_com_candidata_nao_ha_razao_nenhuma(filme):
    copia(filme, nota=50, audio='AAC', imediata=False)
    r = como_tocar(filme)
    assert r['para_torrent']
    assert r['por_que_nao_torrent'] == ''


def test_sem_cópia_nenhuma_a_razão_é_o_acervo_vazio(filme):
    assert 'CÓPIA NENHUMA' in como_tocar(filme)['por_que_nao_torrent']


def test_cópias_sem_magnet_dizem_que_faltam_magnets(filme):
    """As vindas da sincronização com o Real-Debrid nascem sem."""
    copia(filme, nota=50, audio='AAC', imediata=True, magnet='')
    r = como_tocar(filme)
    assert 'MAGNET' in r['por_que_nao_torrent']
    assert 'SEM SOM' not in r['por_que_nao_torrent']


def test_nenhuma_tocável_diz_que_viria_sem_som(filme):
    """
    O caso comum, e o que a mensagem antiga escondia: há magnet de sobra, e o
    que falta é uma cópia que o navegador toque. Tocar do torrent serve o
    arquivo COMO ESTÁ — não há conversor neste caminho.
    """
    copia(filme, nota=90, audio='DTS-HD MA', imediata=False)
    copia(filme, nota=80, audio='Dolby TrueHD', imediata=False)
    r = como_tocar(filme)
    assert 'SEM SOM' in r['por_que_nao_torrent']
    assert 'MAGNET' not in r['por_que_nao_torrent']


def test_tocável_sem_semeador_diz_que_falta_quem_compartilhe(filme):
    copia(filme, nota=50, audio='AAC', imediata=False, semeadores=0)
    r = como_tocar(filme)
    assert 'SEMEADOR' in r['por_que_nao_torrent']
    assert not r['para_torrent']


# ── por que não há o que baixar ───────────────────────────────────────────
# A tela enumerava DUAS causas — "ou já estão todas disponíveis, ou as que
# faltam vieram sem magnet" — e a comum é uma TERCEIRA: há vinte cópias
# ausentes com magnet, e nenhuma declara áudio que o navegador toque. As duas
# frases ficavam falsas ao mesmo tempo, com a tabela logo abaixo oferecendo
# [ IMPORTAR ] em cada uma delas.

def test_com_candidata_nao_ha_razao(filme):
    copia(filme, nota=50, audio='AAC', imediata=False)
    assert como_tocar(filme)['por_que_nao_baixar'] == ''


def test_a_terceira_causa_e_dita(filme):
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)   # imediata, não toca
    copia(filme, nota=85, audio='', imediata=False)            # talvez, importável
    copia(filme, nota=80, audio='DTS', imediata=False)         # não toca, importável
    r = como_tocar(filme)
    assert 'CONVERSÃO' in r['por_que_nao_baixar']
    assert '2 CÓPIA' in r['por_que_nao_baixar'], 'não disse quantas'
    assert 'SEM MAGNET' not in r['por_que_nao_baixar']


def test_tudo_ja_na_conta_diz_isso(filme):
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    assert 'JÁ ESTÃO NA SUA CONTA' in como_tocar(filme)['por_que_nao_baixar']


def test_faltando_magnet_continua_sendo_dito(filme):
    """A razão original existe, e precisa continuar dizível."""
    copia(filme, nota=90, audio='DTS-HD MA', imediata=True)
    copia(filme, nota=85, audio='', imediata=False, magnet='')
    assert 'SEM MAGNET' in como_tocar(filme)['por_que_nao_baixar']
