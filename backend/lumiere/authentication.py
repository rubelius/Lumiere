from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Aceita o JWT pelo cabeçalho Authorization ou pelo cookie HttpOnly
    `access_token`, que é como os clientes web autenticam: o token é gravado
    pelo BFF em Next.js e nunca fica exposto ao JavaScript.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            # Pega do Cookie HttpOnly que criamos no Next.js
            raw_token = request.COOKIES.get('access_token') or None
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token


class CookieJWTScheme(OpenApiAuthenticationExtension):
    """
    Sem isto o drf-spectacular avisa que não sabe resolver o autenticador e
    gera o schema **sem nenhum esquema de segurança** — os clientes gerados a
    partir dele não sabem que a API exige credencial.
    """

    target_class = 'lumiere.authentication.CookieJWTAuthentication'
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': 'access_token',
            'description': (
                'JWT no cookie HttpOnly `access_token`, gravado por '
                '`POST /api/auth/login` no cliente Next.js. O cabeçalho '
                '`Authorization: Bearer <token>` também é aceito.'
            ),
        }
