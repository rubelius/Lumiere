"""
ASGI config for lumiere project.
"""

import os

from django.core.asgi import get_asgi_application

# 1. Initialize Django settings FIRST
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumiere.settings')

# 2. Get the ASGI application ONCE
django_asgi_app = get_asgi_application()

from apps.notifications import routing as notification_routing
# Import all WebSocket routes
from apps.user_sessions import routing as session_routing
# 3. Import Channels and routing AFTER Django is initialized
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# 4. Define the primary application router
application = ProtocolTypeRouter({
    # Django's ASGI application to handle traditional HTTP requests
    "http": django_asgi_app,
    
    # WebSocket chat handler
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                # Combine as listas de URLs de WebSockets
                session_routing.websocket_urlpatterns +
                notification_routing.websocket_urlpatterns
            )
        )
    ),
})