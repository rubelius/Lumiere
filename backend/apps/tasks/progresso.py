"""
O que uma tarefa longa está fazendo AGORA.

POR QUE EXISTE: apertar "rastrear cópias agora" no painel enfileirava o
trabalho e a tela não dizia mais nada — nem quanto falta, nem em que filme
está, nem quantas cópias achou. O relato foi exatamente esse, e ele vale para
qualquer tarefa que demore mais que um instante.

O Celery sabe que uma tarefa está ATIVA, e só. Quanto ela já andou é
conhecimento que só existe dentro dela, e só ela pode publicar.

POR QUE REDIS E NÃO BANCO: isto é escrito a cada item processado — uma linha de
banco por filme varrido seria custo de escrita no meio do trabalho, e o dado
não tem valor depois que a rodada acaba. O histórico durável é o
`ExecucaoDeTarefa`; isto aqui é o vivo.
"""

import logging
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

CHAVE = 'progresso:{}'

# Quanto um progresso sobrevive sem notícia.
#
# Mais longo que a rodada mais lenta, para não sumir no meio; curto o bastante
# para um worker morto não deixar "rodando" para sempre na tela. O cadeado do
# rastreador é de 25 minutos, e 30 dá a folga.
SEGUNDOS_DE_VIDA = 30 * 60


def _agora():
    return time.time()


def comeca(tarefa: str, total: int, detalhe: str = '') -> None:
    _grava(tarefa, {
        'tarefa': tarefa, 'total': total, 'feitos': 0, 'achados': 0,
        'agora_em': '', 'detalhe': detalhe, 'erros': 0,
        'comecou_em': _agora(), 'atualizado_em': _agora(), 'terminou': False,
    })


def avanca(tarefa: str, agora_em: str = '', achados: int = 0,
           erro: bool = False) -> None:
    """
    Um item a mais. `agora_em` é o que a tela mostra como "trabalhando em".
    """
    estado = ler(tarefa)
    if not estado:
        return
    estado['feitos'] += 1
    estado['achados'] += max(0, achados)
    estado['erros'] += 1 if erro else 0
    estado['agora_em'] = agora_em
    estado['atualizado_em'] = _agora()
    _grava(tarefa, estado)


def anuncia(tarefa: str, agora_em: str) -> None:
    """
    O que começou a ser feito, antes de terminar.

    Separado de `avanca` de propósito: sem isto a tela mostraria sempre o item
    ANTERIOR, e num filme que leva um minuto para ser buscado é um minuto
    inteiro dizendo a coisa errada.
    """
    estado = ler(tarefa)
    if not estado:
        return
    estado['agora_em'] = agora_em
    estado['atualizado_em'] = _agora()
    _grava(tarefa, estado)


def termina(tarefa: str, resumo: str = '') -> None:
    estado = ler(tarefa) or {'tarefa': tarefa}
    estado.update({'terminou': True, 'resumo': resumo,
                   'atualizado_em': _agora()})
    # Fica mais um pouco: quem estava olhando precisa ver o resultado, e não a
    # linha sumindo no instante em que o trabalho acaba.
    _grava(tarefa, estado, segundos=120)


def ler(tarefa: str) -> dict | None:
    return cache.get(CHAVE.format(tarefa))


def _grava(tarefa: str, estado: dict, segundos: int = SEGUNDOS_DE_VIDA) -> None:
    try:
        cache.set(CHAVE.format(tarefa), estado, segundos)
    except Exception as erro:  # noqa: BLE001
        # Publicar progresso NUNCA pode derrubar o trabalho. Uma tela sem barra
        # é um incômodo; uma rodada perdida é meia hora de busca jogada fora.
        logger.info('não consegui publicar progresso de %s: %s', tarefa, erro)


# As tarefas que publicam progresso. A lista é fechada porque o painel precisa
# saber o que PERGUNTAR — não há como varrer chaves do Redis sem `KEYS`, que é
# proibido em produção.
TAREFAS_COM_PROGRESSO = [
    'apps.tasks.precarga.rastreia_copias',
]


def em_curso() -> list:
    """Os progressos vivos, para o painel."""
    vivos = []
    for tarefa in TAREFAS_COM_PROGRESSO:
        estado = ler(tarefa)
        if estado:
            vivos.append(estado)
    return vivos
