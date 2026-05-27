from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.tenants.hotels.services import HotelService
from apps.tenants.memberships.services import MembershipService
from apps.tenants.organizations.services import OrganizationService
from apps.tenants.services.scope_service import ScopeService


class TenantService:
    """
    Central multi-tenant facade.

    Models still live in their original apps. This service is the single entry
    point for tenant resolution, hotel/organization access and isolation checks.
    """

    get_user_hotel = staticmethod(ScopeService.get_user_hotel)
    get_user_organization = staticmethod(ScopeService.get_user_organization)
    is_platform_scope_user = staticmethod(ScopeService.is_platform_scope_user)
    user_has_valid_tenant = staticmethod(ScopeService.user_has_valid_tenant)
    get_request_hotel = staticmethod(ScopeService.get_request_hotel)
    get_request_organization = staticmethod(ScopeService.get_request_organization)
    filter_for_active_hotel = staticmethod(ScopeService.filter_for_active_hotel)
    filter_for_active_organization = staticmethod(ScopeService.filter_for_active_organization)
    scope_queryset_to_tenant = staticmethod(ScopeService.scope_queryset_to_tenant)
    scope_queryset_to_hotel = staticmethod(ScopeService.scope_queryset_to_hotel)
    object_belongs_to_hotel = staticmethod(ScopeService.object_belongs_to_hotel)
    validate_objects_belong_to_hotel = staticmethod(ScopeService.validate_objects_belong_to_hotel)
    is_hotel_scope_strict = staticmethod(ScopeService.is_hotel_scope_strict)

    @staticmethod
    def _is_authenticated(user):
        return bool(user and getattr(user, "is_authenticated", False))

    @staticmethod
    def _combine_or(filters):
        if not filters:
            return None
        combined = filters[0]
        for item in filters[1:]:
            combined |= item
        return combined

    @staticmethod
    def attach_request_tenant(request):
        ScopeService.attach_request(request)
        return TenantService.resolve_current_tenant(request)

    @staticmethod
    def attach_request(request):
        return TenantService.attach_request_tenant(request)

    @staticmethod
    def resolve_current_tenant(request):
        user = getattr(request, "user", None)
        hotel = ScopeService.get_request_hotel(request)
        organization = ScopeService.get_request_organization(request)
        is_platform_scope = ScopeService.is_platform_scope_user(user)
        is_valid = bool(is_platform_scope or ScopeService.user_has_valid_tenant(user))
        return {
            "hotel": hotel,
            "organization": organization,
            "is_platform_scope": is_platform_scope,
            "is_valid": is_valid,
            "error": "" if is_valid else "tenant_invalid",
        }

    @staticmethod
    def hotel_belongs_to_organization(hotel, organization):
        if hotel is None or organization is None:
            return False
        return getattr(hotel, "organization_id", None) == getattr(organization, "id", None)

    @staticmethod
    def user_can_access_organization(user, organization):
        if not TenantService._is_authenticated(user) or organization is None:
            return False
        if ScopeService.is_platform_scope_user(user):
            return True
        organization_id = getattr(organization, "id", None)
        if getattr(user, "organization_id", None) == organization_id:
            return True
        user_hotel = getattr(user, "hotel", None)
        if getattr(user_hotel, "organization_id", None) == organization_id:
            return True
        if MembershipService.user_has_organization_role(user, organization):
            return True
        return MembershipService.hotel_roles(user).filter(hotel__organization=organization).exists()

    @staticmethod
    def user_can_access_hotel(user, hotel):
        if not TenantService._is_authenticated(user) or hotel is None:
            return False
        if ScopeService.is_platform_scope_user(user):
            return True
        if not HotelService.is_active(hotel):
            return False
        if getattr(user, "hotel_id", None) == getattr(hotel, "id", None):
            return True
        hotel_organization = getattr(hotel, "organization", None)
        if getattr(user, "organization_id", None) == getattr(hotel, "organization_id", None):
            return True
        if MembershipService.user_has_hotel_role(user, hotel):
            return True
        if hotel_organization is not None and MembershipService.user_has_organization_role(user, hotel_organization):
            return True
        return False

    @staticmethod
    def get_accessible_hotels(user, *, active_only=True):
        queryset = HotelService.active_queryset() if active_only else HotelService.queryset()
        if not TenantService._is_authenticated(user):
            return queryset.none()
        if ScopeService.is_platform_scope_user(user):
            return queryset

        filters = []
        if getattr(user, "hotel_id", None):
            filters.append(Q(pk=user.hotel_id))
        if getattr(user, "organization_id", None):
            filters.append(Q(organization_id=user.organization_id))

        hotel_role_ids = MembershipService.hotel_roles(user).values_list("hotel_id", flat=True)
        organization_role_ids = MembershipService.organization_roles(user).values_list("organization_id", flat=True)
        filters.append(Q(pk__in=hotel_role_ids))
        filters.append(Q(organization_id__in=organization_role_ids))

        combined = TenantService._combine_or(filters)
        if combined is None:
            return queryset.none()
        return queryset.filter(combined).distinct()

    @staticmethod
    def get_accessible_organizations(user, *, active_only=True):
        queryset = OrganizationService.active_queryset() if active_only else OrganizationService.queryset()
        if not TenantService._is_authenticated(user):
            return queryset.none()
        if ScopeService.is_platform_scope_user(user):
            return queryset

        filters = []
        if getattr(user, "organization_id", None):
            filters.append(Q(pk=user.organization_id))
        user_hotel = getattr(user, "hotel", None)
        if getattr(user_hotel, "organization_id", None):
            filters.append(Q(pk=user_hotel.organization_id))

        organization_role_ids = MembershipService.organization_roles(user).values_list("organization_id", flat=True)
        hotel_role_organization_ids = MembershipService.hotel_roles(user).values_list(
            "hotel__organization_id",
            flat=True,
        )
        filters.append(Q(pk__in=organization_role_ids))
        filters.append(Q(pk__in=hotel_role_organization_ids))

        combined = TenantService._combine_or(filters)
        if combined is None:
            return queryset.none()
        return queryset.filter(combined).distinct()

    @staticmethod
    def scope_queryset_to_user_hotels(queryset, user, *, field_name="hotel", active_only=True):
        hotels = TenantService.get_accessible_hotels(user, active_only=active_only).values_list("id", flat=True)
        return queryset.filter(**{f"{field_name}_id__in": hotels})

    @staticmethod
    def assert_user_can_access_hotel(user, hotel):
        if not TenantService.user_can_access_hotel(user, hotel):
            raise ValidationError("Acces hotel non autorise pour cet utilisateur.")
        return True

    @staticmethod
    def assert_user_can_access_organization(user, organization):
        if not TenantService.user_can_access_organization(user, organization):
            raise ValidationError("Acces organisation non autorise pour cet utilisateur.")
        return True

    @staticmethod
    def assert_hotel_belongs_to_organization(hotel, organization):
        if not TenantService.hotel_belongs_to_organization(hotel, organization):
            raise ValidationError("Cet hotel n'appartient pas a cette organisation.")
        return True


attach_request_tenant = TenantService.attach_request_tenant
get_accessible_hotels = TenantService.get_accessible_hotels
get_accessible_organizations = TenantService.get_accessible_organizations
user_can_access_hotel = TenantService.user_can_access_hotel
user_can_access_organization = TenantService.user_can_access_organization
hotel_belongs_to_organization = TenantService.hotel_belongs_to_organization
