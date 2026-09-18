import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class APIKey(models.Model):
    """API Key para integrações externas"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='api_keys'
    )
    
    name = models.CharField(max_length=200)
    key = models.CharField(max_length=64, unique=True)
    
    is_active = models.BooleanField(default=True)
    
    # Permissions
    can_read = models.BooleanField(default=True)
    can_write = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    
    # Usage tracking
    last_used = models.DateTimeField(null=True, blank=True)
    total_requests = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'api_keys'
        ordering = ['-created_at']
    
    @classmethod
    def generate_key(cls):
        """Gera API key segura"""
        return secrets.token_urlsafe(48)
    
    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.generate_key()
        super().save(*args, **kwargs)

class ExecucaoDeTarefa(models.Model):
    """
    Uma execução de tarefa, com quanto durou.

    POR QUE ESTE MODELO EXISTE. O painel de administração precisava mostrar
    benchmark de jobs, e não havia dado nenhum: `django_celery_results` está
    configurado para o banco no settings mas o `.env` sobrepõe para o Redis, e
    mesmo se não sobrepusesse, `result_extended` é falso — medido, as 53.788
    linhas existentes têm `task_name` NULO em TODAS. Ou seja: não dá para saber
    qual tarefa rodou, quanto demorou, nem se falhou.

    Fazer gráfico sobre isso seria inventar. Este modelo é a medição de
    verdade: os sinais do Celery (`apps/core/sinais.py`) escrevem aqui a cada
    execução, e é daqui que os gráficos saem.

    O QUE ELE GUARDA E O `TaskResult` NÃO: o nome da tarefa, a duração, e quem
    disparou — beat, fila ou uma pessoa apertando o botão no painel. As três
    perguntas que o painel faz.
    """

    BEAT = 'beat'
    MANUAL = 'manual'
    OUTRO = 'outro'
    ORIGENS = [(BEAT, 'Agendada'), (MANUAL, 'Disparada à mão'), (OUTRO, 'Outra')]

    tarefa = models.CharField(max_length=255, db_index=True)
    task_id = models.CharField(max_length=64, unique=True)

    iniciada_em = models.DateTimeField(db_index=True)
    terminada_em = models.DateTimeField(null=True, blank=True)
    # Em segundos. Guardada em vez de calculada na leitura porque é o que os
    # gráficos agregam, e agregar sobre uma diferença de datas em 50 mil linhas
    # custa caro à toa.
    duracao_s = models.FloatField(null=True, blank=True, db_index=True)

    sucesso = models.BooleanField(null=True, blank=True,
                                  help_text='Nulo enquanto está rodando.')
    erro = models.TextField(blank=True)

    origem = models.CharField(max_length=10, choices=ORIGENS, default=OUTRO)
    disparada_por = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='tarefas_disparadas',
        help_text='Só quando alguém apertou o botão no painel.')

    class Meta:
        db_table = 'execucoes_de_tarefa'
        ordering = ['-iniciada_em']
        indexes = [
            models.Index(fields=['tarefa', '-iniciada_em']),
            models.Index(fields=['-iniciada_em', 'sucesso']),
        ]

    def __str__(self):
        return f'{self.tarefa} em {self.iniciada_em:%d/%m %H:%M}'
