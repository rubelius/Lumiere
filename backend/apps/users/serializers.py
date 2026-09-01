import re

from apps.ml.models import UserTasteProfile
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

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
            'date_joined'
        ]
        read_only_fields = ['id', 'date_joined', 'is_premium']
    
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

    jellyfin_connected = serializers.SerializerMethodField()
    plex_connected = serializers.SerializerMethodField()
    realdebrid_connected = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'jellyfin_server_url', 'jellyfin_user_id', 'jellyfin_token', 'jellyfin_connected',
            'plex_server_url', 'plex_token', 'plex_connected',
            'realdebrid_api_key', 'realdebrid_connected',
        ]
        extra_kwargs = {
            'jellyfin_token': {'write_only': True, 'required': False, 'allow_blank': True},
            'plex_token': {'write_only': True, 'required': False, 'allow_blank': True},
            'realdebrid_api_key': {'write_only': True, 'required': False, 'allow_blank': True},
        }

    @extend_schema_field(serializers.BooleanField())
    def get_jellyfin_connected(self, obj):
        return bool(obj.jellyfin_server_url and obj.jellyfin_token)

    @extend_schema_field(serializers.BooleanField())
    def get_plex_connected(self, obj):
        return bool(obj.plex_server_url and obj.plex_token)

    @extend_schema_field(serializers.BooleanField())
    def get_realdebrid_connected(self, obj):
        return bool(obj.realdebrid_api_key)
