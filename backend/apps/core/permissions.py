from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permissão customizada para permitir apenas donos editarem
    """
    
    def has_object_permission(self, request, view, obj):
        # Read permissions para qualquer request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions apenas para o dono
        return obj.user == request.user


class IsOwner(permissions.BasePermission):
    """
    Permissão para permitir acesso apenas ao dono
    """
    
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class IsPremiumUser(permissions.BasePermission):
    """
    Permissão para recursos premium
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_premium