"""
O que dá para MANDAR o Lumière fazer pelo painel.

Um painel que só mostra número obriga a abrir um terminal para agir sobre o que
ele mostra — e quem está olhando "25.683 filmes nunca varridos" quer disparar o
rastreador, não anotar o número.

AS TRÊS REGRAS DESTE ARQUIVO:

1. NADA AQUI É DESTRUTIVO. Toda ação enfileira trabalho ou reprocessa; nenhuma
   apaga dado. Apagar é responsabilidade do Django admin, que já existe, tem
   confirmação e registra quem fez.

2. TODA AÇÃO É REGISTRADA com quem disparou. `ExecucaoDeTarefa` nasce aqui já
   com `origem='manual'` e o usuário, porque o sinal do Celery não tem como
   saber — ele vê a tarefa, não a pessoa.

3. A LISTA É FECHADA. Aceitar um nome de tarefa qualquer vindo da requisição
   transformaria o painel num executor remoto de qualquer coisa registrada no
   Celery. Só o que está em `ACOES` roda.
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)


class AcaoDesconhecida(Exception):
    """Pedido de uma ação fora da lista fechada."""


def _dispara(caminho: str, *args, **kwargs):
    """Importa a tarefa pelo caminho e a enfileira."""
    modulo, nome = caminho.rsplit('.', 1)
    from importlib import import_module
    return getattr(import_module(modulo), nome).delay(*args, **kwargs)


# ── a lista fechada ───────────────────────────────────────────────────────
#
# `chave` é o que a tela manda; `tarefa` é o caminho real. Manter os dois
# separados é o que impede a requisição de escolher qualquer coisa importável.

ACOES = {
    'rastreia-copias': {
        'titulo': 'Rastrear cópias agora',
        'descricao': 'Roda uma rodada do rastreador: busca cópias dos próximos '
                     'filmes da fila, sem esperar o agendamento.',
        'tarefa': 'apps.tasks.precarga.rastreia_copias',
    },
    'sincroniza-realdebrid': {
        'titulo': 'Sincronizar com o Real-Debrid',
        'descricao': 'Relê a conta e alinha o estado de todas as cópias.',
        'tarefa': 'apps.tasks.downloads.sync_realdebrid_account',
    },
    'pulso': {
        'titulo': 'Bater o pulso',
        'descricao': 'Escreve o pulso do motor. Serve para confirmar, agora, '
                     'que beat e worker estão vivos — o pulso só aparece '
                     'quando os dois funcionam.',
        'tarefa': 'apps.tasks.pulso.pulso',
    },
    'confere-downloads': {
        'titulo': 'Conferir downloads em curso',
        'descricao': 'Pergunta ao Real-Debrid em que pé estão as cópias que '
                     'foram mandadas baixar, e avisa as que ficaram prontas.',
        'tarefa': 'apps.tasks.downloads.check_realdebrid_status',
    },
}


def disponiveis() -> list:
    """As ações que a tela pode oferecer, com o que cada uma faz."""
    return [{'chave': c, 'titulo': a['titulo'], 'descricao': a['descricao']}
            for c, a in ACOES.items()]


def executa(chave: str, usuario) -> dict:
    """
    Enfileira uma ação e registra quem pediu.

    Devolve o `task_id` para a tela poder acompanhar. Não espera o resultado:
    algumas destas levam minutos, e uma requisição HTTP presa nisso é um
    timeout com trabalho rodando do outro lado.
    """
    acao = ACOES.get(chave)
    if not acao:
        raise AcaoDesconhecida(
            f'{chave!r} não é uma ação do painel. As que existem: '
            + ', '.join(sorted(ACOES)))

    resultado = _dispara(acao['tarefa'])

    # A linha nasce AQUI, e não no sinal do Celery, porque só aqui se sabe quem
    # apertou o botão. O sinal faz `update_or_create` justamente para não
    # sobrescrever isto quando a tarefa começar.
    try:
        from apps.core.models import ExecucaoDeTarefa
        ExecucaoDeTarefa.objects.update_or_create(
            task_id=resultado.id,
            defaults={
                'tarefa': acao['tarefa'],
                'iniciada_em': timezone.now(),
                'origem': ExecucaoDeTarefa.MANUAL,
                'disparada_por': usuario if getattr(usuario, 'pk', None) else None,
            },
        )
    except Exception as erro:  # noqa: BLE001
        # Não registrar não pode desfazer o disparo: a tarefa já está na fila.
        logger.warning('ação %s disparada e não registrada: %s', chave, erro)

    return {'chave': chave, 'titulo': acao['titulo'], 'task_id': resultado.id}
