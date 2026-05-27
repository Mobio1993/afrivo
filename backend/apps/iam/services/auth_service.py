from django.contrib.auth import authenticate
from django.db.models import Q

from apps.users.jwt_auth import build_auth_response_payload, resolve_api_user
from apps.users.models import User


class AuthService:
    """Authentication facade backed by the current users app."""

    @staticmethod
    def resolve_request_user(request, *, allow_session_fallback=True):
        return resolve_api_user(request, allow_session_fallback=allow_session_fallback)

    @staticmethod
    def get_user_by_identifier(identifier):
        value = (identifier or "").strip()
        if not value:
            return None
        return User.objects.filter(Q(username__iexact=value) | Q(email__iexact=value)).first()

    @staticmethod
    def authenticate_credentials(request, *, identifier, password):
        matched_user = AuthService.get_user_by_identifier(identifier)
        username = matched_user.username if matched_user else (identifier or "").strip()
        if not username or not password:
            return None
        return authenticate(request, username=username, password=password)

    @staticmethod
    def serialize_auth_payload(user):
        return build_auth_response_payload(user)


resolve_request_user = AuthService.resolve_request_user
authenticate_credentials = AuthService.authenticate_credentials
serialize_auth_payload = AuthService.serialize_auth_payload

