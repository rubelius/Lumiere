# apps/core/pagination.py

from rest_framework.pagination import CursorPagination


class OptimizedCursorPagination(CursorPagination):
    """
    Cursor pagination - mais eficiente que offset
    
    Melhor para grandes datasets
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    ordering = '-created_at'