from apps.ml.models import UserTasteProfile
from django.contrib.auth import get_user_model
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