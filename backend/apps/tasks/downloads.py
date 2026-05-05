import logging
from celery import shared_task
from django.utils import timezone
from django.core.cache import cache
from django.db import transaction
from asgiref.sync import async_to_sync

from apps.integrations.realdebrid import RealDebridClient
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
        
        if not user.realdebrid_api_key:  # type: ignore
            return {'error': 'Real-Debrid not configured'}
        
        # Wrapped async logic
        async def add_async():
            client = RealDebridClient(user.realdebrid_api_key)  # type: ignore
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
        
        # Start monitoring task (without explicit lock yet, lock will be handled by the periodic check)
        monitor_realdebrid_download.apply_async(
            args=[release_id, user_id],
            countdown=30  # Check after 30 seconds
        ) # type: ignore
        
        return {
            'release_id': str(release_id),
            'torrent_id': torrent_id,
            'status': 'downloading'
        }
    
    except Exception as e:
        logger.error(f"Error adding to Real-Debrid: {e}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


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
        lock_key = f'rd_monitor_lock_{release.id}'

        # Only spawn if no monitor is already running for this release
        # Lock TTL = 26 minutes (slightly over max monitor lifetime of 50 * 30s = 25min)
        acquired = cache.add(lock_key, '1', timeout=60 * 26)
        if not acquired:
            continue  # monitor already running

        session_movie = SessionMovie.objects.filter(
            selected_release=release
        ).select_related('session__user').first()

        if not session_movie:
            continue

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
            client = RealDebridClient(user.realdebrid_api_key)
            try:
                return await client.get_torrent_info(release.realdebrid_id)
            finally:
                await client.close()

        info = async_to_sync(check_async)()
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
                client = RealDebridClient(user.realdebrid_api_key)
                try:
                    return await client.get_download_links(release.realdebrid_id)
                finally:
                    await client.close()

            links = async_to_sync(get_links_async)()
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

    except (TorrentRelease.DoesNotExist, Exception) as e:
        if self.request.retries >= self.max_retries:
            release_lock()
            try:
                TorrentRelease.objects.filter(id=release_id).update(
                    realdebrid_status='error'
                )
            except Exception:
                pass
            return {'status': 'error', 'message': 'Max retries reached'}
        raise self.retry(exc=e, countdown=30)