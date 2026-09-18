import re

from apps.ml.models import UserTasteProfile
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from apps.users.verifica_biblioteca import estado

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer básico de usuário"""
    taste_profile_exists = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'display_name',
            'avatar_url', 'bio', 'is_premium', 'premium_until',
            'letterboxd_username', 'letterboxd_connected',
            'plex_server_url', 'taste_profile_exists',
            # QUEM É ADMIN, porque a tela não tinha como saber. Sem isto o
            # cliente não pode esconder o que o backend vai recusar nem
            # oferecer o que ele vai permitir.
            'is_staff', 'is_superuser',
            'date_joined'
        ]
        # Somente leitura, e isto NÃO é detalhe: sem a linha, um PATCH em
        # /api/users/me/ com {"is_superuser": true} promoveria a própria
        # conta.
        read_only_fields = ['id', 'date_joined', 'is_premium',
                            'is_staff', 'is_superuser']
    
    @extend_schema_field(serializers.BooleanField())
    def get_taste_profile_exists(self, obj):
        return hasattr(obj, 'taste_profile')


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer para registro de novo usuário"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'display_name'
        ]
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match'
            })
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserTasteProfileSerializer(serializers.ModelSerializer):
    """Serializer para perfil de gosto do usuário"""
    
    class Meta:
        model = UserTasteProfile
        exclude = ['embedding']  # Não expor embedding na API
        read_only_fields = [
            'id', 'user', 'embedding_model', 'trained_at',
            'training_samples', 'profile_confidence'
        ]


# Servidor de mídia caseiro raramente tem domínio: costuma ser IP de rede
# local, nome de serviço Docker ("http://jellyfin:8096") ou hostname mDNS. O
# URLField do Django recusa host sem TLD, então validamos com regra própria.
_URL_DE_SERVIDOR = re.compile(r'^https?://[^\s/:?#]+(?::\d+)?(?:/[^\s?#]*)?$')


def valida_url_de_servidor(valor):
    if valor and not _URL_DE_SERVIDOR.match(valor):
        raise serializers.ValidationError(
            'Informe uma URL como http://192.168.1.100:8096 ou http://jellyfin:8096.'
        )
    return valor


class IntegrationSettingsSerializer(serializers.ModelSerializer):
    """
    Credenciais das fontes de reprodução.

    Os tokens são write-only por princípio: uma vez gravados, a API informa
    apenas SE existem, nunca o valor. Assim uma tela de configuração, um log de
    resposta ou um cache de navegador nunca carregam o segredo de volta.
    """

    jellyfin_server_url = serializers.CharField(
        required=False, allow_blank=True, validators=[valida_url_de_servidor]
    )
    plex_server_url = serializers.CharField(
        required=False, allow_blank=True, validators=[valida_url_de_servidor]
    )

    # Zero é ilimitado, e é a única forma de dizer "não apague nada". Um teto
    # generoso evita que um dedo escorregado no formulário peça 900 TB.
    torrent_cache_bytes = serializers.IntegerField(
        required=False, min_value=0, max_value=2 * 1024 ** 4,
        help_text=('Bytes que o cache de torrent pode ocupar. 0 = ilimitado: '
                   'baixa o filme inteiro e não apaga nada.'),
    )

    jellyfin_connected = serializers.SerializerMethodField()
    plex_connected = serializers.SerializerMethodField()
    jellyfin_estado = serializers.SerializerMethodField()
    plex_estado = serializers.SerializerMethodField()
    realdebrid_connected = serializers.SerializerMethodField()
    opensubtitles_connected = serializers.SerializerMethodField()
    opensubtitles_pode_baixar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'jellyfin_server_url', 'jellyfin_user_id', 'jellyfin_token', 'jellyfin_connected',
            'plex_server_url', 'plex_token', 'plex_connected',
            'realdebrid_api_key', 'realdebrid_connected',
            'opensubtitles_api_key', 'opensubtitles_username',
            'opensubtitles_connected', 'opensubtitles_pode_baixar',
            # Não são credenciais, mas moram na mesma tela e no mesmo usuário.
            'jellyfin_estado', 'plex_estado',
            'jellyfin_verificado_em', 'plex_verificado_em',
            'torrent_direto_permitido', 'torrent_cache_bytes',
        ]
        extra_kwargs = {
            'jellyfin_token': {'write_only': True, 'required': False, 'allow_blank': True},
            'plex_token': {'write_only': True, 'required': False, 'allow_blank': True},
            'realdebrid_api_key': {'write_only': True, 'required': False, 'allow_blank': True},
            'opensubtitles_api_key': {'write_only': True, 'required': False, 'allow_blank': True},
        }

    @extend_schema_field(serializers.BooleanField())
    def get_jellyfin_connected(self, obj):
        """
        Há credencial gravada. NÃO quer dizer que o servidor responde — para
        isso existe `jellyfin_estado`.

        O nome ficou, porque é contrato de API; o significado é o que sempre
        foi de fato. Quem desenha a tela deve usar o estado.
        """
        return bool(obj.jellyfin_server_url and obj.jellyfin_token)

    @extend_schema_field(serializers.BooleanField())
    def get_plex_connected(self, obj):
        return bool(obj.plex_server_url and obj.plex_token)

    @extend_schema_field(serializers.CharField())
    def get_jellyfin_estado(self, obj):
        return estado(self.get_jellyfin_connected(obj), obj.jellyfin_verificado_em)

    @extend_schema_field(serializers.CharField())
    def get_plex_estado(self, obj):
        return estado(self.get_plex_connected(obj), obj.plex_verificado_em)

    @extend_schema_field(serializers.BooleanField())
    def get_realdebrid_connected(self, obj):
        # A cadeia de reprodução cai para a chave global quando o usuário não
        # tem a própria; informar só a do usuário faria a tela dizer
        # "não configurado" enquanto o Real-Debrid resolve normalmente.
        from django.conf import settings
        return bool(obj.realdebrid_api_key or settings.REAL_DEBRID_API_KEY)

    @extend_schema_field(serializers.BooleanField())
    def get_opensubtitles_connected(self, obj):
        """Chave da aplicação: já permite BUSCAR legendas."""
        return bool(obj.opensubtitles_api_key)

    @extend_schema_field(serializers.BooleanField())
    def get_opensubtitles_pode_baixar(self, obj):
        """Baixar consome a cota da conta, então exige também o token do login."""
        return bool(obj.opensubtitles_api_key and obj.opensubtitles_token)
