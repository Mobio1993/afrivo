from rest_framework.permissions import BasePermission

from apps.iam.services.permission_service import PermissionService
from apps.iam.services.token_service import resolve_api_user

METHOD_ACTIONS = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


class UserManagementPermission(BasePermission):
    message = "Vous n'avez pas les droits necessaires pour cette operation."

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            self.message = "Authentification requise."
            return False

        request.user = user

        if getattr(user, "is_super_root", False):
            return True

        action = METHOD_ACTIONS.get(request.method.upper(), "view")
        if getattr(user, "is_platform_admin", False) and action == "view":
            return True
        if request.method.upper() == "POST" and not PermissionService.can_perform_action(user, "users.change_role", strict=True):
            self.message = "Permission de gestion des roles utilisateurs insuffisante."
            return False
        if request.method.upper() in {"PUT", "PATCH"} and not PermissionService.can_perform_action(user, "users.change_role", strict=True):
            self.message = "Permission de modification utilisateur insuffisante."
            return False
        if request.method.upper() == "DELETE" and not PermissionService.can_perform_action(user, "users.deactivate", strict=True):
            self.message = "Permission de desactivation utilisateur insuffisante."
            return False
        if PermissionService.user_can_access(user, "users", action):
            return True

        self.message = "Permission utilisateurs insuffisante."
        return False

    def has_object_permission(self, request, view, obj):
        action = METHOD_ACTIONS.get(request.method.upper(), "view")
        if action == "view" and PermissionService.user_can_access(request.user, "users", action):
            return True
        if (
            action != "view"
            and PermissionService.user_can_access(request.user, "users", action)
            and PermissionService.can_manage_user(request.user, obj)
        ):
            return True

        self.message = "Vous ne pouvez pas gerer un compte de niveau egal ou superieur."
        return False
