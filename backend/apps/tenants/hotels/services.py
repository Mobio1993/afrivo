from apps.tenancy.models import Hotel, HotelSettings
from apps.tenancy.services import get_or_create_default_tenancy


class HotelService:
    """Hotel facade backed by apps.tenancy.Hotel."""

    @staticmethod
    def queryset():
        return Hotel.objects.select_related("organization").all()

    @staticmethod
    def active_queryset():
        return Hotel.objects.select_related("organization").filter(is_active=True, organization__is_active=True)

    @staticmethod
    def get_by_id(hotel_id):
        if not hotel_id:
            return None
        return HotelService.queryset().filter(pk=hotel_id).first()

    @staticmethod
    def get_by_code(code, *, organization=None):
        value = (code or "").strip()
        if not value:
            return None
        queryset = HotelService.queryset().filter(code__iexact=value)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.first()

    @staticmethod
    def get_settings(hotel):
        if hotel is None:
            return None
        settings, _ = HotelSettings.objects.get_or_create(
            hotel=hotel,
            defaults={
                "hotel_name_display": hotel.name,
                "currency": hotel.currency,
                "timezone": hotel.timezone,
            },
        )
        return settings

    @staticmethod
    def is_active(hotel):
        organization = getattr(hotel, "organization", None) if hotel is not None else None
        return bool(
            hotel
            and getattr(hotel, "is_active", True)
            and organization
            and getattr(organization, "is_active", True)
        )

    @staticmethod
    def belongs_to_organization(hotel, organization):
        if hotel is None or organization is None:
            return False
        return getattr(hotel, "organization_id", None) == getattr(organization, "id", None)

    @staticmethod
    def accessible_by_user(user, *, active_only=True):
        from apps.tenants.services.tenant_service import TenantService

        return TenantService.get_accessible_hotels(user, active_only=active_only)

    @staticmethod
    def get_or_create_default():
        return get_or_create_default_tenancy()


get_hotel = HotelService.get_by_id
get_active_hotels = HotelService.active_queryset
get_hotel_settings = HotelService.get_settings
