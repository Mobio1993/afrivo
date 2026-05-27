from apps.tenancy.models import Organization


class OrganizationService:
    """Organization facade backed by apps.tenancy.Organization."""

    @staticmethod
    def queryset():
        return Organization.objects.all()

    @staticmethod
    def active_queryset():
        return Organization.objects.filter(is_active=True)

    @staticmethod
    def get_by_id(organization_id):
        if not organization_id:
            return None
        return Organization.objects.filter(pk=organization_id).first()

    @staticmethod
    def get_by_slug(slug):
        value = (slug or "").strip()
        if not value:
            return None
        return Organization.objects.filter(slug=value).first()

    @staticmethod
    def is_active(organization):
        return bool(organization and getattr(organization, "is_active", True))

    @staticmethod
    def accessible_by_user(user, *, active_only=True):
        from apps.tenants.services.tenant_service import TenantService

        return TenantService.get_accessible_organizations(user, active_only=active_only)


get_organization = OrganizationService.get_by_id
get_active_organizations = OrganizationService.active_queryset
