# apps/tasks/backup.py

import logging
import subprocess
from datetime import datetime

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task
def backup_database():
    """
    Task de backup automático do banco
    
    Roda diariamente às 3 AM via beat schedule
    """
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = f'/backups/database/lumiere_{timestamp}.sql.gz'
        
        # Execute backup script
        result = subprocess.run(
            ['/scripts/backup_database.sh'],
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        if result.returncode == 0:
            logger.info(f"Database backup successful: {backup_file}")
            return {'status': 'success', 'file': backup_file}
        else:
            logger.error(f"Database backup failed: {result.stderr}")
            return {'status': 'failed', 'error': result.stderr}
    
    except Exception as e:
        logger.error(f"Database backup error: {e}")
        return {'status': 'error', 'message': str(e)}


# Adicionar ao beat schedule:
# 'backup-database': {
#     'task': 'apps.tasks.backup.backup_database',
#     'schedule': crontab(minute=0, hour=3),  # 3 AM daily
# },

# apps/tasks/backup.py (adicionar)

@shared_task
def backup_media_files():
    """
    Backup de arquivos de mídia
    
    Sincroniza com S3 ou storage externo
    """
    import os

    import boto3
    from botocore.exceptions import ClientError
    
    try:
        s3_client = boto3.client('s3')
        bucket = os.getenv('AWS_S3_BUCKET')
        media_root = settings.MEDIA_ROOT
        
        uploaded = 0
        failed = 0
        
        # Walk through media directory
        for root, dirs, files in os.walk(media_root):
            for file in files:
                local_path = os.path.join(root, file)
                relative_path = os.path.relpath(local_path, media_root)
                s3_key = f'media/{relative_path}'
                
                try:
                    s3_client.upload_file(
                        local_path,
                        bucket,
                        s3_key
                    )
                    uploaded += 1
                except ClientError as e:
                    logger.error(f"Failed to upload {local_path}: {e}")
                    failed += 1
        
        logger.info(f"Media backup: {uploaded} uploaded, {failed} failed")
        return {
            'status': 'success',
            'uploaded': uploaded,
            'failed': failed
        }
    
    except Exception as e:
        logger.error(f"Media backup error: {e}")
        return {'status': 'error', 'message': str(e)}