# apps/core/validators.py

import re

import bleach
from django.core.exceptions import ValidationError


class InputValidator:
    """Validadores de input customizados"""
    
    @staticmethod
    def validate_year(value):
        """Valida ano de filme"""
        if not (1888 <= value <= 2100):
            raise ValidationError(
                f'{value} is not a valid year (1888-2100)'
            )
    
    @staticmethod
    def validate_rating(value):
        """Valida rating (0.5 a 5.0)"""
        if not (0.5 <= value <= 5.0):
            raise ValidationError(
                f'{value} is not a valid rating (0.5-5.0)'
            )
        
        # Must be multiple of 0.5
        if (value * 2) % 1 != 0:
            raise ValidationError(
                'Rating must be multiple of 0.5'
            )
    
    @staticmethod
    def validate_imdb_id(value):
        """Valida IMDb ID (formato: tt1234567)"""
        pattern = r'^tt\d{7,8}$'
        if not re.match(pattern, value):
            raise ValidationError(
                f'{value} is not a valid IMDb ID'
            )
    
    @staticmethod
    def sanitize_html(html: str, allowed_tags: list = None) -> str:
        """
        Sanitiza HTML removendo tags perigosas
        
        Args:
            html: HTML string
            allowed_tags: Lista de tags permitidas
        
        Returns:
            HTML sanitizado
        """
        if allowed_tags is None:
            allowed_tags = [
                'p', 'br', 'strong', 'em', 'u', 'a',
                'ul', 'ol', 'li', 'blockquote', 'code'
            ]
        
        allowed_attrs = {
            'a': ['href', 'title'],
            '*': ['class']
        }
        
        return bleach.clean(
            html,
            tags=allowed_tags,
            attributes=allowed_attrs,
            strip=True
        )