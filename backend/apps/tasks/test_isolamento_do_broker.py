"""
Guarda do isolamento do broker durante os testes.

A suíte publicava no broker de produção e um worker no ar executava as tarefas
de verdade: 48 tarefas de retreino ficaram represadas apontando para usuários de
teste já apagados. O risco maior nem era esse — um teste que chegue a
`search_torrents_for_movie` ou a `add_to_realdebrid` faria o worker bater nas
APIs externas com as credenciais reais do usuário.

Esta guarda existe porque a quebra é silenciosa: nada falha quando o isolamento
some, os testes seguem verdes e as tarefas vazam.
"""

import pytest

from conftest import BACKEND_DE_TESTE, BROKER_DE_TESTE


def test_o_broker_da_suite_nao_e_o_de_producao():
    from lumiere.celery import app

    assert app.conf.broker_url == BROKER_DE_TESTE
    assert 'redis' not in str(app.conf.broker_url)


def test_a_conexao_de_escrita_tambem_esta_isolada():
    """
    `app.conf` e a conexão que o publish usa são coisas diferentes: a conexão
    vem de um pool que pode ter sido criado com o valor antigo.
    """
    from lumiere.celery import app

    assert 'redis' not in app.connection_for_write().as_uri()


def test_o_backend_de_resultado_nao_suja_o_de_producao():
    from lumiere.celery import app

    assert app.conf.result_backend == BACKEND_DE_TESTE


@pytest.mark.django_db
def test_publicar_de_verdade_nao_sai_do_processo(django_user_model):
    """
    O caminho real: gravar progresso agenda o retreino do gosto. Isto tem que
    funcionar (a publicação não pode estourar) e não pode sair daqui.
    """
    from apps.ml.similarity import agenda_retreino_do_gosto

    usuario = django_user_model.objects.create_user(username='efemero', password='x')

    assert agenda_retreino_do_gosto(usuario) is True


def test_a_variavel_de_ambiente_e_ajustada_antes_do_import():
    """
    O Celery lê CELERY_BROKER_URL do AMBIENTE como preconf, e preconf ganha das
    settings do Django. Trocar `app.conf.broker_url` depois do import não surte
    efeito — e não avisa. O conftest escreve no ambiente no topo do módulo, e é
    isso que precisa continuar valendo.
    """
    import os

    assert os.environ.get('CELERY_BROKER_URL') == BROKER_DE_TESTE
