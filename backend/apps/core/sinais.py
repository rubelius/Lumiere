"""
Onde a execução de cada tarefa vira número.

Sem isto o painel não teria benchmark nenhum para mostrar: o backend de
resultado em uso é o Redis, e as linhas que existem no banco têm `task_name`
nulo em todas — medido, 53.788 de 53.788. Não dá para saber qual tarefa rodou
nem quanto demorou.

Os sinais do Celery são o lugar certo para medir: pegam TODA execução, venha
ela do beat, da fila ou do botão do painel, e não exigem tocar em nenhuma
tarefa existente.

REGRA DESTE ARQUIVO: nada aqui pode derrubar uma tarefa. Um erro ao registrar a
medição é um número a menos no gráfico; uma exceção propagada é uma tarefa
perdida. Por isso todo handler engole o que der errado e apenas registra no log.
"""

import logging

from celery.signals import task_failure, task_postrun, task_prerun
from django.utils import timezone

logger = logging.getLogger(__name__)

# Tarefas do próprio Celery não interessam ao painel e poluiriam o gráfico.
PREFIXOS_IGNORADOS = ('celery.',)


def _interessa(nome: str) -> bool:
    return bool(nome) and not nome.startswith(PREFIXOS_IGNORADOS)


@task_prerun.connect
def marca_inicio(task_id=None, task=None, **kwargs):
    nome = getattr(task, 'name', '') or ''
    if not _interessa(nome):
        return
    try:
        from apps.core.models import ExecucaoDeTarefa

        # `update_or_create` e não `create`: o painel já cria a linha ao
        # disparar à mão, para poder registrar QUEM disparou — coisa que este
        # sinal não tem como saber.
        ExecucaoDeTarefa.objects.update_or_create(
            task_id=task_id,
            defaults={'tarefa': nome, 'iniciada_em': timezone.now()},
        )
    except Exception as erro:  # noqa: BLE001
        logger.info('não consegui registrar o início de %s: %s', nome, erro)


@task_postrun.connect
def marca_fim(task_id=None, task=None, state=None, **kwargs):
    nome = getattr(task, 'name', '') or ''
    if not _interessa(nome):
        return
    try:
        from apps.core.models import ExecucaoDeTarefa

        execucao = ExecucaoDeTarefa.objects.filter(task_id=task_id).first()
        if not execucao:
            return
        agora = timezone.now()
        execucao.terminada_em = agora
        execucao.duracao_s = (agora - execucao.iniciada_em).total_seconds()
        # `sucesso` só é escrito aqui quando ainda é nulo: o sinal de falha roda
        # ANTES deste e já gravou False com a mensagem. Sobrescrever apagaria a
        # única informação que diz o que deu errado.
        if execucao.sucesso is None:
            execucao.sucesso = (state == 'SUCCESS')
        execucao.save(update_fields=['terminada_em', 'duracao_s', 'sucesso'])
    except Exception as erro:  # noqa: BLE001
        logger.info('não consegui registrar o fim de %s: %s', nome, erro)


@task_failure.connect
def marca_falha(task_id=None, exception=None, sender=None, **kwargs):
    nome = getattr(sender, 'name', '') or ''
    if not _interessa(nome):
        return
    try:
        from apps.core.models import ExecucaoDeTarefa

        ExecucaoDeTarefa.objects.filter(task_id=task_id).update(
            sucesso=False, erro=str(exception)[:2000])
    except Exception as erro:  # noqa: BLE001
        logger.info('não consegui registrar a falha de %s: %s', nome, erro)
