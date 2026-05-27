from apps.licensing.services.access_service import LicensingAccessService
from apps.licensing.services.module_license_service import ModuleLicenseService
from apps.licensing.services.subscription_service import SubscriptionService


class LicenseService:
    """Unified licensing facade for new code."""

    module_allowed = staticmethod(ModuleLicenseService.access_allowed)
    module_license_is_active = staticmethod(LicensingAccessService.module_license_is_active)
    hotel_subscription_is_active = staticmethod(LicensingAccessService.hotel_subscription_is_active)
    renew_license = staticmethod(ModuleLicenseService.renew)
    suspend_license = staticmethod(ModuleLicenseService.suspend)
    renew_subscription = staticmethod(SubscriptionService.renew)
    change_subscription_plan = staticmethod(SubscriptionService.change_plan)
    process_subscription_lifecycle = staticmethod(SubscriptionService.process_lifecycle)
    user_quota_usage = staticmethod(SubscriptionService.user_quota_usage)


module_allowed = LicenseService.module_allowed
module_license_is_active = LicenseService.module_license_is_active
hotel_subscription_is_active = LicenseService.hotel_subscription_is_active
