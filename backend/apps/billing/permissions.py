from apps.tenancy.drf import AuthenticatedHotelPermission


class BillingPermission(AuthenticatedHotelPermission):
    def get_permission_module(self, view):
        return getattr(view, "permission_module", "billing")
