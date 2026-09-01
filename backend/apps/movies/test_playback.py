"""
Testes da cadeia de resolução de reprodução.

O que importa aqui é a REGRA DE NEGÓCIO — Real-Debrid primeiro, depois
Jellyfin, por fim Plex — e o isolamento entre os degraus. Os clientes HTTP em
si não são exercitados: dependem de servidores reais e são substituídos.
"""

import asyncio
from types import SimpleNamespace

import pytest

from apps.movies import playback
from apps.movies.playback import PlaybackSource, resolve_playback


def _fonte(nome):
    return PlaybackSource(source=nome, stream_url=f'http://exemplo/{nome}.mkv', label=nome.upper())


def _resolvedor(retorno):
    async def _r(movie, user):
        return retorno
    return _r


def _explode(mensagem='fonte fora do ar'):
    async def _r(movie, user):
        raise RuntimeError(mensagem)
    return _r


def _resolver(monkeypatch, rd=None, jelly=None, plex=None):
    """Substitui os três degraus e roda a cadeia."""
    monkeypatch.setattr(playback, 'RESOLVEDORES', [rd, jelly, plex])
    return asyncio.run(resolve_playback(SimpleNamespace(), SimpleNamespace()))


def test_realdebrid_tem_precedencia_sobre_todos(monkeypatch):
    fonte = _resolver(
        monkeypatch,
        rd=_resolvedor(_fonte('realdebrid')),
        jelly=_resolvedor(_fonte('jellyfin')),
        plex=_resolvedor(_fonte('plex')),
    )
    assert fonte.source == 'realdebrid'


def test_cai_para_jellyfin_quando_nao_ha_cache_no_realdebrid(monkeypatch):
    fonte = _resolver(
        monkeypatch,
        rd=_resolvedor(None),
        jelly=_resolvedor(_fonte('jellyfin')),
        plex=_resolvedor(_fonte('plex')),
    )
    assert fonte.source == 'jellyfin'


def test_cai_para_plex_quando_realdebrid_e_jellyfin_nao_tem(monkeypatch):
    fonte = _resolver(
        monkeypatch,
        rd=_resolvedor(None),
        jelly=_resolvedor(None),
        plex=_resolvedor(_fonte('plex')),
    )
    assert fonte.source == 'plex'


def test_sem_nenhuma_fonte_devolve_none(monkeypatch):
    assert _resolver(
        monkeypatch,
        rd=_resolvedor(None), jelly=_resolvedor(None), plex=_resolvedor(None),
    ) is None


def test_fonte_que_explode_nao_derruba_a_cadeia(monkeypatch):
    """Um Jellyfin fora do ar não pode impedir a queda para o Plex."""
    fonte = _resolver(
        monkeypatch,
        rd=_resolvedor(None),
        jelly=_explode('jellyfin inacessível'),
        plex=_resolvedor(_fonte('plex')),
    )
    assert fonte.source == 'plex'


def test_realdebrid_quebrado_nao_impede_jellyfin(monkeypatch):
    fonte = _resolver(
        monkeypatch,
        rd=_explode('token expirado'),
        jelly=_resolvedor(_fonte('jellyfin')),
        plex=_resolvedor(_fonte('plex')),
    )
    assert fonte.source == 'jellyfin'


def test_todas_explodindo_devolve_none_em_vez_de_propagar(monkeypatch):
    assert _resolver(
        monkeypatch, rd=_explode(), jelly=_explode(), plex=_explode(),
    ) is None


def test_ordem_declarada_e_a_esperada():
    """Blinda a regra de negócio contra reordenação acidental."""
    assert [r.__name__ for r in playback.RESOLVEDORES] == [
        '_from_realdebrid', '_from_jellyfin', '_from_plex',
    ]


@pytest.mark.parametrize('campo,valor', [
    ('jellyfin_server_url', ''),
    ('jellyfin_token', ''),
])
def test_jellyfin_sem_credencial_e_ignorado(campo, valor):
    """Sem servidor ou sem token, o degrau se recusa em vez de tentar HTTP."""
    user = SimpleNamespace(jellyfin_server_url='http://jelly', jellyfin_token='k', jellyfin_user_id='')
    setattr(user, campo, valor)
    movie = SimpleNamespace(title='Filme', original_title='Movie', year=1990)
    assert asyncio.run(playback._from_jellyfin(movie, user)) is None


def test_plex_sem_credencial_e_ignorado():
    user = SimpleNamespace(plex_server_url='', plex_token='')
    movie = SimpleNamespace(title='Filme', original_title='Movie', year=1990)
    assert asyncio.run(playback._from_plex(movie, user)) is None
