from django.http import JsonResponse


def api_success(*, http_status=200, message="", **payload):
    body = {"success": True}
    if message:
        body["message"] = message
    body.update(payload)
    return JsonResponse(body, status=http_status)


def api_error(*, detail, http_status=400, code="api_error", errors=None, **payload):
    body = {
        "success": False,
        "detail": detail,
        "code": code,
    }
    if errors:
        body["errors"] = errors
    body.update(payload)
    return JsonResponse(body, status=http_status)
