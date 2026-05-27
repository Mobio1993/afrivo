from apps.tenancy.drf import AuthenticatedHotelPermission, HotelScopedQuerysetMixin
from apps.tenancy.permissions import HotelSettingsPermission

__all__ = ["AuthenticatedHotelPermission", "HotelScopedQuerysetMixin", "HotelSettingsPermission"]

