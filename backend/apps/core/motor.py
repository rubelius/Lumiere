"""
O estado do motor, do jeito que a TELA precisa saber.

Diferente de `/api/health/`, que existe para orquestrador e responde a
pergunta "este processo deve receber tráfego?". Aqui a pergunta é outra:
"posso prometer a esta pessoa que apertar o botão vai adiantar alguma coisa?"

Existe porque a resposta era não e ninguém contava. Uma sessão inteira abriu
com Postgres travado num lock órfão, Docker desligado, worker e beat mortos —
e a tela seguia oferecendo [ ATUALIZAR CÓPIAS ] com a mesma confiança de
sempre. Antes disso, uma busca ficou dez minutos "na fila" pelo mesmo motivo.
"""

import logging

from celery import current_app
from django.core.cache import cache

from apps.tasks.pulso import beat_esta_vivo, quando_foi_o_ultimo_pulso

logger = logging.getLogger(__name__)

# A resposta fica guardada por meio minuto.
#
# `control.ping` é um broadcast com espera: ele custa o timeout inteiro quando
# não há worker, que é exatamente o caso em que a tela mais pergunta. Sem o
# cache, cada aba aberta pagaria esse segundo.
CHAVE = 'motor:estado'
SEGUNDOS_GUARDADOS = 30

# Um segundo é generoso para um worker na mesma máquina e curto o bastante
# para não travar a resposta quando não há nenhum.
SEGUNDOS_DE_ESPERA_DO_PING = 1.0


def _workers_respondendo() -> int:
    """Quantos workers atendem agora. Zero é resposta, não erro."""
    try:
        respostas = current_app.control.ping(timeout=SEGUNDOS_DE_ESPERA_DO_PING)
    except Exception as erro:
        # Broker fora do ar cai aqui. Não saber quantos workers há é o mesmo
        # que não ter nenhum, do ponto de vista de quem espera uma busca.
        logger.warning('Não foi possível perguntar aos workers: %s', erro)
        return 0
    return len(respostas or [])


def estado_do_motor(forcar: bool = False) -> dict:
    """
    O que está de pé, e o que isso significa para quem está olhando a tela.

    `busca_funciona` é a conclusão, e é ela que a tela usa: separado, cada
    componente é trivia de infraestrutura; junto, é a diferença entre um botão
    que cumpre o que promete e um que não.
    """
    if not forcar:
        guardado = cache.get(CHAVE)
        if guardado:
            return guardado

    workers = _workers_respondendo()
    beat = beat_esta_vivo()

    estado = {
        'workers': workers,
        # O beat só é dado como vivo quando o pulso dele chegou — e o pulso só
        # chega se um worker o executou. Um beat publicando para ninguém não
        # adianta nada, então a pergunta certa é essa mesma.
        'beat': beat,
        'ultimo_pulso': quando_foi_o_ultimo_pulso(),
        # A busca é enfileirada pela view e executada pelo worker. Sem worker
        # ela é aceita e nunca acontece: 202, botão girando, e silêncio.
        'busca_funciona': workers > 0,
        # O rastreador depende do beat para as rodadas periódicas.
        'rastreio_funciona': workers > 0 and beat,
    }

    cache.set(CHAVE, estado, SEGUNDOS_GUARDADOS)
    return estado
