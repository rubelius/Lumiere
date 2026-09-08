"""
Guardas do agendamento periódico.

Uma string errada no `beat_schedule` não falha em lugar nenhum visível: o beat
publica, o worker responde NotRegistered, e nada na aplicação nota. O mesmo vale
para um módulo de tarefas fora de `app.conf.imports` e para uma fila que
ninguém consome.
"""

import pkgutil

import pytest

from lumiere.celery import app


@pytest.fixture(scope='module', autouse=True)
def tarefas_carregadas():
    """O autodiscovery é preguiçoso; sem isto o registro vem quase vazio."""
    app.loader.import_default_modules()


def registradas() -> set:
    return set(app.tasks)


def test_toda_entrada_do_beat_aponta_para_uma_tarefa_que_existe():
    """
    Duas entradas já apontaram para `apps.tasks.sessions.auto_prepare_sessions`
    e `send_session_reminders`, que nunca existiram: o beat disparava
    NotRegistered a cada hora e a cada 30 minutos, em silêncio.
    """
    conhecidas = registradas()
    faltando = {nome: e['task'] for nome, e in app.conf.beat_schedule.items()
                if e['task'] not in conhecidas}

    assert not faltando, f'entradas apontando para o nada: {faltando}'


def test_todo_modulo_de_tarefas_esta_em_conf_imports():
    """
    O autodiscovery procura um módulo `tasks` DENTRO de cada app instalada, e
    as tarefas deste projeto moram em `apps/tasks/<assunto>.py` — `apps.tasks`
    não é app instalada. Sem o import explícito elas não são encontradas, e o
    beat dispara nomes que o worker não conhece.
    """
    import apps.tasks

    modulos = {f'apps.tasks.{m.name}' for m in pkgutil.iter_modules(apps.tasks.__path__)
               if not m.name.startswith('test_')}
    declarados = set(app.conf.imports or ())

    assert modulos <= declarados, f'fora de conf.imports: {sorted(modulos - declarados)}'


def test_toda_fila_usada_e_declarada():
    """
    `apply_async(queue='etl')` numa fila ausente de `task_queues` põe a tarefa
    onde ninguém lê: ela fica lá, sem erro e sem execução.
    """
    import re
    from pathlib import Path

    raiz = Path(__file__).resolve().parents[2]
    usadas = set()
    for arquivo in raiz.rglob('apps/**/*.py'):
        if arquivo.name.startswith('test_'):
            continue
        for m in re.finditer(r"queue\s*=\s*[\"']([a-z_]+)[\"']", arquivo.read_text()):
            usadas.add(m.group(1))

    declaradas = {q.name for q in (app.conf.task_queues or ())}

    assert usadas <= declaradas, f'filas que ninguém consome: {sorted(usadas - declaradas)}'


def test_comentar_no_codigo_nao_e_o_que_desativa_um_agendamento():
    """
    O contrato que mais surpreende aqui.

    Com o DatabaseScheduler, `setup_schedule` chama `update_from_dict`, que só
    PERCORRE o dicionário criando e atualizando — não há nenhum delete em todo
    o DatabaseScheduler. Uma entrada que já entrou na tabela PeriodicTask
    continua lá e continua disparando depois de ser comentada no código.

    Neste projeto as duas entradas comentadas nunca chegaram à tabela, porque o
    beat só rodou pela primeira vez depois de elas já estarem comentadas — é
    sorte, não desenho. Este teste existe para o comentário em lumiere/celery.py
    não virar uma promessa falsa se alguém reativá-las e comentá-las de novo.
    """
    import inspect

    from django_celery_beat.schedulers import DatabaseScheduler

    fonte = inspect.getsource(DatabaseScheduler)
    assert '.delete()' not in fonte, (
        'o DatabaseScheduler passou a apagar entradas — o aviso em '
        'lumiere/celery.py pode ser revisto')
