from rest_framework.permissions import BasePermission

from apps.users.access import user_can_access


class IsPlatformAdmin(BasePermission):
    message = "Seul un administrateur plateforme peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_platform_admin", False))


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
        return user_can_access(user, module, action)
