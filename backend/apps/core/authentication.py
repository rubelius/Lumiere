# apps/core/authentication.py

import secrets

from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    Autenticação via API Key para integrações externas
    
    Header: X-API-Key: your-api-key-here
    """
    
    def authenticate(self, request):
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return None
        
        try:
            # Validar API key
            # Implementar modelo APIKey conforme necessário
            from apps.core.models import APIKey
            
            key_obj = APIKey.objects.select_related('user').get(
                key=api_key,
                is_active=True
            )
            
            # Update last used
            key_obj.last_used = timezone.now()
            key_obj.save(update_fields=['last_used'])
            
            return (key_obj.user, key_obj)
        
        except APIKey.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid API key')

