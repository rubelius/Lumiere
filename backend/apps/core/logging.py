# apps/core/logging.py

import json
import logging
from typing import Any, Dict


class StructuredLogger:
    """Logger com suporte a structured logging"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def log(
        self,
        level: str,
        message: str,
        extra: Dict[str, Any] = None,
        exc_info: bool = False
    ):
        """
        Log estruturado
        
        Args:
            level: debug, info, warning, error, critical
            message: Mensagem de log
            extra: Dados extras em formato dict
            exc_info: Incluir exception info
        """
        log_data = {
            'message': message,
            **(extra or {})
        }
        
        getattr(self.logger, level.lower())(
            json.dumps(log_data),
            exc_info=exc_info
        )
    
    def info(self, message: str, **kwargs):
        self.log('info', message, kwargs)
    
    def error(self, message: str, **kwargs):
        self.log('error', message, kwargs, exc_info=True)
    
    def warning(self, message: str, **kwargs):
        self.log('warning', message, kwargs)
    
    def debug(self, message: str, **kwargs):
        self.log('debug', message, kwargs)


# Uso:
# logger = StructuredLogger('apps.movies')
# logger.info('Movie created', movie_id=movie.id, title=movie.title)
# logger.error('Failed to fetch torrents', movie_id=movie.id, error=str(e))