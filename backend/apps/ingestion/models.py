from django.db import models

class RawIngestion(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pendente'),
        ('PROCESSING', 'Processando'),
        ('COMPLETED', 'Concluído'),
        ('FAILED', 'Falhou'),
        ('NON_FILM', 'Ignorado (Não-Filme)'), 
    ]

    source_name = models.CharField(max_length=50, default='TSPDT')
    source_id = models.CharField(max_length=100, unique=True, db_index=True) 
    
    raw_data = models.JSONField(help_text="Dados brutos da fonte")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    error_log = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Raw Ingestion"
        verbose_name_plural = "Raw Ingestions"
        ordering = ['-created_at']

    def __str__(self):
        title = self.raw_data.get('Title', 'Unknown') if isinstance(self.raw_data, dict) else 'Invalid Data'
        return f"[{self.status}] {self.source_name} - {title}"