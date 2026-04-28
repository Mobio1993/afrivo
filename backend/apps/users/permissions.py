from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.users.access import user_can_access
from apps.users.jwt_auth import resolve_api_user


class UserManagementPermission(BasePermission):
    message = "Vous n'avez pas les droits necessaires pour cette operation."

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            self.message = "Authentification requise."
            return False

        request.user = user

        if request.method in SAFE_METHODS:
            return True
        return user_can_access(user, "users", "manage")

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return (
                user_can_access(request.user, "users", "view")
                or obj.pk == request.user.pk
            )
        return user_can_access(request.user, "users", "manage")
