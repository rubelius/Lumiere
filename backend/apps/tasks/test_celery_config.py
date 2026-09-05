"""
Testes da configuração do Celery.

Os dois defeitos que este arquivo cobra não levantam erro em lugar nenhum: a
tarefa é aceita, entra numa fila, e fica lá. O beat idem — ele agenda um nome
e só descobre que o nome não existe quando o worker recebe a mensagem, num log
que ninguém lê.
"""

import ast
from pathlib import Path

from lumiere.celery import app

APPS = Path(__file__).resolve().parent.parent


def filas_citadas_no_codigo():
    """Nomes de fila que aparecem em `queue=` no código, com onde aparecem."""
    achados = {}
    for caminho in APPS.rglob('*.py'):
        rel = caminho.relative_to(APPS.parent).as_posix()
        if '__pycache__' in rel or '/migrations/' in rel or rel.endswith(Path(__file__).name):
            continue
        for no in ast.walk(ast.parse(caminho.read_text())):
            if not isinstance(no, ast.Call):
                continue
            for k in no.keywords:
                if k.arg == 'queue' and isinstance(k.value, ast.Constant):
                    achados.setdefault(k.value.value, []).append(f'{rel}:{k.value.lineno}')
    return achados


def test_toda_fila_usada_no_codigo_e_consumida():
    """
    `apply_async(queue='etl')` numa fila que nenhum worker escuta não falha:
    a mensagem é publicada e espera para sempre. Foi o que aconteceu com a
    ingestão inteira.
    """
    declaradas = {q.name for q in app.conf.task_queues or ()}
    assert declaradas, 'task_queues não declarada: o worker só consome a fila padrão'

    orfas = {nome: onde for nome, onde in filas_citadas_no_codigo().items()
             if nome not in declaradas}
    assert not orfas, (
        'fila usada e não declarada em task_queues — ninguém consome:\n  '
        + '\n  '.join(f'{n}: {", ".join(o)}' for n, o in orfas.items()))


def test_todo_agendamento_do_beat_aponta_para_task_existente():
    """
    O beat aceita qualquer string como nome de task. O erro só aparece no
    worker, ao receber a mensagem — e já houve entradas aqui apontando para
    tasks que nunca chegaram a ser escritas.
    """
    # app.tasks só é populado quando os módulos são importados, e isso é
    # preguiçoso — sem forçar, todo agendamento pareceria ausente.
    app.loader.import_default_modules()

    ausentes = [
        f'{rotulo} -> {entrada["task"]}'
        for rotulo, entrada in (app.conf.beat_schedule or {}).items()
        if entrada['task'] not in app.tasks
    ]
    assert not ausentes, (
        'agendamento apontando para task que não existe:\n  ' + '\n  '.join(ausentes))
