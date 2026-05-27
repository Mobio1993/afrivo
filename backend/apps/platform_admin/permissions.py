from rest_framework.permissions import BasePermission

from apps.iam.services.permission_service import PermissionService


class IsPlatformAdmin(BasePermission):
    message = "Seul un administrateur plateforme peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_platform_admin", False))


class IsSuperAdminPlatform(BasePermission):
    message = "Seul un Super Admin Plateforme peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_super_admin_platform", False))


class IsOrganizationAdmin(BasePermission):
    message = "Seul un Admin Organisation peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_organization_admin", False))


class IsHotelAdmin(BasePermission):
    message = "Seul un Admin Hotel peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_hotel_admin", False))


class IsSuperRoot(BasePermission):
    message = "Seul le Super Root technique peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_super_root", False))


class PlatformModulePermission(BasePermission):
    message = "Votre compte plateforme ne dispose pas de cette permission."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_platform_admin", False):
            return False

        module = getattr(view, "platform_permission_module", "")
        action = getattr(view, "platform_permission_action", "view")
        if not module:
            return True
        return PermissionService.user_can_access(user, module, action)
