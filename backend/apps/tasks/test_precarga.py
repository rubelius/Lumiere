"""
O rastreador que enche o banco de cópias antes de alguém precisar delas.

A ordem da fila é a decisão de produto: são 25.908 filmes e cada busca leva
~120 segundos, então varrer tudo leva mais de um mês. Varrer na ordem errada
gasta esse mês em filmes que ninguém vai abrir.
"""

from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.integrations.prowlarr import ProwlarrIndisponivel
from apps.movies.models import Movie
from apps.tasks.precarga import (CHAVE_DA_RODADA, DIAS_ATE_VENCER,
                                 pede_prioridade, proximos_da_fila,
                                 rastreia_copias)


@pytest.fixture(autouse=True)
def limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='dono', password='x',
        prowlarr_url='http://localhost:9696', prowlarr_api_key='chave')


def filme(titulo, *, ranking=None, varrido_ha_dias=None):
    m = Movie.objects.create(title=titulo, year=1950, ranking_current=ranking)
    if varrido_ha_dias is not None:
        Movie.objects.filter(pk=m.pk).update(
            copias_buscadas_em=timezone.now() - timezone.timedelta(days=varrido_ha_dias))
        m.refresh_from_db()
    return m


# ── a ordem da fila ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nunca_varrido_vem_antes_de_quem_ja_foi():
    """
    O Postgres ordena NULL por ÚLTIMO no ascendente. Sem `nulls_first`, o
    rastreador começaria pelos filmes que já tem, e os 25.903 sem cópia
    nenhuma nunca chegariam à vez.
    """
    filme('Já varrido', ranking=1, varrido_ha_dias=DIAS_ATE_VENCER + 1)
    novo = filme('Nunca varrido', ranking=9999)

    assert proximos_da_fila(1)[0].pk == novo.pk


@pytest.mark.django_db
def test_entre_os_nunca_varridos_o_ranking_decide():
    """É o que o acervo mostra primeiro; é o que alguém vai abrir primeiro."""
    filme('Obscuro', ranking=8000)
    melhor = filme('Cânone', ranking=3)

    assert proximos_da_fila(1)[0].pk == melhor.pk


@pytest.mark.django_db
def test_filme_sem_ranking_vai_para_o_fim():
    """Um filme que a home não mostra não vale um lugar na frente da fila."""
    filme('Sem ranking', ranking=None)
    com = filme('Com ranking', ranking=5000)

    assert proximos_da_fila(1)[0].pk == com.pk


@pytest.mark.django_db
def test_quem_foi_varrido_ha_pouco_nao_volta_para_a_fila():
    """
    Sem esta trava, a rodada seguinte recomeçaria pelos mesmos filmes para
    sempre — e o rastreador nunca sairia dos quatro primeiros.
    """
    filme('Recente', ranking=1, varrido_ha_dias=1)
    assert proximos_da_fila(4) == []


@pytest.mark.django_db
def test_o_vencido_volta_para_a_fila():
    velho = filme('Vencido', ranking=1, varrido_ha_dias=DIAS_ATE_VENCER + 1)
    assert proximos_da_fila(1)[0].pk == velho.pk


@pytest.mark.django_db
def test_entre_vencidos_o_mais_velho_primeiro():
    filme('Vencido ontem', ranking=1, varrido_ha_dias=DIAS_ATE_VENCER + 1)
    antigo = filme('Vencido faz meses', ranking=9999, varrido_ha_dias=200)

    assert proximos_da_fila(1)[0].pk == antigo.pk


# ── quem abriu a ficha passa na frente ────────────────────────────────────

@pytest.mark.django_db
def test_quem_tem_ficha_aberta_fura_a_fila():
    filme('Cânone', ranking=1)
    pedido = filme('Obscuro', ranking=9999)

    pede_prioridade(pedido.pk)

    assert proximos_da_fila(1)[0].pk == pedido.pk


@pytest.mark.django_db
def test_o_pedido_vale_mesmo_para_quem_foi_varrido_ha_pouco():
    """
    Quem abriu a ficha quer o que existe AGORA. A trava de sete dias serve
    para o rastreador não girar em falso, não para recusar um pedido.
    """
    recente = filme('Recente', ranking=1, varrido_ha_dias=1)
    pede_prioridade(recente.pk)

    assert [f.pk for f in proximos_da_fila(4)] == [recente.pk]


@pytest.mark.django_db
def test_pedir_duas_vezes_nao_duplica_o_trabalho():
    m = filme('Pedido', ranking=1)
    pede_prioridade(m.pk)
    pede_prioridade(m.pk)

    assert [f.pk for f in proximos_da_fila(4)].count(m.pk) == 1


@pytest.mark.django_db
def test_o_pedido_sai_da_fila_depois_de_atendido():
    m = filme('Pedido', ranking=1)
    pede_prioridade(m.pk)

    proximos_da_fila(4)
    # Na segunda rodada ele volta pelo caminho normal (nunca varrido), mas não
    # mais como pedido — senão um clique o poria na frente para sempre.
    from apps.tasks.precarga import CHAVE_DA_FILA
    assert cache.get(CHAVE_DA_FILA) == []


@pytest.mark.django_db
def test_um_pedido_de_filme_apagado_nao_derruba_a_rodada():
    pede_prioridade('00000000-0000-0000-0000-000000000000')
    filme('Normal', ranking=1)

    assert len(proximos_da_fila(4)) == 1


# ── a rodada ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_a_rodada_nao_sonda_o_real_debrid(usuario):
    """
    São 24 dos 144 segundos medidos, mas o custo não é o tempo: cada sondagem
    ADICIONA E REMOVE um torrent na conta do Real-Debrid. Repetir isso por
    25.908 filmes é pedir para a conta ser sinalizada.
    """
    filme('Alvo', ranking=1)

    with patch('apps.tasks.precarga.executa_busca') as busca:
        busca.return_value = {'new_releases_found': 3}
        rastreia_copias(quantos=1)

    assert busca.call_args.kwargs['sondar'] is False


@pytest.mark.django_db
def test_prowlarr_fora_interrompe_a_rodada_inteira(usuario):
    """
    Seguir marcaria os filmes seguintes como varridos sem terem sido — e o
    rastreador só voltaria a eles daqui a uma semana, com o banco vazio.
    """
    for i in range(3):
        filme(f'Filme {i}', ranking=i)

    with patch('apps.tasks.precarga.executa_busca',
               side_effect=ProwlarrIndisponivel('fora do ar')) as busca:
        resultado = rastreia_copias(quantos=3)

    assert busca.call_count == 1, 'insistiu depois de saber que o Prowlarr caiu'
    assert resultado['interrompido'] == 'prowlarr indisponível'


@pytest.mark.django_db
def test_uma_falha_num_filme_nao_derruba_a_rodada(usuario):
    for i in range(3):
        filme(f'Filme {i}', ranking=i)

    with patch('apps.tasks.precarga.executa_busca',
               side_effect=[ValueError('título estranho'),
                            {'new_releases_found': 2},
                            {'new_releases_found': 1}]):
        resultado = rastreia_copias(quantos=3)

    assert resultado['varridos'] == 2
    assert resultado['falhas'] == 1
    assert resultado['novas'] == 3


@pytest.mark.django_db
def test_duas_rodadas_ao_mesmo_tempo_nao_varrem_os_mesmos_filmes(usuario):
    """
    `copias_buscadas_em` só é gravado no FIM de cada busca. Sem o cadeado, uma
    rodada lenta faria a seguinte pegar exatamente a mesma fila.
    """
    filme('Alvo', ranking=1)
    cache.set(CHAVE_DA_RODADA, '1', 60)

    with patch('apps.tasks.precarga.executa_busca') as busca:
        resultado = rastreia_copias(quantos=1)

    assert busca.call_count == 0
    assert 'pulou' in resultado


@pytest.mark.django_db
def test_o_cadeado_e_devolvido_mesmo_quando_a_rodada_explode(usuario):
    filme('Alvo', ranking=1)

    with patch('apps.tasks.precarga.proximos_da_fila', side_effect=RuntimeError('boom')):
        with pytest.raises(RuntimeError):
            rastreia_copias(quantos=1)

    assert cache.get(CHAVE_DA_RODADA) is None, 'cadeado preso por 25 minutos'


@pytest.mark.django_db
def test_sem_prowlarr_configurado_a_rodada_nao_finge_trabalhar(db):
    filme('Alvo', ranking=1)

    with patch('apps.tasks.precarga.executa_busca') as busca:
        resultado = rastreia_copias(quantos=1)

    assert busca.call_count == 0
    assert 'pulou' in resultado


# ── o rastreador e o botão dividem o mesmo cadeado ────────────────────────

@pytest.mark.django_db
def test_nao_varre_um_filme_que_ja_esta_sendo_buscado(usuario):
    """
    Com dois cadeados diferentes, um clique e uma rodada disparariam duas
    buscas simultâneas no mesmo filme: duas idas ao Prowlarr, e as duas
    gravando as mesmas cópias.
    """
    from apps.movies.release_search import marca_enfileirada

    m = filme('Disputado', ranking=1)
    marca_enfileirada(m.pk)          # como se alguém tivesse clicado

    with patch('apps.tasks.precarga.executa_busca') as busca:
        resultado = rastreia_copias(quantos=1)

    assert busca.call_count == 0
    assert resultado['ocupados'] == 1


@pytest.mark.django_db
def test_a_tela_ve_o_rastreador_trabalhando(usuario):
    """
    Sem escrever o mesmo documento de estado, quem abrisse a ficha veria um
    botão parado sobre um filme sem cópia nenhuma, sem saber que já havia
    alguém procurando.
    """
    from apps.movies.release_search import estado_da_busca

    m = filme('Em curso', ranking=1)
    vistos = []

    def espia(filme_, user_, sondar=True):
        vistos.append(estado_da_busca(m.pk)['estado'])
        return {'new_releases_found': 1, 'total_releases': 1}

    with patch('apps.tasks.precarga.executa_busca', side_effect=espia):
        rastreia_copias(quantos=1)

    assert vistos == ['buscando'], 'a tela não veria a busca acontecendo'
    assert estado_da_busca(m.pk)['estado'] == 'concluida'


@pytest.mark.django_db
def test_a_falha_do_rastreador_chega_a_tela(usuario):
    from apps.movies.release_search import estado_da_busca

    m = filme('Quebrado', ranking=1)

    with patch('apps.tasks.precarga.executa_busca',
               side_effect=ValueError('indexador recusou')):
        rastreia_copias(quantos=1)

    doc = estado_da_busca(m.pk)
    assert doc['estado'] == 'erro'
    assert 'indexador recusou' in doc['erro']


@pytest.mark.django_db
def test_pedir_prioridade_dispara_uma_rodada_na_hora():
    """
    Esperar o beat seria trocar a espera de 144 segundos por outra de até dez
    minutos — a mesma espera, com outro nome.
    """
    m = filme('Aberto agora', ranking=1)

    with patch('apps.tasks.precarga.rastreia_copias.delay') as roda:
        pede_prioridade(m.pk)

    assert roda.call_count == 1


@pytest.mark.django_db
def test_sem_broker_a_ficha_ainda_abre():
    """
    Derrubar a abertura da ficha porque o Celery está fora seria trocar um
    defeito pequeno por um grande. O pedido fica na fila para a próxima rodada.
    """
    m = filme('Aberto agora', ranking=1)

    with patch('apps.tasks.precarga.rastreia_copias.delay',
               side_effect=OSError('broker fora')):
        pede_prioridade(m.pk)       # não levanta

    assert [f.pk for f in proximos_da_fila(1)] == [m.pk]
