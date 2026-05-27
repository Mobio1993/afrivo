from apps.tenancy.utils import (
    attach_request_hotel,
    filter_for_active_hotel,
    filter_for_active_organization,
    get_request_hotel,
    get_request_organization,
    get_user_hotel,
    get_user_organization,
    is_hotel_scope_strict,
    is_platform_scope_user,
    object_belongs_to_hotel,
    scope_queryset_to_hotel,
    scope_queryset_to_tenant,
    user_has_valid_tenant,
    validate_objects_belong_to_hotel,
)


class ScopeService:
    """Tenant scoping facade backed by apps.tenancy.utils."""

    get_user_hotel = staticmethod(get_user_hotel)
    get_user_organization = staticmethod(get_user_organization)
    is_platform_scope_user = staticmethod(is_platform_scope_user)
    user_has_valid_tenant = staticmethod(user_has_valid_tenant)
    attach_request = staticmethod(attach_request_hotel)
    get_request_hotel = staticmethod(get_request_hotel)
    get_request_organization = staticmethod(get_request_organization)
    filter_for_active_hotel = staticmethod(filter_for_active_hotel)
    filter_for_active_organization = staticmethod(filter_for_active_organization)
    scope_queryset_to_tenant = staticmethod(scope_queryset_to_tenant)
    scope_queryset_to_hotel = staticmethod(scope_queryset_to_hotel)
    object_belongs_to_hotel = staticmethod(object_belongs_to_hotel)
    validate_objects_belong_to_hotel = staticmethod(validate_objects_belong_to_hotel)
    is_hotel_scope_strict = staticmethod(is_hotel_scope_strict)


__all__ = [
    "ScopeService",
    "attach_request_hotel",
    "filter_for_active_hotel",
    "filter_for_active_organization",
    "get_request_hotel",
    "get_request_organization",
    "get_user_hotel",
    "get_user_organization",
    "is_hotel_scope_strict",
    "is_platform_scope_user",
    "object_belongs_to_hotel",
    "scope_queryset_to_hotel",
    "scope_queryset_to_tenant",
    "user_has_valid_tenant",
    "validate_objects_belong_to_hotel",
]

