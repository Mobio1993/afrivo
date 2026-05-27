from rest_framework.permissions import BasePermission

from apps.iam.services.auth_service import AuthService
from apps.iam.services.permission_service import PermissionService


METHOD_ACTIONS = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


class IsAuthenticatedApiUser(BasePermission):
    message = "Authentification requise."

    def has_permission(self, request, view):
        user = AuthService.resolve_request_user(request)
        if user is None:
            return False
        request.user = user
        return True


class HasModulePermission(BasePermission):
    """Generic module permission class.

    Views can set `iam_module = "users"` and optionally `iam_action = "view"`.
    """

    message = "Permission insuffisante."

    def has_permission(self, request, view):
        user = AuthService.resolve_request_user(request)
        if user is None:
            self.message = "Authentification requise."
            return False
        request.user = user
        module = getattr(view, "iam_module", None)
        if not module:
            self.message = "Module IAM non configure."
            return False
        action = getattr(view, "iam_action", None) or METHOD_ACTIONS.get(request.method.upper(), "view")
        allowed = PermissionService.user_can_access(user, module, action)
        if not allowed:
            self.message = "Vous n'avez pas les droits suffisants pour acceder a ce module."
        return allowed


class CanManageUsers(BasePermission):
    message = "Permission utilisateurs insuffisante."

    def has_permission(self, request, view):
        user = AuthService.resolve_request_user(request)
        if user is None:
            self.message = "Authentification requise."
            return False
        request.user = user
        action = METHOD_ACTIONS.get(request.method.upper(), "view")
        return PermissionService.user_can_access(user, "users", action)

    def has_object_permission(self, request, view, obj):
        action = METHOD_ACTIONS.get(request.method.upper(), "view")
        if action == "view":
            return PermissionService.user_can_access(request.user, "users", "view")
        return PermissionService.can_manage_user(request.user, obj)

