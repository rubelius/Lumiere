# apps/core/secrets.py

import base64
import hashlib
import os

from cryptography.fernet import Fernet
from django.conf import settings


class SecretsManager:
    """Gerenciador de secrets criptografados"""
    
    def __init__(self):
        # SECURITY #4: Fallback seguro e derivação de chave
        # Tenta usar a ENCRYPTION_KEY, se não existir, faz fallback para a SECRET_KEY do Django
        key = os.getenv('ENCRYPTION_KEY') or settings.SECRET_KEY
        
        if not key:
            raise ValueError('ENCRYPTION_KEY or Django SECRET_KEY must be set')
            
        # Transforma qualquer string plana (plain text) do ambiente 
        # em uma chave de exatos 32-bytes url-safe base64 exigida pelo Fernet
        key_bytes = key.encode('utf-8')
        derived_key = hashlib.sha256(key_bytes).digest()
        fernet_key = base64.urlsafe_b64encode(derived_key)
        
        self.cipher = Fernet(fernet_key)
    
    def encrypt(self, plaintext: str) -> str:
        """Criptografa string"""
        return self.cipher.encrypt(plaintext.encode('utf-8')).decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """Descriptografa string"""
        return self.cipher.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
    
    @staticmethod
    def generate_key() -> str:
        """Gera nova chave de criptografia"""
        return Fernet.generate_key().decode('utf-8')


# Uso:
# manager = SecretsManager()
# encrypted_token = manager.encrypt(user.realdebrid_api_key)
# decrypted_token = manager.decrypt(encrypted_token)