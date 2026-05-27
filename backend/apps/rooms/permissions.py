from rest_framework.permissions import SAFE_METHODS

from apps.iam.services.permission_service import PermissionService
from apps.tenancy.drf import AuthenticatedHotelPermission


class RoomInventoryPermission(AuthenticatedHotelPermission):
    message = "Vous n'avez pas les droits suffisants pour modifier l'inventaire des chambres."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return PermissionService.user_can_access(request.user, "rooms", "view")
        business_action = getattr(view, "business_action_map", {}).get(getattr(view, "action", ""))
        if business_action:
            return PermissionService.can_perform_action(request.user, business_action, strict=True)
        return PermissionService.user_can_access(request.user, "rooms", "manage")


class RoomOperationsPermission(AuthenticatedHotelPermission):
    message = "Vous n'avez pas les droits suffisants pour gerer ce flux chambres."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return PermissionService.user_can_access(request.user, "rooms", "view")
        business_action = getattr(view, "business_action_map", {}).get(getattr(view, "action", ""))
        if business_action:
            return PermissionService.can_perform_action(request.user, business_action, strict=True)
        return (
            PermissionService.user_can_access(request.user, "rooms", "update")
            or PermissionService.user_can_access(request.user, "operations", "update")
            or PermissionService.user_can_access(request.user, "operations", "manage")
        )
