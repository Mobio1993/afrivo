from django.conf import settings
from django.core.exceptions import FieldDoesNotExist, ValidationError


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


def get_user_hotel(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    hotel = getattr(user, "hotel", None)
    organization = getattr(hotel, "organization", None) if hotel else None
    user_organization = getattr(user, "organization", None)
    if (
        hotel
        and organization
        and user_organization
        and getattr(hotel, "is_active", True)
        and getattr(organization, "is_active", True)
        and getattr(user_organization, "is_active", True)
        and organization.id == user_organization.id
    ):
        return hotel
    return None


def get_user_organization(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    organization = getattr(user, "organization", None)
    if organization and getattr(organization, "is_active", True):
        return organization
    hotel = getattr(user, "hotel", None)
    hotel_organization = getattr(hotel, "organization", None) if hotel else None
    if hotel_organization and getattr(hotel_organization, "is_active", True):
        return hotel_organization
    return None


def is_platform_scope_user(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    role = str(getattr(user, "role", "") or "").lower()
    platform_roles = {"super_root", "super_admin_platform", "platform_admin"}
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "is_platform_admin", False)
        or role in platform_roles
    )


def user_has_valid_tenant(user):
    if is_platform_scope_user(user):
        return True
    organization = getattr(user, "organization", None)
    hotel = getattr(user, "hotel", None)
    if organization is None or hotel is None:
        return False
    hotel_organization = getattr(hotel, "organization", None)
    return bool(
        hotel_organization
        and getattr(organization, "is_active", True)
        and getattr(hotel, "is_active", True)
        and getattr(hotel_organization, "is_active", True)
        and organization.id == hotel_organization.id
    )


def attach_request_hotel(request):
    user = getattr(request, "user", None)
    request.active_hotel = get_user_hotel(user)
    request.organization = get_user_organization(user)
    request.tenant_is_valid = user_has_valid_tenant(user)
    request.tenant_error = "" if request.tenant_is_valid else "tenant_invalid"
    request.hotel = request.active_hotel
    return request.active_hotel


def get_request_hotel(request):
    if hasattr(request, "active_hotel"):
        return request.active_hotel
    return attach_request_hotel(request)


def get_request_organization(request):
    if not hasattr(request, "organization"):
        attach_request_hotel(request)
    return getattr(request, "organization", None)


def filter_for_active_hotel(queryset, hotel=None, field_name="hotel"):
    if hotel is None:
        return queryset.none()
    hotel_organization = getattr(hotel, "organization", None)
    if not getattr(hotel, "is_active", True) or not getattr(hotel_organization, "is_active", True):
        return queryset.none()
    try:
        queryset.model._meta.get_field(field_name)
    except FieldDoesNotExist:
        return queryset.none()
    return queryset.filter(**{field_name: hotel})


def filter_for_active_organization(queryset, organization=None, field_name="organization"):
    if organization is None or not getattr(organization, "is_active", True):
        return queryset.none()
    try:
        queryset.model._meta.get_field(field_name)
    except FieldDoesNotExist:
        return queryset.none()
    return queryset.filter(**{field_name: organization})


def scope_queryset_to_tenant(queryset, request, *, hotel_field_name="hotel", organization_field_name="organization"):
    if not hasattr(request, "tenant_is_valid"):
        attach_request_hotel(request)
    if not getattr(request, "tenant_is_valid", False):
        return queryset.none()

    hotel = get_request_hotel(request)
    if hotel is not None:
        return filter_for_active_hotel(queryset, hotel=hotel, field_name=hotel_field_name)

    organization = get_request_organization(request)
    return filter_for_active_organization(queryset, organization=organization, field_name=organization_field_name)


def scope_queryset_to_hotel(queryset, request, field_name="hotel"):
    if not hasattr(request, "tenant_is_valid"):
        attach_request_hotel(request)
    if not getattr(request, "tenant_is_valid", False):
        return queryset.none()
    return filter_for_active_hotel(queryset, hotel=get_request_hotel(request), field_name=field_name)


def object_belongs_to_hotel(obj, hotel, field_name="hotel"):
    if obj is None:
        return True
    if hotel is None:
        return False
    hotel_id_field = f"{field_name}_id"
    if hasattr(obj, hotel_id_field):
        return getattr(obj, hotel_id_field) == hotel.id
    related_hotel = getattr(obj, field_name, None)
    return bool(related_hotel and getattr(related_hotel, "id", None) == hotel.id)


def validate_objects_belong_to_hotel(hotel, **objects_by_field):
    for field_name, obj in objects_by_field.items():
        if not object_belongs_to_hotel(obj, hotel):
            raise ValidationError({field_name: "L'objet selectionne n'appartient pas au meme hotel."})
    return True


def is_hotel_scope_strict(module_key):
    if not module_key:
        return False
    return bool(getattr(settings, "TENANCY_STRICT_MODULES", {}).get(module_key, False))


def get_module_license_codes(module_key):
    from apps.licensing.services.access_service import LicensingAccessService  # noqa: PLC0415

    return LicensingAccessService.get_module_license_codes(module_key)


def module_license_is_active(module_key, *, hotel=None, organization=None):
    """Return True when the platform module is licensed for the hotel/org.

    Compatibility rule: if no matching PlatformModule has been configured yet,
    legacy hotels keep working. Once the module exists, a valid license is required.
    """
    from apps.licensing.services.access_service import LicensingAccessService  # noqa: PLC0415

    return LicensingAccessService.module_license_is_active(module_key, hotel=hotel, organization=organization)


def hotel_subscription_is_active(hotel):
    """Return True when the hotel has a valid active subscription."""
    from apps.licensing.services.access_service import LicensingAccessService  # noqa: PLC0415

    return LicensingAccessService.hotel_subscription_is_active(hotel)
