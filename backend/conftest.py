"""
Pytest configuration for Lumière tests
"""
import os

import django
from django.conf import settings

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumiere.settings')

def pytest_configure(config):
    """Setup Django for pytest"""
    if not settings.configured:
        django.setup()