# apps/core/secrets.py

import os

from cryptography.fernet import Fernet
from django.conf import settings


class SecretsManager:
    """Gerenciador de secrets criptografados"""
    
    def __init__(self):
        # Key deve estar em variável de ambiente
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError('ENCRYPTION_KEY not set')
        
        self.cipher = Fernet(key.encode())
    
    def encrypt(self, plaintext: str) -> str:
        """Criptografa string"""
        return self.cipher.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Descriptografa string"""
        return self.cipher.decrypt(ciphertext.encode()).decode()
    
    @staticmethod
    def generate_key() -> str:
        """Gera nova chave de criptografia"""
        return Fernet.generate_key().decode()


# Uso:
# manager = SecretsManager()
# encrypted_token = manager.encrypt(user.realdebrid_api_key)
# decrypted_token = manager.decrypt(encrypted_token)