from django.contrib import admin
from .models import RawIngestion

@admin.register(RawIngestion)
class RawIngestionAdmin(admin.ModelAdmin):
    list_display = ('source_name', 'get_title', 'status', 'created_at')
    list_filter = ('status', 'source_name', 'created_at')
    search_fields = ('source_id', 'raw_data__Title') # Permite buscar pelo título dentro do JSON!
    readonly_fields = ('created_at', 'updated_at')
    
    def get_title(self, obj):
        if isinstance(obj.raw_data, dict):
            return obj.raw_data.get('Title', 'N/A')
        return 'N/A'
    get_title.short_description = 'Título Original'