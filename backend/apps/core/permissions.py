from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permissão customizada para permitir apenas donos editarem
    """
    
    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore
        # Read permissions para qualquer request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions apenas para o dono
        return obj.user == request.user


class IsOwner(permissions.BasePermission):
    """
    Permissão para permitir acesso apenas ao dono
    """
    
    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore
        return obj.user == request.user


class IsPremiumUser(permissions.BasePermission):
    """
    Permissão para recursos premium
    """
    
    def has_permission(self, request, view) -> bool:  # type: ignore
        # SECURITY #3: Proteção contra AttributeError usando getattr com fallback seguro
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'is_premium', False)
        )