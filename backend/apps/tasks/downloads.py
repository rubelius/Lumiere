import logging
from celery import shared_task
from celery.exceptions import Retry
from django.utils import timezone
from django.core.cache import cache
from django.db import transaction
from asgiref.sync import async_to_sync

from apps.integrations.realdebrid import (RealDebridClient,
                                             chave_do_usuario)
from apps.movies.models import TorrentRelease
from apps.user_sessions.models import CinemaSession, SessionMovie
from apps.user_sessions.utils import send_download_progress, send_session_update

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=5)
def add_to_realdebrid(self, release_id, user_id):
    """
    Adiciona torrent ao Real-Debrid e seleciona arquivos
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        release = TorrentRelease.objects.get(id=release_id)
        user = User.objects.get(id=user_id)
        
        if not chave_do_usuario(user):
            return {'error': 'Real-Debrid not configured'}
        
        # Wrapped async logic
        async def add_async():
            client = RealDebridClient(chave_do_usuario(user))  # type: ignore
            try:
                torrent_id = await client.add_magnet(release.magnet_link)
                info = await client.get_torrent_info(torrent_id)
                if info.get('files'):
                    largest_file = max(info['files'], key=lambda f: f.get('bytes', 0))
                    await client.select_files(torrent_id, [largest_file['id']])
                return torrent_id
            finally:
                await client.close()
        
        # Usando a forma segura de chamar async no Celery
        torrent_id = async_to_sync(add_async)()
        
        # Update release
        release.in_realdebrid = True
        release.realdebrid_id = torrent_id
        release.realdebrid_status = 'downloading'
        release.realdebrid_added_at = timezone.now()
        release.save(update_fields=['in_realdebrid', 'realdebrid_id', 'realdebrid_status', 'realdebrid_added_at'])
        
        logger.info(f"Added {release.title} to Real-Debrid: {torrent_id}")
        
        # O monitor nasce segurando o MESMO lock que o check periódico
        # consulta. Sem passá-lo, `check_realdebrid_status` não enxergava
        # monitor nenhum e disparava um segundo em até cinco minutos: dois
        # monitores na mesma release, cada um perguntando ao Real-Debrid a
        # cada 30 segundos e gravando por cima do outro.
        #
        # TTL de 26 minutos, o mesmo do check periódico: um pouco acima da
        # vida máxima do monitor (50 tentativas x 30s = 25 min), para o lock
        # nunca sobreviver a quem deveria devolvê-lo.
        lock_key = f'rd_monitor_lock_{release.id}'
        cache.add(lock_key, '1', timeout=60 * 26)
        monitor_realdebrid_download.apply_async(
            args=[release_id, user_id],
            kwargs={'lock_key': lock_key},
            countdown=30  # Check after 30 seconds
        ) # type: ignore
        
        return {
            'release_id': str(release_id),
            'torrent_id': torrent_id,
            'status': 'downloading'
        }
    
    except (TorrentRelease.DoesNotExist, User.DoesNotExist) as e:
        # Registro apagado não volta a existir. Sem este ramo eram cinco
        # tentativas com recuo exponencial — 60s, 120s, 240s, 480s — para
        # nada. As 48 tarefas de retreino que o worker drenou ao subir eram
        # exatamente isso: usuários de teste já removidos.
        logger.warning('Envio ao Real-Debrid abortado, o registro sumiu: %s', e)
        return {'status': 'gone', 'message': str(e)}

    except Exception as e:
        logger.error(f"Error adding to Real-Debrid: {e}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


class EstadoDesconhecido(Exception):
    """
    A API do Real-Debrid não respondeu, então não sabemos o estado do download.

    Existe para separar isso de "o download falhou". `get_torrent_info` engole
    erro de HTTP e devolve {}, e tratar os dois como a mesma coisa marcava
    download saudável como 'error' por causa de instabilidade de rede.
    """


@shared_task
def check_realdebrid_status():
    """
    Periodic task: only spawns a monitor if one is not already running for that release.
    Uses Redis cache as a distributed lock to prevent exponential task accumulation.
    """
    active_releases = TorrentRelease.objects.filter(
        in_realdebrid=True,
        realdebrid_status__in=['downloading', 'queued', 'waiting_files_selection']
    ).select_related()

    spawned = 0
    for release in active_releases:
        # A busca da sessão vem ANTES de pegar o lock. Na ordem inversa, uma
        # release sem sessão travava a chave por 26 minutos e saía pelo
        # `continue` — e só o monitor devolve o lock, monitor que nesse
        # caminho nunca chega a ser disparado. Como a maioria das releases não
        # está em sessão nenhuma, isso bloqueava justamente as que passassem a
        # estar nos 26 minutos seguintes.
        session_movie = SessionMovie.objects.filter(
            selected_release=release
        ).select_related('session__user').first()

        if not session_movie:
            continue

        lock_key = f'rd_monitor_lock_{release.id}'

        # Only spawn if no monitor is already running for this release
        # Lock TTL = 26 minutes (slightly over max monitor lifetime of 50 * 30s = 25min)
        acquired = cache.add(lock_key, '1', timeout=60 * 26)
        if not acquired:
            continue  # monitor already running

        monitor_realdebrid_download.apply_async(
            args=[
                str(release.id),
                str(session_movie.session.user.id),
                str(session_movie.session.id)
            ],
            # Pass the lock key so the task can release it on terminal states
            kwargs={'lock_key': lock_key}
        )
        spawned += 1

    return {'spawned': spawned}


@shared_task(bind=True, max_retries=50)
def monitor_realdebrid_download(self, release_id, user_id, session_id=None, lock_key=None):
    from django.contrib.auth import get_user_model
    User = get_user_model()

    def release_lock():
        if lock_key:
            cache.delete(lock_key)

    try:
        release = TorrentRelease.objects.get(id=release_id)
        user = User.objects.get(id=user_id)

        if not release.realdebrid_id:
            release_lock()
            return {'error': 'No Real-Debrid torrent ID'}

        async def check_async():
            client = RealDebridClient(chave_do_usuario(user))
            try:
                return await client.get_torrent_info(release.realdebrid_id)
            finally:
                await client.close()

        info = async_to_sync(check_async)()
        if not info:
            # Dict vazio é falha de chamada, não estado. Seguir daqui gravaria
            # status=None num campo NOT NULL e progresso 0 num download que
            # pode estar em 90%.
            raise EstadoDesconhecido(f'sem resposta para {release.realdebrid_id}')

        status_val = info.get('status')
        progress = info.get('progress', 0)

        release.realdebrid_status = status_val
        release.realdebrid_progress = progress
        release.save(update_fields=['realdebrid_status', 'realdebrid_progress'])

        if session_id:
            send_download_progress(
                session_id=session_id,
                movie_id=str(release.movie_id),
                progress=progress
            )

        if status_val == 'downloaded':
            # Terminal state — release lock after completion handling
            async def get_links_async():
                client = RealDebridClient(chave_do_usuario(user))
                try:
                    return await client.get_download_links(release.realdebrid_id)
                finally:
                    await client.close()

            links = async_to_sync(get_links_async)()
            if not links:
                # Lista vazia é falha de chamada, não "este torrent não tem
                # links". `get_download_links` refaz um get_torrent_info por
                # dentro, e esse engole erro de HTTP e devolve {} — um blip de
                # rede no exato momento da conclusão virava [].
                #
                # Gravar isso por cima apaga os links bons, e playback.py e
                # tasks/sessions.py excluem justamente as linhas com lista
                # vazia: o filme sairia do ar por causa do blip. Levantar aqui
                # deixa a próxima tentativa reler o estado.
                raise EstadoDesconhecido(
                    f'sem links para {release.realdebrid_id} apesar de downloaded')

            release.realdebrid_links = links
            release.realdebrid_completed_at = timezone.now()
            release.save(update_fields=['realdebrid_links', 'realdebrid_completed_at'])

            if session_id:
                with transaction.atomic():
                    session_movie = SessionMovie.objects.select_for_update().get(
                        session_id=session_id,
                        selected_release=release
                    )
                    session_movie.download_status = 'ready'
                    session_movie.download_progress = 100
                    session_movie.save(update_fields=['download_status', 'download_progress'])

                    session = session_movie.session
                    all_ready = not session.session_movies.exclude(
                        download_status='ready'
                    ).exists()

                    if all_ready:
                        session.all_downloads_ready = True
                        session.download_progress = 100
                        session.status = 'ready'
                        session.save(update_fields=[
                            'all_downloads_ready', 'download_progress', 'status'
                        ])

                if all_ready:
                    send_session_update(
                        session_id=session_id,
                        data={'status': 'ready', 'all_downloads_ready': True}
                    )

            release_lock()
            return {'status': 'completed', 'links': links}

        elif status_val == 'error':
            release_lock()
            return {'status': 'error'}

        else:
            raise self.retry(countdown=30)

    except Retry:
        # `self.retry()` ENFILEIRA a próxima rodada e só então levanta Retry
        # para abortar esta. Como Retry herda de Exception, o `except Exception`
        # abaixo a capturava e chamava retry() de novo: cada rodada enfileirava
        # DUAS cópias de si mesma, e a contagem dobrava a cada 30 segundos.
        #
        # O lock de check_realdebrid_status não defende disso. Ele só impede
        # que o check periódico dispare um monitor a mais; as cópias nascidas
        # aqui vêm de apply_async por dentro do retry e não passam por ele.
        raise

    except (TorrentRelease.DoesNotExist, User.DoesNotExist) as e:
        # Linha apagada não volta a existir: repetir 50 vezes é só barulho.
        release_lock()
        logger.warning('Monitor de %s encerrado, o registro sumiu: %s', release_id, e)
        return {'status': 'gone', 'message': str(e)}

    except Exception as e:
        if self.request.retries >= self.max_retries:
            release_lock()
            # Nunca gravar 'error' aqui. 50 tentativas de 30s dão 25 minutos, e
            # um REMUX 4K não cacheado leva mais que isso: esgotar as tentativas
            # é desfecho normal, não falha.
            #
            # E 'error' não é só impreciso, é irreversível: o filtro de
            # check_realdebrid_status procura por 'downloading', 'queued' e
            # 'waiting_files_selection', então a release marcada assim deixa de
            # ser vista pelo único mecanismo que retomaria o monitoramento cinco
            # minutos depois. Um download saudável ficaria órfão para sempre.
            #
            # O status já foi gravado a cada rodada: o que está no banco é o
            # último estado que de fato observamos, e é o registro honesto.
            logger.warning('Monitor de %s desistiu após %d tentativas: %s',
                           release_id, self.request.retries, e)
            return {'status': 'unknown', 'message': str(e)}
        raise self.retry(exc=e, countdown=30)

@shared_task
def sync_realdebrid_account():
    """
    Traz para o acervo o que já está na conta Real-Debrid.

    Roda sozinha porque o usuário adiciona torrents pela interface do próprio
    Real-Debrid, fora do Lumière — sem esta varredura periódica, o primeiro
    degrau da cadeia de reprodução só enxergaria o que o Prowlarr trouxe.

    A lógica é a mesma do `manage.py sync_realdebrid`; ambos chamam o serviço.
    """
    from apps.movies.realdebrid_sync import sincroniza_realdebrid

    try:
        r = sincroniza_realdebrid()
    except RuntimeError as e:
        # Sem chave configurada não é erro de execução: é ausência de conta.
        logger.info('sync_realdebrid_account ignorado: %s', e)
        return {'ignorado': str(e)}

    logger.info(
        'Real-Debrid sincronizado: %s ligados, %s atualizados, %s sem correspondência (de %s)',
        r.ligados, r.atualizados, r.sem_casamento, r.total_na_conta,
    )
    return {
        'total_na_conta': r.total_na_conta,
        'ligados': r.ligados,
        'atualizados': r.atualizados,
        'series': r.series,
        'incompletos': r.incompletos,
        'sem_casamento': r.sem_casamento,
    }
