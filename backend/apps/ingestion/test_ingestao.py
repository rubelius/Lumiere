"""
Testes do pipeline de ingestão.

O defeito que motivou estes testes deixou 117 filmes parados em PROCESSING —
um estado sem saída, que nenhuma consulta de recuperação lia. A causa era a
própria política de retry: a task marcava PROCESSING antes de trabalhar, e a
guarda de status recusava a reexecução dela mesma.
"""

from datetime import timedelta

import pytest
import requests
from celery.exceptions import Retry
from django.utils import timezone

from apps.ingestion.models import RawIngestion
from apps.ingestion import tasks
from apps.ingestion.tasks import (MINUTOS_PARA_ORFA, process_pending_ingestions,
                                  process_single_ingestion)


@pytest.fixture
def linha(db):
    return RawIngestion.objects.create(
        source_id='tspdt-1', raw_data={'Title': 'Stalker', 'Year': '1979'})


def roda(task_id, retries=0):
    process_single_ingestion.push_request(retries=retries)
    try:
        return process_single_ingestion.run(task_id)
    finally:
        process_single_ingestion.pop_request()


@pytest.fixture
def tmdb_cai(monkeypatch):
    """O discovery estoura HTTPError, que é o caminho de retry."""
    def explode(*a, **kw):
        raise requests.HTTPError('502 do TMDB')

    monkeypatch.setattr(tasks.discovery, 'discover', explode)
    monkeypatch.setattr(tasks, 'api_key', 'chave-de-teste')


# ── a reentrada do retry ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_o_retry_consegue_reentrar_na_propria_linha(linha, tmdb_cai, monkeypatch):
    """
    O defeito de origem. A task grava PROCESSING antes de trabalhar, em
    autocommit. Na reexecução, a guarda encontrava PROCESSING e devolvia
    "Task ignorada": os três retries eram no-ops pagos.
    """
    tentou = []
    monkeypatch.setattr(process_single_ingestion, 'retry',
                        lambda **kw: tentou.append(kw) or (_ for _ in ()).throw(Retry()))

    linha.status = 'PROCESSING'
    linha.save(update_fields=['status'])

    with pytest.raises(Retry):
        roda(linha.id, retries=1)

    assert tentou, 'a segunda tentativa saiu pela guarda sem tentar nada'


@pytest.mark.django_db
def test_na_primeira_tentativa_processing_continua_sendo_de_outro(linha, tmdb_cai,
                                                                   monkeypatch):
    """
    A reentrada vale só para quem está voltando. Com retries=0, PROCESSING
    quer dizer que outro worker assumiu, e respeitar isso é o que impede dois
    workers de irem ao TMDB com o mesmo filme.
    """
    tentou = []
    monkeypatch.setattr(process_single_ingestion, 'retry', lambda **kw: tentou.append(kw))

    linha.status = 'PROCESSING'
    linha.save(update_fields=['status'])

    r = roda(linha.id, retries=0)

    assert 'ignorada' in r
    assert tentou == []


@pytest.mark.django_db
def test_a_reivindicacao_e_atomica(linha, tmdb_cai, monkeypatch):
    """
    Entre ler o status e gravar PROCESSING havia uma janela. O UPDATE
    condicional fecha: quem perde a corrida não segue.
    """
    monkeypatch.setattr(process_single_ingestion, 'retry', lambda **kw: None)

    # Simula o outro worker vencendo entre a leitura e a gravação.
    original = RawIngestion.objects.get

    def rouba(*a, **kw):
        obj = original(*a, **kw)
        RawIngestion.objects.filter(id=obj.id).update(status='COMPLETED')
        return obj

    monkeypatch.setattr(RawIngestion.objects, 'get', rouba)

    r = roda(linha.id)

    assert 'assumiu' in r


@pytest.mark.django_db
def test_esgotar_tentativas_devolve_a_linha_a_failed(linha, tmdb_cai, monkeypatch):
    """
    Sem isto a linha terminava em PROCESSING, que nada relê. FAILED é lido
    pela guarda e é visível para quem for investigar.
    """
    def esgotado(**kw):
        raise Exception('MaxRetriesExceededError')

    monkeypatch.setattr(process_single_ingestion, 'retry', esgotado)

    r = roda(linha.id, retries=3)

    linha.refresh_from_db()
    assert linha.status == 'FAILED', f'ficou em {linha.status}'
    assert 'Discovery' in (linha.error_log or '')
    assert 'Falha' in r


# ── o resgate das órfãs ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_linha_parada_em_processing_volta_a_pendente(linha, monkeypatch):
    despachadas = []
    monkeypatch.setattr(process_single_ingestion, 'apply_async',
                        lambda *a, **kw: despachadas.append(kw))

    RawIngestion.objects.filter(id=linha.id).update(
        status='PROCESSING',
        updated_at=timezone.now() - timedelta(minutes=MINUTOS_PARA_ORFA + 5))

    process_pending_ingestions()

    linha.refresh_from_db()
    assert linha.status == 'PENDING'
    assert len(despachadas) == 1


@pytest.mark.django_db
def test_processing_recente_nao_e_roubada_de_quem_trabalha(linha, monkeypatch):
    despachadas = []
    monkeypatch.setattr(process_single_ingestion, 'apply_async',
                        lambda *a, **kw: despachadas.append(kw))

    RawIngestion.objects.filter(id=linha.id).update(
        status='PROCESSING', updated_at=timezone.now())

    process_pending_ingestions()

    linha.refresh_from_db()
    assert linha.status == 'PROCESSING'
    assert despachadas == []


@pytest.mark.django_db
def test_o_despacho_e_ordenado(db, monkeypatch):
    """
    `[:500]` sem ORDER BY deixa o Postgres devolver linhas arbitrárias, e as
    mesmas podem voltar rodada após rodada enquanto o resto nunca é despachado.
    """
    # A ordem física da tabela é a de inserção, e é justamente a que o
    # Postgres tende a devolver sem ORDER BY. Invertendo created_at em relação
    # a ela, o teste deixa de passar por coincidência.
    criadas = [RawIngestion.objects.create(source_id=f'x-{i}', raw_data={'Title': str(i)})
               for i in range(5)]
    agora = timezone.now()
    for posicao, linha_ in enumerate(reversed(criadas)):
        RawIngestion.objects.filter(id=linha_.id).update(
            created_at=agora - timedelta(hours=10 - posicao))

    despachadas = []
    monkeypatch.setattr(process_single_ingestion, 'apply_async',
                        lambda *a, **kw: despachadas.append(kw['args'][0]))
    monkeypatch.setattr(tasks, 'TAMANHO_DO_LOTE', 3)

    process_pending_ingestions()

    esperado = list(RawIngestion.objects.order_by('created_at')
                    .values_list('id', flat=True)[:3])
    assert despachadas == esperado


@pytest.mark.django_db
def test_completed_nunca_e_ressuscitada(db, monkeypatch):
    concluida = RawIngestion.objects.create(
        source_id='pronta', raw_data={}, status='COMPLETED')
    RawIngestion.objects.filter(id=concluida.id).update(
        updated_at=timezone.now() - timedelta(days=30))

    despachadas = []
    monkeypatch.setattr(process_single_ingestion, 'apply_async',
                        lambda *a, **kw: despachadas.append(kw))

    process_pending_ingestions()

    concluida.refresh_from_db()
    assert concluida.status == 'COMPLETED'
    assert despachadas == []


@pytest.mark.django_db
def test_excecao_inesperada_nunca_deixa_a_linha_em_processing(linha, monkeypatch):
    """
    A rede de baixo. Ao reprocessar as 117 órfãs, 19 delas voltaram a ficar
    presas: um IndexError no motor de descoberta subia até o Celery, e nada
    entre a task e o worker devolvia a linha a um estado legível.
    """
    def explode(*a, **kw):
        raise IndexError('list index out of range')

    monkeypatch.setattr(tasks.discovery, 'discover', explode)
    monkeypatch.setattr(tasks, 'api_key', 'chave-de-teste')

    r = roda(linha.id)

    linha.refresh_from_db()
    assert linha.status == 'FAILED', f'ficou em {linha.status}'
    assert 'IndexError' in (linha.error_log or '')
    assert 'Falha' in r


@pytest.mark.django_db
def test_a_rede_de_baixo_nao_engole_o_retry(linha, tmdb_cai, monkeypatch):
    """
    Retry não é falha, é o reagendamento se anunciando. Capturá-la aqui
    marcaria FAILED um filme que só precisava de outra tentativa — e é o mesmo
    defeito que a bomba do monitor do Real-Debrid tinha.
    """
    monkeypatch.setattr(process_single_ingestion, 'retry',
                        lambda **kw: (_ for _ in ()).throw(Retry()))

    with pytest.raises(Retry):
        roda(linha.id)

    linha.refresh_from_db()
    assert linha.status == 'PROCESSING', 'a tentativa seguinte precisa da marca'


def test_descoberta_sem_candidatos_nao_estoura():
    """
    `candidates[0]` cru na Strategy 5, com a lista vazia. A Strategy 4 logo
    acima usa candidates[:2], que tolera vazio — e por isso o defeito ficou
    escondido até 19 linhas pararem por causa dele.
    """
    import inspect
    from apps.ingestion.management.commands.run_etl import DiscoveryEngine

    fonte = inspect.getsource(DiscoveryEngine.discover)
    assert 'if self.wikidata and candidates:' in fonte, (
        'o acesso a candidates[0] voltou a não ser guardado')
