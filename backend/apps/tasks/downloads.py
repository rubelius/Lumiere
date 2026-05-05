import logging
from celery import shared_task
from django.utils import timezone
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
        release.save()
        
        logger.info(f"Added {release.title} to Real-Debrid: {torrent_id}")
        
        # Start monitoring task
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


@shared_task(bind=True, max_retries=50)
def monitor_realdebrid_download(self, release_id, user_id, session_id=None):
    """
    Monitora progresso de download no Real-Debrid
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        release = TorrentRelease.objects.get(id=release_id)
        user = User.objects.get(id=user_id)
        
        if not release.realdebrid_id:
            logger.error(f"Release {release_id} has no Real-Debrid ID")
            return {'error': 'No Real-Debrid torrent ID'}
        
        # Get status from Real-Debrid securely
        async def check_async():
            client = RealDebridClient(user.realdebrid_api_key)  # type: ignore
            try:
                return await client.get_torrent_info(release.realdebrid_id)
            finally:
                await client.close()
                
        info = async_to_sync(check_async)()
        
        status = info.get('status')
        progress = info.get('progress', 0)
        
        # Update release
        release.realdebrid_status = status
        release.realdebrid_progress = progress
        release.save()
        
        # Send WebSocket update if session provided
        if session_id:
            send_download_progress(
                session_id=session_id,
                movie_id=str(release.movie_id),  # type: ignore
                progress=progress
            )
        
        logger.info(f"Download progress for {release.title}: {progress}% ({status})")
        
        # Check status
        if status == 'downloaded':
            async def get_links_async():
                client = RealDebridClient(user.realdebrid_api_key)  # type: ignore
                try:
                    return await client.get_download_links(release.realdebrid_id)
                finally:
                    await client.close()
                    
            links = async_to_sync(get_links_async)()
            
            release.realdebrid_links = links
            release.realdebrid_completed_at = timezone.now()
            release.save()
            
            # Update session movie if applicable
            if session_id:
                try:
                    session_movie = SessionMovie.objects.get(
                        session_id=session_id,
                        selected_release=release
                    )
                    session_movie.download_status = 'ready'
                    session_movie.download_progress = 100
                    session_movie.save()
                    
                    # Check if all movies ready
                    session = session_movie.session
                    all_ready = all([
                        sm.download_status == 'ready'
                        for sm in session.session_movies.all()  # type: ignore
                    ])
                    
                    if all_ready:
                        session.all_downloads_ready = True
                        session.download_progress = 100
                        session.status = 'ready'
                        session.save()
                        
                        send_session_update(
                            session_id=session_id,
                            data={'status': 'ready', 'all_downloads_ready': True}
                        )
                except SessionMovie.DoesNotExist:
                    pass
            
            logger.info(f"Download completed for {release.title}")
            return {'status': 'completed', 'links': links}
        
        elif status == 'error':
            logger.error(f"Download failed for {release.title}")
            return {'status': 'error'}
        
        elif status in ['downloading', 'queued', 'waiting_files_selection']:
            # Continue monitoring - retry in 30 seconds
            raise self.retry(countdown=30)
        
        else:
            logger.warning(f"Unknown status for {release.title}: {status}")
            raise self.retry(countdown=60)
    
    except TorrentRelease.DoesNotExist:
        logger.error(f"Release {release_id} not found")
        return {'error': 'Release not found'}
    
    except Exception as e:
        logger.error(f"Error monitoring download: {e}")
        
        if self.request.retries >= self.max_retries:
            logger.error(f"Max retries reached for {release_id}")
            release = TorrentRelease.objects.get(id=release_id)
            release.realdebrid_status = 'error'
            release.save()
            return {'status': 'error', 'message': 'Max retries reached'}
        
        raise self.retry(exc=e, countdown=30)


@shared_task
def check_realdebrid_status():
    """
    Periodic task: verifica status de todos os downloads ativos
    Roda a cada 5 minutos via beat schedule
    """
    active_releases = TorrentRelease.objects.filter(
        in_realdebrid=True,
        realdebrid_status__in=['downloading', 'queued', 'waiting_files_selection']
    )
    
    logger.info(f"Checking status of {active_releases.count()} active downloads")
    
    for release in active_releases:
        # BUG 3 RESOLVIDO AQUI: Query reverse correlation feita de forma correta e explícita
        session_movie = SessionMovie.objects.filter(selected_release=release).first()
        
        if session_movie:
            user = session_movie.session.user
            session_id = str(session_movie.session.id)
        else:
            # Skip se o release estiver "órfão"
            continue
        
        monitor_realdebrid_download.apply_async(
            args=[str(release.id), str(user.id), session_id]
        ) # type: ignore
    
    return {'checked': active_releases.count()}