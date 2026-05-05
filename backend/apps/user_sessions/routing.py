from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path('ws/sessions/<uuid:session_id>/', consumers.SessionConsumer.as_asgi()),  # type: ignore
]