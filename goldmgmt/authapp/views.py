from django.contrib.auth import authenticate
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import LoginSerializer, RegisterSerializer


class RegisterAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token_data = TokenObtainPairSerializer.get_token(user)
        return Response(
            {
                'message': 'User registered successfully',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                },
                'tokens': {
                    'access': str(token_data.access_token),
                    'refresh': str(token_data),
                },
                'redirect_to': '/mgmt',
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )

        if not user:
            return Response(
                {'detail': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token_data = TokenObtainPairSerializer.get_token(user)
        return Response(
            {
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                },
                'tokens': {
                    'access': str(token_data.access_token),
                    'refresh': str(token_data),
                },
                'redirect_to': '/mgmt',
            }
        )


class ProfileAPIView(APIView):
    def get(self, request):
        return Response(
            {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
            }
        )


class RefreshTokenAPIView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
