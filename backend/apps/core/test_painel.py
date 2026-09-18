"""
O painel de administração, e a regra que o mantém honesto.

Uma tela de observabilidade é o lugar mais fácil do mundo para repetir o defeito
que este projeto mais comete — mostrar um número que parece uma coisa e é outra.
Um "saudável" verde derivado de "o processo está de pé" já custou caro aqui.

Por isso o que estes testes guardam não é o VALOR de cada painel: é que todo
painel diga de onde o número vem, quando foi medido, e — quando for o caso — o
que ele não diz.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.painel import PAINEIS, monta_painel


@pytest.fixture
def admin(db, django_user_model):
    return django_user_model.objects.create_user(
        username='chefe', password='x', is_staff=True, is_superuser=True)


@pytest.fixture
def comum(db, django_user_model):
    return django_user_model.objects.create_user(username='gente', password='x')


def cliente_de(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


# ── quem pode ver ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_usuario_comum_nao_ve_o_painel(comum):
    """
    Mostra tamanho de banco, contas, estado de cada integração e a validade da
    assinatura do Real-Debrid. Nada disso é do usuário comum.
    """
    assert cliente_de(comum).get(reverse('painel-admin')).status_code == 403


@pytest.mark.django_db
def test_sem_autenticacao_nao_ve(db):
    assert APIClient().get(reverse('painel-admin')).status_code == 401


@pytest.mark.django_db
def test_equipe_ve(admin):
    assert cliente_de(admin).get(reverse('painel-admin')).status_code == 200


@pytest.mark.django_db
def test_ninguem_se_promove_pelo_proprio_perfil(comum):
    """
    `is_staff` passou a ser exposto para a tela saber o que oferecer. Sem
    `read_only_fields`, o mesmo campo viraria um caminho de escalada: um PATCH
    no próprio perfil e a conta vira equipe.
    """
    # O caminho REAL: o UserViewSet é um ModelViewSet e o queryset de quem não
    # é equipe é o próprio usuário — ou seja, PATCH no próprio id passa pela
    # permissão. O que impede a escalada é só o `read_only_fields`.
    api = cliente_de(comum)
    resposta = api.patch(reverse('user-detail', args=[comum.id]),
                         {'is_staff': True, 'is_superuser': True}, format='json')

    assert resposta.status_code in (200, 202), (
        f'o PATCH nem chegou a rodar ({resposta.status_code}) — o teste não '
        'estaria guardando nada')
    comum.refresh_from_db()
    assert comum.is_staff is False, 'a conta se promoveu a equipe'
    assert comum.is_superuser is False, 'a conta se promoveu a superusuário' 


# ── a honestidade de cada painel ──────────────────────────────────────────

@pytest.mark.django_db
def test_todo_painel_diz_de_onde_veio_e_quando(admin):
    """A guarda central deste arquivo."""
    for p in monta_painel()['paineis']:
        assert p['origem'].strip(), f'{p["chave"]} não diz de onde o número vem'
        assert p['medido_em'], f'{p["chave"]} não diz quando foi medido'
        assert p['titulo'].strip()


@pytest.mark.django_db
def test_todo_valor_tem_rotulo(admin):
    for p in monta_painel()['paineis']:
        for v in p['valores']:
            assert v['rotulo'].strip(), f'valor sem rótulo em {p["chave"]}'
            assert 'valor' in v


@pytest.mark.django_db
def test_um_painel_quebrado_nao_derruba_a_tela(admin, monkeypatch):
    """
    O painel existe para mostrar o que está quebrado. Quebrar junto com o que
    ele deveria denunciar é a pior falha possível aqui.
    """
    import apps.core.painel as painel

    def explode():
        raise RuntimeError('consulta com defeito')

    monkeypatch.setattr(painel, 'PAINEIS', [painel.acervo, explode, painel.banco])
    resultado = painel.monta_painel()
    assert len(resultado['paineis']) == 2
    assert resultado['falharam'], 'a falha sumiu em silêncio'
    assert 'explode' in resultado['falharam'][0]


@pytest.mark.django_db
def test_integracao_fora_do_ar_vira_linha_e_nao_excecao(admin):
    """
    Um serviço caído é o que esta tela existe para mostrar. Derrubar o painel
    por causa dele seria o oposto do trabalho.
    """
    from apps.core.painel import integracoes

    # Com credencial: sem ela o painel diria "não configurado", que é outro
    # estado — e foi assim que este teste falhou da primeira vez.
    admin.prowlarr_url = 'http://localhost:9696'
    admin.prowlarr_api_key = 'chave'
    admin.save()

    with patch('apps.integrations.prowlarr.ProwlarrClient.get_indexers',
               side_effect=OSError('sem rota')):
        p = integracoes()

    prowlarr = next(v for v in p['valores'] if v['rotulo'] == 'Prowlarr')
    assert prowlarr['valor'] == 'sem resposta'


@pytest.mark.django_db
def test_prowlarr_mudo_nao_e_prowlarr_com_zero_indexadores(admin):
    """
    O defeito que este teste guarda: `get_indexers` devolvia `[]` no erro, e o
    painel mostrava "0 indexadores" — que se lê como "está no ar e vazio". Zero
    e silêncio não são a mesma coisa.
    """
    from apps.core.painel import integracoes

    # Sem credencial não há pergunta a fazer — e este é um terceiro estado, que
    # o próprio teste descobriu ao falhar: "não configurado" aparecia com a
    # mesma frase de "não respondeu".
    admin.prowlarr_url = 'http://localhost:9696'
    admin.prowlarr_api_key = 'chave'
    admin.save()

    def prowlarr(resposta):
        with patch('apps.integrations.prowlarr.ProwlarrClient.get_indexers', resposta):
            return next(v for v in integracoes()['valores'] if v['rotulo'] == 'Prowlarr')

    async def vazio(self):
        return []

    mudo = prowlarr(lambda self: (_ for _ in ()).throw(OSError('recusou a conexão')))
    zerado = prowlarr(vazio)

    assert mudo['valor'] != zerado['valor'], (
        'um Prowlarr mudo e um Prowlarr vazio aparecem iguais na tela')
    assert zerado['valor'] == '0 indexadores'
    assert mudo['valor'] == 'sem resposta'


@pytest.mark.django_db
def test_nao_configurado_nao_e_sem_resposta(admin):
    """
    O terceiro estado. Cada um pede uma ação diferente: preencher a credencial,
    olhar o serviço, ou nada. Este teste nasceu de o anterior ter falhado por
    um motivo que eu não tinha previsto.
    """
    from apps.core.painel import integracoes

    admin.prowlarr_url = ''
    admin.prowlarr_api_key = ''
    admin.save()

    sem_credencial = next(v for v in integracoes()['valores']
                          if v['rotulo'] == 'Prowlarr')
    assert sem_credencial['valor'] == 'não configurado'
    assert 'credencial' in sem_credencial['detalhe']


@pytest.mark.django_db
def test_o_painel_de_tarefas_ressalva_o_que_nao_sabe(admin):
    """
    O banco tem falhas de tarefa registradas e NENHUMA diz qual tarefa foi
    (`result_extended` desligado), e o backend de resultado em uso é o Redis —
    novas falhas nem chegam lá. Mostrar "N falhas" sem dizer isso é mentir com
    número verdadeiro.
    """
    from apps.core.painel import tarefas

    p = tarefas()
    tem_contagem = any('alha' in v['rotulo'] for v in p['valores'])
    if tem_contagem:
        assert p['ressalva'].strip(), 'contou falhas sem dizer o que a conta omite'


def test_todo_construtor_de_painel_tem_nome_legivel():
    for c in PAINEIS:
        assert c.__name__ and not c.__name__.startswith('_'), (
            f'{c.__name__} aparece em mensagem de falha e precisa ser legível')


@pytest.mark.django_db
def test_get_indexers_levanta_quando_o_prowlarr_nao_responde():
    """
    Exercita o método DE VERDADE, e não um `patch` dele.

    O teste que existia acima trocava `get_indexers` por um duplo, então nunca
    tocava na implementação — e uma mutação que devolvesse `[]` no erro
    passava despercebida. É esse retorno que fazia o painel dizer "0
    indexadores" sobre um Prowlarr mudo.
    """
    import httpx
    from asgiref.sync import async_to_sync

    from apps.integrations.prowlarr import ProwlarrClient

    # Porta onde não há nada: a recusa é imediata, sem espera de rede.
    cliente = ProwlarrClient('http://127.0.0.1:1', 'chave')

    async def tenta():
        try:
            cliente.client.timeout = 2.0
            return await cliente.get_indexers()
        finally:
            await cliente.close()

    with pytest.raises((httpx.HTTPError, OSError)):
        async_to_sync(tenta)()


# ── as ações ──────────────────────────────────────────────────────────────
# Um painel que só mostra número obriga a abrir um terminal para agir sobre o
# que ele mostra. Mas ação vinda da rede tem outro peso que leitura, e a guarda
# central é a lista FECHADA.

@pytest.mark.django_db
def test_usuario_comum_nao_dispara_nada(comum):
    r = cliente_de(comum).post(reverse('painel-acao'), {'acao': 'pulso'}, format='json')
    assert r.status_code == 403


@pytest.mark.django_db
def test_acao_fora_da_lista_e_recusada(admin):
    """
    A guarda que impede o painel de virar um executor remoto de qualquer coisa
    registrada no Celery.
    """
    r = cliente_de(admin).post(
        reverse('painel-acao'),
        {'acao': 'apps.movies.tasks.apaga_tudo'}, format='json')
    assert r.status_code == 400
    assert 'não é uma ação' in r.data['detail']


@pytest.mark.django_db
def test_toda_acao_da_lista_aponta_para_uma_tarefa_que_existe(admin):
    """
    Duas das quatro apontavam para nomes errados quando foram escritas, e isso
    só apareceu porque este teste rodou antes de a tela existir. Um botão que
    estoura ao ser apertado é pior que um botão a menos.
    """
    from importlib import import_module

    from apps.core.acoes import ACOES

    for chave, acao in ACOES.items():
        modulo, nome = acao['tarefa'].rsplit('.', 1)
        tarefa = getattr(import_module(modulo), nome, None)
        assert tarefa is not None, f'{chave}: {acao["tarefa"]} não existe'
        assert hasattr(tarefa, 'delay'), f'{chave}: {acao["tarefa"]} não é tarefa Celery'


@pytest.mark.django_db
def test_toda_acao_se_explica(admin):
    from apps.core.acoes import disponiveis

    for a in disponiveis():
        assert a['titulo'].strip()
        assert len(a['descricao']) > 20, (
            f'{a["chave"]}: quem aperta precisa saber o que vai acontecer')


@pytest.mark.django_db
def test_disparar_registra_quem_disparou(admin):
    """
    O sinal do Celery vê a tarefa, não a pessoa. Sem gravar aqui, o painel
    nunca saberia quem mandou rodar.
    """
    from unittest.mock import MagicMock

    from apps.core.models import ExecucaoDeTarefa

    with patch('apps.core.acoes._dispara', return_value=MagicMock(id='tarefa-1')):
        r = cliente_de(admin).post(reverse('painel-acao'), {'acao': 'pulso'},
                                   format='json')

    assert r.status_code == 200
    assert r.data['task_id'] == 'tarefa-1'
    registro = ExecucaoDeTarefa.objects.get(task_id='tarefa-1')
    assert registro.disparada_por_id == admin.id
    assert registro.origem == ExecucaoDeTarefa.MANUAL


@pytest.mark.django_db
def test_fila_fora_do_ar_nao_vira_500(admin):
    """
    "Não consegui enfileirar" e "a tarefa falhou" são coisas diferentes, e quem
    lê precisa saber qual das duas foi.
    """
    with patch('apps.core.acoes._dispara', side_effect=OSError('broker fora')):
        r = cliente_de(admin).post(reverse('painel-acao'), {'acao': 'pulso'},
                                   format='json')
    assert r.status_code == 503
    assert 'enfileirar' in r.data['detail']


# ── os gráficos ───────────────────────────────────────────────────────────
# Um gráfico é a forma mais fácil de afirmar com autoridade: uma linha subindo
# convence antes de ser lida.

@pytest.mark.django_db
def test_serie_curta_demais_nao_vira_grafico(db):
    """
    Duas medições não descrevem tendência nenhuma, e a linha entre elas
    convence sem ter o que dizer.
    """
    from apps.core.graficos import duracao_das_tarefas

    g = duracao_das_tarefas()
    assert g['tipo'] == 'sem-dado'
    assert g['ressalva'].strip(), 'não explicou por que não há gráfico'


@pytest.mark.django_db
def test_com_massa_a_serie_vira_grafico(db):
    from datetime import timedelta

    from django.utils import timezone

    from apps.core.graficos import duracao_das_tarefas
    from apps.core.models import ExecucaoDeTarefa

    agora = timezone.now()
    for i in range(8):
        ExecucaoDeTarefa.objects.create(
            tarefa='apps.tasks.pulso.pulso', task_id=f't{i}',
            iniciada_em=agora - timedelta(days=i),
            terminada_em=agora - timedelta(days=i), duracao_s=1.5 + i,
            sucesso=True)

    g = duracao_das_tarefas()
    assert g['tipo'] == 'linhas'
    assert g['dados'][0]['nome'] == 'pulso', 'mostrou o caminho inteiro do módulo'
    assert len(g['dados'][0]['pontos']) >= 3


@pytest.mark.django_db
def test_todo_grafico_diz_de_onde_veio(db):
    from apps.core.graficos import monta_graficos

    for g in monta_graficos():
        assert g['origem'].strip(), f'{g["chave"]} não diz de onde os dados vêm'
        assert g['tipo'] in ('linhas', 'barras', 'sem-dado')
        if g['tipo'] == 'sem-dado':
            assert g['ressalva'].strip(), f'{g["chave"]} não explica a ausência'
