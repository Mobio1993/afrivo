from rest_framework.permissions import BasePermission


class IsSuperRoot(BasePermission):
    message = "Seul le Super Root technique peut acceder a cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_super_root", False))
