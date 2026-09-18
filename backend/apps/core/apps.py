from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'

    def ready(self):
        # Os sinais que medem a duração de cada tarefa. O import tem que
        # acontecer AQUI: em qualquer outro lugar ele roda antes do Django
        # estar pronto, ou não roda de todo — e o painel ficaria sem benchmark
        # sem nada acusar.
        from apps.core import sinais  # noqa: F401
