from apps.tenants.services.tenant_service import TenantService


class TenantMiddleware:
    """Attach tenant context to every authenticated request.

    Views and permissions still make the access decision, but this gives the
    whole request lifecycle a consistent request.organization/request.hotel.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            TenantService.attach_request_tenant(request)
        else:
            request.organization = None
            request.hotel = None
            request.active_hotel = None
        return self.get_response(request)
