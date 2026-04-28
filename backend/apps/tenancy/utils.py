from django.conf import settings
from django.core.exceptions import FieldDoesNotExist


def get_user_hotel(user):
    hotel = getattr(user, "hotel", None)
    if hotel and getattr(hotel, "is_active", True):
        return hotel
    return None


def attach_request_hotel(request):
    request.active_hotel = get_user_hotel(getattr(request, "user", None))
    return request.active_hotel


def get_request_hotel(request):
    if hasattr(request, "active_hotel"):
        return request.active_hotel
    return attach_request_hotel(request)


def filter_for_active_hotel(queryset, hotel=None, field_name="hotel"):
    if hotel is None:
        return queryset
    try:
        queryset.model._meta.get_field(field_name)
    except FieldDoesNotExist:
        return queryset
    return queryset.filter(**{field_name: hotel})


def scope_queryset_to_hotel(queryset, request, field_name="hotel"):
    return filter_for_active_hotel(queryset, hotel=get_request_hotel(request), field_name=field_name)


def is_hotel_scope_strict(module_key):
    if not module_key:
        return False
    return bool(getattr(settings, "TENANCY_STRICT_MODULES", {}).get(module_key, False))


def hotel_subscription_is_active(hotel):
    """Returns True if the hotel has a valid subscription, or if enforcement is disabled.

    Lazy-imports HotelSubscription to avoid circular imports (platform_admin → tenancy).
    """
    if not getattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", False):
        return True
    try:
        from apps.platform_admin.models import HotelSubscription  # noqa: PLC0415
        sub = hotel.subscription
        return sub.status in {HotelSubscription.Status.ACTIVE, HotelSubscription.Status.TRIAL}
    except Exception:
        return True  # no subscription or access error — allow (dev/legacy hotels)
