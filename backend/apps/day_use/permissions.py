from rest_framework.permissions import BasePermission

from apps.iam.services.permission_service import PermissionService


class DayUsePermission(BasePermission):
    module = "operations"

    action_map = {
        "GET": "view",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    }

    def has_permission(self, request, view):
        return PermissionService.user_can_access(request.user, self.module, self.action_map.get(request.method, "view"))
