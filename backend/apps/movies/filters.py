"""
Filtros customizados para Movies (Integração Total com o Painel Frontend)
"""

import django_filters
from django.db.models import Q
from .models import Movie, TorrentRelease

class MovieFilter(django_filters.FilterSet):
    # ── Parâmetros Especiais (Strings separadas por vírgula) ──
    category = django_filters.CharFilter(method='filter_category')
    genres = django_filters.CharFilter(method='filter_genres')
    decades = django_filters.CharFilter(method='filter_decades')
    qualities = django_filters.CharFilter(method='filter_qualities')
    curations = django_filters.CharFilter(method='filter_curations')
    
    # Busca legada (mantida por segurança)
    search = django_filters.CharFilter(field_name='title', lookup_expr='icontains')

    class Meta:
        model = Movie
        fields = ['year', 'country', 'in_plex', 'available_instantly', 'director']

    # 1. CATEGORIAS EDITORIAIS (Abas Principais)
    def filter_category(self, queryset, name, value):
        if value == "Longas-Metragem":
            # Consideramos longas a partir de 60 minutos (ou 40, dependendo da sua regra de negócio)
            return queryset.filter(length_minutes__gte=60)
            
        elif value == "Curtas-Metragem":
            # Menores que 60 minutos e que tenham a duração preenchida
            return queryset.filter(length_minutes__lt=60, length_minutes__isnull=False)
            
        elif value == "Ganhadores de Festivais":
            # O Wikidata salva como "2003 | Vencedor" ou "Winner". Isso exclui quem só foi "Indicado".
            return queryset.filter(Q(festivals__icontains='Vencedor') | Q(festivals__icontains='Winner'))
            
        elif value == "Nacionais":
            # Pega variações do nome do nosso país no TMDB
            return queryset.filter(Q(country__icontains='Brasil') | Q(country__icontains='Brazil'))
            
        # O "Acervo Completo" cai aqui no final e retorna tudo sem filtrar
        return queryset

    # 2. GÊNEROS (Usando Overlap nativo do PostgreSQL para Arrays)
    def filter_genres(self, queryset, name, value):
        genres_list = [g.strip() for g in value.split(',')]
        # __overlap retorna True se QUALQUER item da lista bater com o array do filme
        return queryset.filter(genres__overlap=genres_list)

    # 3. DÉCADAS (Múltiplas décadas somadas via OR)
    def filter_decades(self, queryset, name, value):
        decades_list = [d.strip() for d in value.split(',')]
        q_objects = Q()
        for decade in decades_list:
            if decade == "2020s": q_objects |= Q(year__gte=2020, year__lte=2029)
            elif decade == "2010s": q_objects |= Q(year__gte=2010, year__lte=2019)
            elif decade == "2000s": q_objects |= Q(year__gte=2000, year__lte=2009)
            elif decade == "1990s": q_objects |= Q(year__gte=1990, year__lte=1999)
            elif decade == "1980s": q_objects |= Q(year__gte=1980, year__lte=1989)
            elif decade == "1970s": q_objects |= Q(year__gte=1970, year__lte=1979)
            elif "Pré-70" in decade: q_objects |= Q(year__lt=1970)
        return queryset.filter(q_objects)

    # 4. QUALIDADES (Lógica "AND" estrita na MESMA release)
    def filter_qualities(self, queryset, name, value):
        qualities_list = [q.strip() for q in value.split(',')]
        
        # Usamos um Q vazio para ir adicionando as regras estritas com AND (&)
        release_q = Q()
        
        for q_val in qualities_list:
            if q_val == "4K":
                release_q &= (Q(torrent_releases__resolution__icontains='2160p') | Q(torrent_releases__is_4k=True))
            elif q_val == "REMUX":
                release_q &= Q(torrent_releases__is_remux=True)
            elif q_val == "HDR":
                release_q &= Q(torrent_releases__has_hdr=True)
            elif q_val == "Dolby Vision":
                release_q &= Q(torrent_releases__has_dolby_vision=True)
            elif q_val == "Dolby Atmos":
                release_q &= Q(torrent_releases__has_atmos=True)
            elif q_val == "WEB-DL":
                release_q &= Q(torrent_releases__release_type__icontains='WEB')
        
        # Aplicamos o pacotão de regras de uma vez só! 
        # Isso garante que a MESMA release tenha todas as especificações selecionadas.
        if release_q:
            return queryset.filter(release_q).distinct()
            
        return queryset

    # 5. CURADORIA (Navegando nos dados ricos e usando as Keywords como Backup)
    def filter_curations(self, queryset, name, value):
        curations_list = [c.strip() for c in value.split(',')]
        q_objects = Q() # Cria um cesto vazio para jogar as regras
        
        for curation in curations_list:
            if curation == "MUBI":
                # Adicionamos a busca em streaming_providers!
                q_objects |= (
                    (Q(mubi_id__isnull=False) & ~Q(mubi_id='')) |
                    Q(keywords__icontains='mubi') |
                    Q(streaming_providers__icontains='mubi')
                )
                
            elif "Oscar" in curation:
                q_objects |= Q(festivals__icontains='Academy Award') | Q(festivals__icontains='Oscar')
                
            elif "Cannes" in curation:
                q_objects |= Q(festivals__icontains='Cannes')
                
            elif "Bechdel" in curation:
                q_objects |= Q(bechdel_status__icontains='pass') | Q(keywords__icontains='bechdel')
                
            elif "Criterion" in curation:
                q_objects |= Q(collection_name__icontains='Criterion') | Q(production_companies__icontains='Criterion') | Q(keywords__icontains='criterion')
                
            elif curation == "Disponível Imediatamente":
                q_objects |= Q(in_plex=True) | Q(available_instantly=True)
                
        # Se o cesto tiver alguma regra, aplica tudo usando OR e não duplica os filmes
        if q_objects:
            return queryset.filter(q_objects).distinct()
            
        return queryset


class TorrentReleaseFilter(django_filters.FilterSet):
    # ... (Mantenha o seu TorrentReleaseFilter idêntico como estava) ...
    resolution = django_filters.CharFilter(lookup_expr='icontains')
    quality_score_min = django_filters.NumberFilter(field_name='quality_score', lookup_expr='gte')
    
    class Meta:
        model = TorrentRelease
        fields = {
            'resolution': ['exact', 'icontains'],
            'is_remux': ['exact'],
            'has_atmos': ['exact'],
            'has_dolby_vision': ['exact'],
            'instantly_available': ['exact'],
        }