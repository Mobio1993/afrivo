from django.conf import settings

from apps.licensing.services.module_license_service import ModuleLicenseService
from apps.licensing.services.subscription_service import SubscriptionService
from apps.platform_admin.models import PlatformModule


MODULE_LICENSE_CODE_CANDIDATES = {
    "billing": ("billing", "billing-plus"),
    "clients": ("clients", "clients-premium"),
    "guests": ("clients", "clients-premium"),
    "day_use": ("day-use", "day_use", "dayuse"),
    "day-use": ("day-use", "day_use", "dayuse"),
    "dayuse": ("day-use", "day_use", "dayuse"),
    "reservations": ("reservations", "bookings"),
    "bookings": ("reservations", "bookings"),
}


class LicensingAccessService:
    """Runtime licensing facade used by tenancy/core guards."""

    @staticmethod
    def get_module_license_codes(module_key):
        if not module_key:
            return ()
        normalized = str(module_key).strip().lower()
        return MODULE_LICENSE_CODE_CANDIDATES.get(normalized, (normalized,))

    @staticmethod
    def module_license_is_active(module_key, *, hotel=None, organization=None):
        codes = LicensingAccessService.get_module_license_codes(module_key)
        if not codes:
            return True
        if hotel is not None:
            if not getattr(hotel, "is_active", True):
                return False
            hotel_org = getattr(hotel, "organization", None)
            if hotel_org is not None and not getattr(hotel_org, "is_active", True):
                return False
        if organization is not None and not getattr(organization, "is_active", True):
            return False

        try:
            configured_codes = set(PlatformModule.objects.filter(code__in=codes).values_list("code", flat=True))
        except Exception:
            return True

        if not configured_codes:
            return True

        if hotel is not None:
            return any(
                ModuleLicenseService.access_allowed(module_code=code, hotel_id=hotel.id)
                for code in configured_codes
            )

        if organization is not None:
            return any(
                ModuleLicenseService.access_allowed(module_code=code, organization_id=organization.id)
                for code in configured_codes
            )

        return False

    @staticmethod
    def hotel_subscription_is_active(hotel):
        if not getattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", False):
            return True
        try:
            return SubscriptionService.hotel_subscription_is_active(hotel)
        except Exception:
            return True


get_module_license_codes = LicensingAccessService.get_module_license_codes
module_license_is_active = LicensingAccessService.module_license_is_active
hotel_subscription_is_active = LicensingAccessService.hotel_subscription_is_active
