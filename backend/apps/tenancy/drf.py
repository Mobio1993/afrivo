from rest_framework.permissions import SAFE_METHODS
from rest_framework.permissions import BasePermission

from apps.iam.services.permission_service import MODULES, can_perform_action, user_can_access
from apps.iam.services.token_service import resolve_api_user
from apps.licensing.services.access_service import hotel_subscription_is_active, module_license_is_active
from apps.tenants.services.tenant_service import TenantService


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

    def get_business_action(self, request, view):
        action_map = getattr(view, "business_action_map", {}) or {}
        view_action = getattr(view, "action", "")
        if view_action and view_action in action_map:
            return action_map[view_action]
        method_map = getattr(view, "business_method_action_map", {}) or {}
        return method_map.get(request.method.upper())

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            return False
        request.user = user
        TenantService.attach_request_tenant(request)
        if not TenantService.is_platform_scope_user(user) and not TenantService.user_has_valid_tenant(user):
            self.message = "Tenant utilisateur invalide ou incoherent."
            return False
        module_key = getattr(view, "hotel_scope_module", "")
        platform_without_hotel_allowed = bool(
            getattr(view, "allow_platform_without_hotel", False) and TenantService.is_platform_scope_user(user)
        )
        if (
            TenantService.is_hotel_scope_strict(module_key)
            and getattr(request, "active_hotel", None) is None
            and not platform_without_hotel_allowed
        ):
            self.message = "Un hotel actif est requis pour acceder a ce module."
            return False
        active_hotel = getattr(request, "active_hotel", None)
        if active_hotel is not None and not hotel_subscription_is_active(active_hotel):
            if not getattr(user, "is_staff", False):
                self.message = "L'abonnement de cet hotel est suspendu ou expire."
                return False
        permission_module = self.get_permission_module(view)
        if not permission_module or permission_module not in MODULES:
            return True
        organization = getattr(user, "organization", None)
        if (
            not platform_without_hotel_allowed
            and not module_license_is_active(permission_module, hotel=active_hotel, organization=organization)
        ):
            self.message = "Ce module n'est pas actif ou sa licence est invalide."
            return False
        permission_action = self.get_permission_action(request, view)
        if user_can_access(request.user, permission_module, permission_action):
            business_action = self.get_business_action(request, view)
            if business_action and not can_perform_action(request.user, business_action, strict=True):
                self.message = "Permission metier insuffisante pour cette action."
                return False
            return True
        self.message = "Vous n'avez pas les droits suffisants pour acceder a ce module."
        return False


class HotelScopedQuerysetMixin:
    hotel_field_name = "hotel"
    hotel_scope_module = ""

    def scope_queryset(self, queryset):
        return TenantService.scope_queryset_to_hotel(queryset, self.request, field_name=self.hotel_field_name)
