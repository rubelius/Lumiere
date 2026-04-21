from django.contrib.auth import get_user_model
from django.shortcuts import render
# Create your views here.
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import (UserRegistrationSerializer, UserSerializer,
                          UserTasteProfileSerializer)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet para usuários"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer
    
    def get_queryset(self):
        """Usuário só pode ver/editar próprio perfil"""
        if self.request.user.is_staff:
            return super().get_queryset()
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Retorna usuário atual"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def taste_profile(self, request):
        """Retorna perfil de gosto do usuário"""
        try:
            profile = request.user.taste_profile
            serializer = UserTasteProfileSerializer(profile)
            return Response(serializer.data)
        except:
            return Response(
                {'message': 'No taste profile yet. Sync Letterboxd first.'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'])
    def connect_letterboxd(self, request):
        """
        Conecta conta Letterboxd
        
        Body: {"username": "letterboxd_username"}
        """
        username = request.data.get('username')
        
        if not username:
            return Response(
                {'error': 'username is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        user.letterboxd_username = username
        user.letterboxd_connected = True
        user.save()
        
        # TODO: Trigger sync task
        # from apps.tasks.integrations import sync_letterboxd
        # sync_letterboxd.delay(str(user.id))
        
        return Response({
            'message': 'Letterboxd connected. Sync started.',
            'username': username
        })