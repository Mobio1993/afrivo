import json

from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.core.api_responses import api_error, api_success
from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.users.jwt_auth import (
    attach_auth_cookies,
    build_auth_response_payload,
    blacklist_token,
    clear_auth_cookies,
    decode_jwt,
    get_user_from_payload,
    is_token_blacklisted,
)


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _login_throttle_keys(username, ip_address):
    username_key = username.lower() or "anonymous"
    return (
        f"auth:login:username:{username_key}",
        f"auth:login:ip:{ip_address}",
    )


def _is_throttled(username, ip_address):
    limit = settings.AUTH_LOGIN_THROTTLE_ATTEMPTS
    username_key, ip_key = _login_throttle_keys(username, ip_address)
    return (cache.get(username_key, 0) >= limit) or (cache.get(ip_key, 0) >= limit)


def _record_failed_attempt(username, ip_address):
    window = settings.AUTH_LOGIN_THROTTLE_WINDOW_SECONDS
    for cache_key in _login_throttle_keys(username, ip_address):
        try:
            cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, timeout=window)


def _clear_failed_attempts(username, ip_address):
    cache.delete_many(_login_throttle_keys(username, ip_address))


def _log_admin_auth_event(*, user, action, request):
    if not user or not (getattr(user, "is_admin_role", False) or getattr(user, "is_platform_admin", False)):
        return
    log_history(
        action_type=HistoryEntry.ActionType.OTHER,
        module="users",
        entity_type="User",
        entity_reference=user.username,
        description=f"Acces administrateur {action} pour {user.username}.",
        actor=user,
        hotel=getattr(user, "hotel", None),
        metadata={
            "auth_event": action,
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "ip_address": _client_ip(request),
        },
    )


@require_GET
@ensure_csrf_cookie
def csrf_api(request):
    return api_success(csrf="ok")


@require_POST
def login_api(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return api_error(detail="Requete invalide.", code="invalid_request")

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    remember_me = bool(payload.get("remember_me"))
    ip_address = _client_ip(request)

    if not username or not password:
        return api_error(detail="Nom d'utilisateur et mot de passe requis.", code="missing_credentials")

    if _is_throttled(username, ip_address):
        return api_error(
            detail="Trop de tentatives de connexion. Reessayez plus tard.",
            http_status=429,
            code="login_throttled",
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        _record_failed_attempt(username, ip_address)
        return api_error(detail="Identifiants invalides.", code="invalid_credentials")

    _clear_failed_attempts(username, ip_address)
    _log_admin_auth_event(user=user, action="login", request=request)

    response = api_success(message="Connexion reussie.", **build_auth_response_payload(user))
    return attach_auth_cookies(response, user, remember_me=remember_me)


@require_POST
def refresh_api(request):
    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME, "")
    if not refresh_token:
        return api_error(detail="Refresh token absent.", http_status=401, code="refresh_missing")

    if is_token_blacklisted(refresh_token):
        response = api_error(detail="Refresh token revoque.", http_status=401, code="refresh_revoked")
        return clear_auth_cookies(response)

    try:
        payload = decode_jwt(refresh_token, expected_type="refresh")
        user = get_user_from_payload(payload)
    except ValueError:
        response = api_error(detail="Refresh token invalide.", http_status=401, code="refresh_invalid")
        return clear_auth_cookies(response)

    response = api_success(message="Session renouvelee.", **build_auth_response_payload(user))
    return attach_auth_cookies(response, user, remember_me=bool(payload.get("rmb")))


@require_POST
def logout_api(request):
    auth_header = request.headers.get("Authorization", "")
    user = None
    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME, "")
    access_token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME, "")
    if access_token:
        try:
            payload = decode_jwt(access_token, expected_type="access")
            user = get_user_from_payload(payload)
        except ValueError:
            user = None
    if refresh_token:
        blacklist_token(refresh_token)
    if user is not None:
        _log_admin_auth_event(user=user, action="logout", request=request)
    response = api_success(message="Deconnexion reussie.", authenticated=False)
    return clear_auth_cookies(response)
