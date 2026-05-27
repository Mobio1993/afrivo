from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.iam.services.permission_service import can_perform_action
from apps.iam.services.token_service import resolve_api_user
from apps.tenants.services.tenant_service import TenantService


class HotelSettingsPermission(BasePermission):
    message = "Vous n'avez pas les droits necessaires pour acceder aux parametres."
    manager_writable_fields = {
        "checkin_time",
        "checkout_time",
        "grace_period_minutes",
        "no_show_policy",
        "cancellation_policy",
        "deposit_required",
        "deposit_percentage",
        "invoice_prefix",
        "invoice_start_number",
        "tax_rate",
        "payment_methods",
        "allow_negative_balance",
        "require_payment_before_checkout",
    }

    def has_permission(self, request, view):
        user = resolve_api_user(request)
        if user is None:
            self.message = "Authentification requise."
            return False

        request.user = user
        TenantService.attach_request_tenant(request)

        if request.method in SAFE_METHODS:
            return getattr(request, "active_hotel", None) is not None or getattr(user, "is_platform_admin", False)

        if getattr(user, "is_platform_admin", False) or getattr(user, "is_hotel_admin", False):
            return can_perform_action(user, "settings.update_hotel", strict=True)

        if getattr(user, "role", "") == "manager":
            requested_fields = set(getattr(request, "data", {}).keys())
            if requested_fields and requested_fields.issubset(self.manager_writable_fields) and can_perform_action(
                user,
                "settings.update_hotel",
                strict=True,
            ):
                return True
            self.message = "Le manager peut modifier uniquement les parametres reservations et facturation."
            return False

        self.message = "Seul l'administrateur de l'hotel peut modifier les parametres."
        return False
