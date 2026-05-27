from rest_framework.permissions import BasePermission

from apps.iam.services.permission_service import PermissionService
from apps.iam.services.token_service import resolve_api_user
from apps.tenants.services.tenant_service import TenantService

POS_ROLES = {
    "manager_restaurant",
    "caissier",
    "serveur",
    "cuisinier",
    "barman",
    "comptable",
    "admin",
    "administrateur",
    "restaurant",
    "cashier",
    "manager",
}

MANAGER_POS_ROLES = {"manager_restaurant", "admin", "administrateur", "manager"}
CAISSE_POS_ROLES = {"caissier", "cashier", "manager_restaurant", "admin", "administrateur", "manager", "comptable"}


def get_user_role(user):
    profile = getattr(user, "profile", None)
    profile_role = getattr(profile, "role", "")
    return str(profile_role or getattr(user, "role", "") or getattr(user, "iam_role", "")).lower()


def get_user_pos_access_queryset(user):
    from .models import UserPosAccess

    if not user or not getattr(user, "is_authenticated", False) or not getattr(user, "pk", None):
        return UserPosAccess.objects.none()
    return UserPosAccess.objects.select_related("organization", "hotel", "restaurant").filter(user=user, is_active=True)


def get_first_active_pos_access(user):
    return get_user_pos_access_queryset(user).order_by("hotel__name", "restaurant__nom").first()


def attach_request_pos_hotel(request):
    TenantService.attach_request_tenant(request)
    hotel = TenantService.get_request_hotel(request)
    user = getattr(request, "user", None)
    if hotel is None and user and getattr(user, "is_authenticated", False) and not TenantService.is_platform_scope_user(user):
        access = get_first_active_pos_access(user)
        if access:
            request.active_hotel = access.hotel
            request.hotel = access.hotel
            request.organization = access.organization
            request.tenant_is_valid = True
            request.tenant_error = ""
            request.pos_access = access
            return access.hotel
    return hotel


def user_has_active_pos_access(user, hotel=None, restaurant=None):
    from django.db.models import Q

    if TenantService.is_platform_scope_user(user):
        return True
    queryset = get_user_pos_access_queryset(user)
    if hotel is not None:
        queryset = queryset.filter(hotel=hotel)
    if restaurant is not None:
        queryset = queryset.filter(Q(restaurant=restaurant) | Q(restaurant__isnull=True))
    return queryset.exists()


def get_effective_pos_role(user, request=None):
    access = getattr(request, "pos_access", None) if request is not None else None
    if access:
        return access.pos_role
    access = get_first_active_pos_access(user)
    if access:
        return access.pos_role
    return get_user_role(user)


def can_use_pos_scope(actor, hotel=None, restaurant=None):
    if not actor or not getattr(actor, "is_authenticated", False):
        return False
    if TenantService.is_platform_scope_user(actor):
        return True
    if restaurant is not None:
        hotel = restaurant.hotel
    if hotel is None:
        return False
    if TenantService.user_can_access_hotel(actor, hotel):
        return True
    return user_has_active_pos_access(actor, hotel=hotel, restaurant=restaurant)


def can_manage_pos_access(actor, target_user, hotel=None, restaurant=None):
    if not actor or not target_user:
        return False
    if not PermissionService.can_manage_user(actor, target_user):
        return False
    return can_use_pos_scope(actor, hotel=hotel, restaurant=restaurant)


class HasPosAccess(BasePermission):
    message = "Acces POS Restaurant non autorise."

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            return False
        request.user = user
        hotel = attach_request_pos_hotel(request)
        if TenantService.is_platform_scope_user(user):
            return True
        if user_has_active_pos_access(user, hotel=hotel):
            return True
        if not TenantService.user_has_valid_tenant(user):
            self.message = "Tenant utilisateur invalide ou incoherent."
            return False
        role = get_user_role(user)
        return bool(user.is_staff or user.is_superuser or role in POS_ROLES)


class IsManager(HasPosAccess):
    message = "Acces manager POS requis."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        role = get_effective_pos_role(request.user, request)
        return bool(request.user.is_staff or request.user.is_superuser or role in MANAGER_POS_ROLES)


class IsCaissier(HasPosAccess):
    message = "Acces caisse POS requis."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        role = get_effective_pos_role(request.user, request)
        return bool(request.user.is_staff or request.user.is_superuser or role in CAISSE_POS_ROLES)


class CanManagePosAccess(BasePermission):
    message = "Gestion des acces POS non autorisee."

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            return False
        request.user = user
        if TenantService.is_platform_scope_user(user):
            return True
        role = get_effective_pos_role(user, request)
        return bool(user.is_staff or user.is_superuser or role in MANAGER_POS_ROLES)
