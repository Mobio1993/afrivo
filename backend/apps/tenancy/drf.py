from rest_framework.permissions import SAFE_METHODS
from rest_framework.permissions import BasePermission

from apps.tenancy.utils import attach_request_hotel, hotel_subscription_is_active, is_hotel_scope_strict, scope_queryset_to_hotel
from apps.users.access import MODULES, user_can_access
from apps.users.jwt_auth import resolve_api_user


class AuthenticatedHotelPermission(BasePermission):
    message = "Un utilisateur authentifie est requis."
    permission_action_map = {}

    def get_permission_module(self, view):
        return getattr(view, "permission_module", getattr(view, "hotel_scope_module", ""))

    def get_permission_action(self, request, view):
        action_map = getattr(view, "permission_action_map", self.permission_action_map) or {}
        view_action = getattr(view, "action", "")
        if view_action and view_action in action_map:
            return action_map[view_action]
        if request.method in SAFE_METHODS:
            return "view"
        if request.method == "POST":
            return "create"
        if request.method in {"PUT", "PATCH"}:
            return "update"
        if request.method == "DELETE":
            return "delete"
        return "view"

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            return False
        request.user = user
        attach_request_hotel(request)
        module_key = getattr(view, "hotel_scope_module", "")
        if is_hotel_scope_strict(module_key):
            if getattr(request, "active_hotel", None) is None:
                return False
        active_hotel = getattr(request, "active_hotel", None)
        if active_hotel is not None and not hotel_subscription_is_active(active_hotel):
            if not getattr(user, "is_staff", False):
                self.message = "L'abonnement de cet hotel est suspendu ou expire."
                return False
        permission_module = self.get_permission_module(view)
        if not permission_module or permission_module not in MODULES:
            return True
        permission_action = self.get_permission_action(request, view)
        if user_can_access(request.user, permission_module, permission_action):
            return True
        self.message = "Vous n'avez pas les droits suffisants pour acceder a ce module."
        return False


class HotelScopedQuerysetMixin:
    hotel_field_name = "hotel"
    hotel_scope_module = ""

    def scope_queryset(self, queryset):
        return scope_queryset_to_hotel(queryset, self.request, field_name=self.hotel_field_name)
