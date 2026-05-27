from django.http import JsonResponse

from apps.core.api_views import api_login_required, module_hotel_scope_required, module_permission_required
from apps.operations.planning import PlanningDateError, build_operations_planning_payload


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def planning_api(request):
    try:
        return JsonResponse(build_operations_planning_payload(request))
    except PlanningDateError as error:
        return JsonResponse({"detail": str(error)}, status=400)
