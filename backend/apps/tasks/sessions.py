"""
Preparação de uma sessão de cinema.

A máquina de estados é planning -> preparing -> ready -> in_progress, e a ação
`start` da view exige `ready`. Esta task era um `pass`: nada nunca marcava
`ready`, então toda sessão preparada ficava presa em `preparing` para sempre,
sem erro e sem log — um beco sem saída que a interface não tinha como desfazer.
"""

import logging

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


def melhor_copia(movie):
    """
    A cópia que toca agora, pela mesma regra do resolvedor de reprodução:
    presente no Real-Debrid, com links, e de maior nota de qualidade.

    Manter a regra igual à de apps/movies/playback.py importa — preparar a
    sessão com um critério e reproduzi-la com outro faria a sessão ficar
    `ready` e depois falhar na hora de tocar.
    """
    return (
        movie.torrent_releases.filter(in_realdebrid=True)
        .exclude(realdebrid_links=[])
        .order_by('-quality_score')
        .first()
    )


@shared_task(bind=True)
def prepare_session(self, session_id: str):
    """
    Elege uma cópia para cada filme da sessão e libera a sessão para começar.

    Só marca `ready` quando todos os filmes têm cópia. Faltando algum, devolve
    a sessão para `planning`: é o único estado de onde o dono consegue mexer na
    lista, e deixá-la em `preparing` seria repetir o beco sem saída.
    """
    from apps.user_sessions.models import CinemaSession

    try:
        sessao = CinemaSession.objects.get(pk=session_id)
    except CinemaSession.DoesNotExist:
        logger.warning('Sessão %s não existe mais', session_id)
        return {'error': 'Session not found'}

    # A view só dispara a task depois de gravar 'preparing'. Qualquer outro
    # estado significa reentrada — retry do Celery, clique duplo — e refazer
    # atropelaria uma sessão que já começou.
    if sessao.status != 'preparing':
        logger.info('Sessão %s está em %s, nada a preparar', session_id, sessao.status)
        return {'skipped': sessao.status}

    prontos, sem_copia = 0, []

    with transaction.atomic():
        for item in (sessao.session_movies
                     .select_related('movie').select_for_update()):
            copia = melhor_copia(item.movie)
            item.selected_release = copia
            item.download_status = 'ready' if copia else 'failed'
            item.download_progress = 100 if copia else 0
            item.save(update_fields=['selected_release', 'download_status',
                                     'download_progress'])

            if copia:
                prontos += 1
            else:
                sem_copia.append(item.movie.title)

        total = prontos + len(sem_copia)
        completa = bool(prontos) and not sem_copia
        andamento = int(100 * prontos / total) if total else 0

        sessao.status = 'ready' if completa else 'planning'

        # As quatro flags que o painel da sessão lê. Sem escrevê-las, a sessão
        # ficava `ready` e a tela continuava dizendo que nada tinha acontecido:
        # "Busca de Mídia" e "Download" sem marca, e as duas barras em zero.
        #
        # Escritas SEMPRE, não só no caminho feliz: uma preparação que falha
        # depois de uma que deu certo precisa poder derrubar as marcas, senão
        # viram mais flags que só sobem.
        sessao.all_movies_selected = total > 0
        sessao.all_torrents_found = completa
        # `melhor_copia` só elege cópia que já está no Real-Debrid COM links,
        # ou seja, que toca agora — achar a cópia e ter o download pronto são a
        # mesma coisa neste caminho. Ainda assim cada flag é escrita a partir
        # da sua própria definição, para a igualdade não virar suposição se a
        # regra de eleição mudar.
        sessao.all_downloads_ready = completa
        sessao.preparation_progress = andamento
        sessao.download_progress = andamento

        sessao.save(update_fields=[
            'status', 'all_movies_selected', 'all_torrents_found',
            'all_downloads_ready', 'preparation_progress', 'download_progress',
            'updated_at',
        ])

    logger.info('Sessão %s: %s filme(s) prontos, %s sem cópia -> %s',
                session_id, prontos, len(sem_copia), sessao.status)
    return {'session_id': str(session_id), 'status': sessao.status,
            'prontos': prontos, 'sem_copia': sem_copia}
