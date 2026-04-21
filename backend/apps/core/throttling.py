# apps/core/throttling.py

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class BurstRateThrottle(UserRateThrottle):
    """Throttle para rajadas rápidas"""
    scope = 'burst'
    rate = '60/min'


class SustainedRateThrottle(UserRateThrottle):
    """Throttle para uso sustentado"""
    scope = 'sustained'
    rate = '1000/day'


class AnonBurstRateThrottle(AnonRateThrottle):
    """Throttle para usuários anônimos"""
    scope = 'anon_burst'
    rate = '20/min'


class PremiumUserRateThrottle(UserRateThrottle):
    """Throttle aumentado para usuários premium"""
    scope = 'premium'
    rate = '5000/day'
    
    def allow_request(self, request, view):
        # Premium users get higher limits
        if hasattr(request.user, 'is_premium') and request.user.is_premium:
            return super().allow_request(request, view)
        
        # Fall back to normal throttle
        return False


class ExpensiveOperationThrottle(UserRateThrottle):
    """Throttle para operações custosas (ML, downloads)"""
    scope = 'expensive'
    rate = '10/hour'