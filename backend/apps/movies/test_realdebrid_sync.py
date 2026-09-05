"""
Testes da sincronização com o Real-Debrid.

O contrato que importa aqui não é o caminho feliz: é o que a sincronização faz
quando a API do Real-Debrid não responde. Ela roda de hora em hora, e um erro
tratado como resposta válida apaga dado bom do acervo.
"""

def test_consulta_falha_nao_apaga_os_links_gravados():
    """
    `get_torrent_info` engole erro de HTTP e devolve {}, então "a API não
    respondeu" chegava aqui idêntico a "não tem links". Gravar [] por cima
    apagava os links bons, e playback.py exclui exatamente as linhas com lista
    vazia — um blip de rede na sincronização horária tirava o filme do ar.

    Em update_or_create, o que não está em defaults não é tocado. Por isso a
    ausência da chave é o conserto, e é o que este teste cobra.
    """
    from apps.movies.realdebrid_sync import monta_campos

    torrent = {'id': 'abc', 'hash': 'DEAD', 'status': 'downloaded',
               'bytes': 1, 'links': []}

    com = monta_campos(None, torrent, 'Alphaville 1965 1080p BluRay', grava_links=True)
    sem = monta_campos(None, torrent, 'Alphaville 1965 1080p BluRay', grava_links=False)

    assert com['realdebrid_links'] == []
    assert 'realdebrid_links' not in sem, (
        'a chave presente sobrescreve os links já gravados')
    # O resto do registro continua sendo atualizado normalmente.
    assert sem['realdebrid_status'] == 'downloaded'
    assert sem['in_realdebrid'] is True
