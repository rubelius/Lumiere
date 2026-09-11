"""
O pulso do beat.

Um worker fora do ar é detectável: basta perguntar a ele. Um BEAT fora do ar
não — ele não escuta nada, não responde a nada, e a única evidência de que
morreu é que as tarefas periódicas param de acontecer. Silêncio parece
funcionamento.

O custo desse silêncio já foi cobrado: uma busca de cópias ficou dez minutos
"na fila" porque ninguém a pegou, e nada em lugar nenhum dizia por quê.

A alternativa seria deduzir o estado do beat do `last_run_at` das tarefas
periódicas. Não presta: para saber se um `last_run_at` está atrasado é preciso
saber de quanto em quanto tempo aquela tarefa deveria rodar, e isso significa
interpretar expressões de crontab. Uma conta complicada para responder uma
pergunta simples.

Aqui o beat simplesmente diz "estou vivo" a cada minuto, e a chave expira
sozinha em três. Se ela não está lá, o beat não está.
"""

import logging

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

CHAVE_DO_PULSO = 'motor:pulso_do_beat'

# Três minutos para uma batida por minuto: tolera uma rodada perdida e um
# relógio impreciso, sem esconder um beat morto por muito tempo.
SEGUNDOS_DE_PULSO = 180


@shared_task
def pulso():
    """
    "O beat está vivo."

    Custa uma escrita no Redis por minuto. É a tarefa mais barata do projeto, e
    existe porque a ausência dela é a única forma de perceber que o agendador
    parou.
    """
    cache.set(CHAVE_DO_PULSO, timezone.now().isoformat(), SEGUNDOS_DE_PULSO)
    return {'em': timezone.now().isoformat()}


def beat_esta_vivo() -> bool:
    """
    Se o agendador bateu ponto nos últimos minutos.

    Não é "o beat existe", é "o beat E um worker estão funcionando": a tarefa é
    publicada pelo beat e executada pelo worker, então a chave só aparece
    quando os dois estão de pé. É a pergunta certa — um beat publicando para
    ninguém não adianta nada.
    """
    return cache.get(CHAVE_DO_PULSO) is not None


def quando_foi_o_ultimo_pulso() -> str | None:
    return cache.get(CHAVE_DO_PULSO)
