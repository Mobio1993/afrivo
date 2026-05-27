from apps.users.models import UserHotelRole, UserOrganizationRole


class MembershipService:
    """Tenant membership facade backed by current user role assignments."""

    @staticmethod
    def organization_roles(user=None, *, organization=None, active_only=True):
        queryset = UserOrganizationRole.objects.select_related("user", "organization")
        if user is not None:
            queryset = queryset.filter(user=user)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        if active_only:
            queryset = queryset.filter(is_active=True)
        return queryset

    @staticmethod
    def hotel_roles(user=None, *, hotel=None, active_only=True):
        queryset = UserHotelRole.objects.select_related("user", "hotel", "hotel__organization")
        if user is not None:
            queryset = queryset.filter(user=user)
        if hotel is not None:
            queryset = queryset.filter(hotel=hotel)
        if active_only:
            queryset = queryset.filter(is_active=True)
        return queryset

    @staticmethod
    def user_has_organization_role(user, organization, role_code=None):
        queryset = MembershipService.organization_roles(user, organization=organization)
        if role_code:
            queryset = queryset.filter(role_code=role_code)
        return queryset.exists()

    @staticmethod
    def user_has_hotel_role(user, hotel, role_code=None):
        queryset = MembershipService.hotel_roles(user, hotel=hotel)
        if role_code:
            queryset = queryset.filter(role_code=role_code)
        return queryset.exists()


get_user_organization_roles = MembershipService.organization_roles
get_user_hotel_roles = MembershipService.hotel_roles

