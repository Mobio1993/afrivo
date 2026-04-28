from rest_framework.permissions import SAFE_METHODS

from apps.tenancy.drf import AuthenticatedHotelPermission
from apps.users.access import user_can_access


class RoomInventoryPermission(AuthenticatedHotelPermission):
    message = "Vous n'avez pas les droits suffisants pour modifier l'inventaire des chambres."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return user_can_access(request.user, "rooms", "view")
        return user_can_access(request.user, "rooms", "manage")


class RoomOperationsPermission(AuthenticatedHotelPermission):
    message = "Vous n'avez pas les droits suffisants pour gerer ce flux chambres."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return user_can_access(request.user, "rooms", "view")
        return (
            user_can_access(request.user, "rooms", "update")
            or user_can_access(request.user, "operations", "update")
            or user_can_access(request.user, "operations", "manage")
        )
