"""
Testes da API da projeção coletiva.

O que mais importa aqui é quem NÃO entra: a sessão dá acesso ao acervo de
mídia de alguém, e o convite é a única credencial.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.user_sessions.models import (CinemaSession, SessionInvite,
                                       SessionMessage, SessionParticipant)


@pytest.fixture
def dono(db, django_user_model):
    return django_user_model.objects.create_user(username='dono', password='x')


@pytest.fixture
def convidado(db, django_user_model):
    return django_user_model.objects.create_user(username='convidado', password='x')


@pytest.fixture
def estranho(db, django_user_model):
    return django_user_model.objects.create_user(username='estranho', password='x')


def cliente(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def sessao(dono):
    return CinemaSession.objects.create(
        user=dono, name='Noite Tarkovsky', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))


def codigo_de(sessao, dono):
    r = cliente(dono).post(f'/api/sessions/{sessao.id}/invite/')
    assert r.status_code == 201, r.data
    return r.data['code']


# ── convite e entrada ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dono_cria_convite_e_convidado_entra(sessao, dono, convidado):
    code = codigo_de(sessao, dono)
    r = cliente(convidado).post('/api/sessions/join/', {'code': code}, format='json')

    assert r.status_code == 200
    assert SessionParticipant.objects.filter(session=sessao, user=convidado).exists()


@pytest.mark.django_db
def test_quem_nao_e_dono_nao_cria_convite(sessao, estranho):
    """Convidar é dar acesso ao acervo de alguém; só o dono decide."""
    assert cliente(estranho).post(f'/api/sessions/{sessao.id}/invite/').status_code in (403, 404)


@pytest.mark.django_db
def test_codigo_invalido_e_inexistente_dao_a_mesma_resposta(sessao, dono, convidado):
    """
    Mensagens distintas contariam a quem tentasse adivinhar se um código
    existe — e o código é a credencial de acesso.
    """
    inexistente = cliente(convidado).post('/api/sessions/join/', {'code': 'nao-existe'}, format='json')

    SessionInvite.objects.create(session=sessao, created_by=dono, code='expirado',
                                 expires_at=timezone.now() - timedelta(minutes=1))
    expirado = cliente(convidado).post('/api/sessions/join/', {'code': 'expirado'}, format='json')

    assert inexistente.status_code == expirado.status_code == 404
    assert inexistente.data == expirado.data


@pytest.mark.django_db
def test_convite_revogado_nao_deixa_entrar(sessao, dono, convidado):
    code = codigo_de(sessao, dono)
    cliente(dono).post(f'/api/sessions/{sessao.id}/revoke-invites/')

    r = cliente(convidado).post('/api/sessions/join/', {'code': code}, format='json')
    assert r.status_code == 404
    assert not SessionParticipant.objects.filter(user=convidado).exists()


@pytest.mark.django_db
def test_entrar_duas_vezes_nao_duplica(sessao, dono, convidado):
    code = codigo_de(sessao, dono)
    for _ in range(3):
        cliente(convidado).post('/api/sessions/join/', {'code': code}, format='json')
    assert SessionParticipant.objects.filter(session=sessao, user=convidado).count() == 1


# ── acesso ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_estranho_nao_ve_a_sessao(sessao, estranho):
    assert cliente(estranho).get(f'/api/sessions/{sessao.id}/').status_code == 404


@pytest.mark.django_db
def test_convidado_ve_a_sessao_depois_de_entrar(sessao, dono, convidado):
    """
    Antes o queryset filtrava só por dono, então o convidado não conseguia
    nem carregar a ficha do que ia assistir.
    """
    antes = cliente(convidado).get(f'/api/sessions/{sessao.id}/')
    assert antes.status_code == 404

    cliente(convidado).post('/api/sessions/join/', {'code': codigo_de(sessao, dono)}, format='json')
    assert cliente(convidado).get(f'/api/sessions/{sessao.id}/').status_code == 200


@pytest.mark.django_db
def test_convidado_nao_prepara_nem_convida(sessao, dono, convidado):
    """Ver a sessão não é comandá-la: escrever continua sendo do dono."""
    cliente(convidado).post('/api/sessions/join/', {'code': codigo_de(sessao, dono)}, format='json')

    c = cliente(convidado)
    assert c.post(f'/api/sessions/{sessao.id}/invite/').status_code in (403, 404)
    assert c.delete(f'/api/sessions/{sessao.id}/').status_code in (403, 404)


# ── chat ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_participante_escreve_e_le_o_chat(sessao, dono, convidado):
    cliente(convidado).post('/api/sessions/join/', {'code': codigo_de(sessao, dono)}, format='json')
    c = cliente(convidado)

    r = c.post(f'/api/sessions/{sessao.id}/messages/',
               {'text': 'Essa cena do quarto.', 'position': 4460}, format='json')
    assert r.status_code == 201
    assert r.data['playback_position_seconds'] == 4460
    assert r.data['author'] == 'convidado'
    assert r.data['is_self'] is True

    lidas = c.get(f'/api/sessions/{sessao.id}/messages/')
    assert [m['text'] for m in lidas.data] == ['Essa cena do quarto.']


@pytest.mark.django_db
def test_estranho_nao_le_o_chat(sessao, estranho):
    assert cliente(estranho).get(f'/api/sessions/{sessao.id}/messages/').status_code == 404


@pytest.mark.django_db
def test_mensagem_vazia_e_recusada(sessao, dono):
    r = cliente(dono).post(f'/api/sessions/{sessao.id}/messages/',
                           {'text': '   '}, format='json')
    assert r.status_code == 400


@pytest.mark.django_db
def test_is_self_distingue_quem_falou(sessao, dono, convidado):
    cliente(convidado).post('/api/sessions/join/', {'code': codigo_de(sessao, dono)}, format='json')
    cliente(convidado).post(f'/api/sessions/{sessao.id}/messages/',
                            {'text': 'oi'}, format='json')

    visto_pelo_dono = cliente(dono).get(f'/api/sessions/{sessao.id}/messages/').data
    assert visto_pelo_dono[0]['is_self'] is False
    assert visto_pelo_dono[0]['author'] == 'convidado'


# ── participantes ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_lista_de_participantes_inclui_o_anfitriao(sessao, dono, convidado):
    cliente(convidado).post('/api/sessions/join/', {'code': codigo_de(sessao, dono)}, format='json')
    r = cliente(dono).get(f'/api/sessions/{sessao.id}/participants/')

    papeis = {p['username']: p['role'] for p in r.data}
    assert papeis == {'dono': 'host', 'convidado': 'guest'}


def test_o_chat_tem_duas_barreiras_e_so_uma_e_testavel():
    """
    Registro de uma lacuna conhecida, não um teste de comportamento.

    O acesso ao chat é barrado duas vezes: pelo queryset (dono ou
    participante) e por uma checagem explícita dentro da action. A segunda é
    inalcançável hoje — quem não passa pela primeira leva 404 antes —, então
    removê-la não quebra teste nenhum.

    Ela fica como segunda barreira para o dia em que o queryset for alargado,
    e isto existe para que a ausência de cobertura seja deliberada e visível
    em vez de descoberta por acidente.
    """
    import inspect

    from apps.user_sessions.views import CinemaSessionViewSet

    fonte = inspect.getsource(CinemaSessionViewSet.messages)
    assert 'if not participacao:' in fonte


@pytest.mark.django_db
def test_sessao_em_curso_nao_some_da_tela(sessao, dono):
    """
    /upcoming/ devolve só planning, preparing e ready. Sem uma rota para a
    sessão em andamento, ela sumia no instante em que era iniciada — e a ação
    de encerrá-la ficava inalcançável, porque a tela perdia a sessão.
    """
    c = cliente(dono)
    assert c.get('/api/sessions/current/').data is None

    sessao.status = 'in_progress'
    sessao.save(update_fields=['status'])

    assert c.get('/api/sessions/upcoming/').data == []
    assert c.get('/api/sessions/current/').data['id'] == str(sessao.id)


@pytest.mark.django_db
def test_current_traz_a_fila_de_filmes(sessao, dono):
    """A tela em curso precisa da fila; /upcoming/ é leve e não a traz."""
    sessao.status = 'in_progress'
    sessao.save(update_fields=['status'])
    assert cliente(dono).get('/api/sessions/current/').data['session_movies'] is not None


@pytest.mark.django_db
def test_current_nao_vaza_sessao_de_outro(sessao, estranho):
    sessao.status = 'in_progress'
    sessao.save(update_fields=['status'])
    assert cliente(estranho).get('/api/sessions/current/').data is None


@pytest.mark.django_db
def test_relevant_prefere_a_em_curso(sessao, dono):
    """
    A tela dividia esta pergunta entre /current/ e /upcoming/, e a sessão muda
    de endpoint no instante em que é iniciada. Nesse instante as duas listas
    discordavam e a tela anunciava "nenhuma projeção agendada" logo depois de
    a pessoa ter começado uma.
    """
    from datetime import timedelta as td

    futura = CinemaSession.objects.create(
        user=dono, name='Depois', theme_type='custom',
        scheduled_date=timezone.now() + td(days=5))
    sessao.status = 'in_progress'
    sessao.save(update_fields=['status'])

    r = cliente(dono).get('/api/sessions/relevant/')
    assert r.data['id'] == str(sessao.id)
    assert r.data['id'] != str(futura.id)


@pytest.mark.django_db
def test_relevant_cai_na_proxima_agendada(sessao, dono):
    assert cliente(dono).get('/api/sessions/relevant/').data['id'] == str(sessao.id)


@pytest.mark.django_db
def test_relevant_ignora_encerrada(sessao, dono):
    sessao.status = 'completed'
    sessao.save(update_fields=['status'])
    assert cliente(dono).get('/api/sessions/relevant/').data is None


@pytest.mark.django_db
def test_relevant_nao_vaza_de_outro(sessao, estranho):
    assert cliente(estranho).get('/api/sessions/relevant/').data is None


@pytest.mark.django_db
def test_relevant_traz_a_fila(sessao, dono):
    assert cliente(dono).get('/api/sessions/relevant/').data['session_movies'] is not None
