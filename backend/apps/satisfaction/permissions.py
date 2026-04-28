from django.conf import settings
from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.tenancy.drf import AuthenticatedHotelPermission
from apps.tenancy.utils import attach_request_hotel
from apps.users.jwt_auth import resolve_api_user
from apps.users.models import User


class IsClientApp(BasePermission):
    message = "Acces application client refuse."

    def has_permission(self, request, view):
        api_key = request.headers.get("X-Client-App-Key", "").strip()
        expected = getattr(settings, "SATISFACTION_CLIENT_APP_KEY", "").strip()
        return bool(expected) and api_key == expected


class ReadOnlyAdmin(BasePermission):
    message = "Acces admin en lecture seule requis."

    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return False

        user = resolve_api_user(request)
        if user is None:
            return False

        request.user = user
        attach_request_hotel(request)
        return user.role in {User.Role.ADMIN, User.Role.RECEPTION}


class ReadOnlyHotelAdmin(AuthenticatedHotelPermission):
    message = "Acces admin lecture seule avec hotel actif requis."
    hotel_scope_module = ""

    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return False
        module_key = getattr(view, "hotel_scope_module", self.hotel_scope_module)
        setattr(view, "hotel_scope_module", module_key)
        return super().has_permission(request, view) and request.user.role in {User.Role.ADMIN, User.Role.RECEPTION}
