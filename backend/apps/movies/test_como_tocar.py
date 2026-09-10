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
          remux=False, magnet='magnet:?xt=urn:btih:' + 'a' * 40):
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


def test_a_copia_sem_audio_declarado_nao_manda_ninguem_para_a_pergunta(filme):
    """
    São 31 das 63 cópias do acervo. Tratá-las como incompatíveis mandaria
    metade da biblioteca para o conversor — e para a pergunta — sem motivo.
    """
    sem_declarar = copia(filme, nota=80, audio='', imediata=True)
    r = como_tocar(filme)
    assert r['decisao'] == TOCA_AGORA
    assert r['escolhida']['release_id'] == str(sem_declarar.id)
    assert r['escolhida']['compatibilidade'] == 'talvez'


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
        'decisao', 'escolhida', 'melhor_para_navegador', 'imediatas'}
