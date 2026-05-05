from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, AuthenticationFailed, NotAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Unified error response format for all DRF exceptions.
    Ensures Content-Type: application/json on ALL error responses.
    """
    response = exception_handler(exc, context)

    if response is None:
        # Unhandled exception — would be a 500
        logger.exception(f"Unhandled exception in {context.get('view')}", exc_info=exc)
        return Response(
            {
                'error': {
                    'code': 'INTERNAL_SERVER_ERROR',
                    'message': 'An unexpected error occurred.',
                    'fields': None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content_type='application/json',
        )

    if isinstance(exc, ValidationError):
        return Response(
            {
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Invalid input.',
                    'fields': response.data,
                }
            },
            status=response.status_code,
            content_type='application/json',
        )

    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        return Response(
            {
                'error': {
                    'code': 'AUTHENTICATION_FAILED',
                    'message': str(exc.detail),
                    'fields': None,
                }
            },
            status=response.status_code,
            content_type='application/json',
        )

    # All other DRF exceptions (PermissionDenied, NotFound, etc.)
    detail = response.data.get('detail', str(response.data)) if response and hasattr(response, 'data') else str(exc)
    
    return Response(
        {
            'error': {
                'code': exc.__class__.__name__.upper(),
                'message': detail,
                'fields': None,
            }
        },
        status=response.status_code if response else 500,
        content_type='application/json',
    )