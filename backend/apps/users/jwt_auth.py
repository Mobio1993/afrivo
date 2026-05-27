import base64
import hashlib
import hmac
import json
import secrets
import time

from django.conf import settings

from apps.iam.services.permission_service import PermissionService
from django.utils import timezone

from apps.users.models import BlacklistedToken, User, UserSession


def _b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _json_dumps(payload):
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _sign(message):
    return hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()


def _password_fingerprint(user):
    digest = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        user.password.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest[:16]


def _access_lifetime_for_user(user):
    try:
        timeout_minutes = user.hotel.settings.session_timeout_minutes if user.hotel_id else None
    except Exception:
        timeout_minutes = None
    if timeout_minutes:
        return int(timeout_minutes) * 60
    return settings.JWT_ACCESS_LIFETIME_SECONDS


def generate_jwt(user, token_type, remember_me=False, lifetime=None, mfa_context=""):
    now = int(time.time())
    if token_type == "access":
        lifetime = lifetime or _access_lifetime_for_user(user)
    elif token_type == "refresh":
        lifetime = lifetime or settings.JWT_REFRESH_LIFETIME_SECONDS
    else:
        raise ValueError("Unsupported token type.")

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.pk),
        "type": token_type,
        "iat": now,
        "exp": now + lifetime,
        "jti": secrets.token_urlsafe(12),
        "usr": user.get_username(),
        "pwd": _password_fingerprint(user),
        "rmb": bool(remember_me),
    }
    if mfa_context:
        payload["mfa"] = mfa_context
        payload["mfa_at"] = now

    encoded_header = _b64url_encode(_json_dumps(header))
    encoded_payload = _b64url_encode(_json_dumps(payload))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = _b64url_encode(_sign(signing_input))
    return f"{encoded_header}.{encoded_payload}.{signature}"


def get_token_jti(token):
    try:
        payload = decode_jwt(token)
    except ValueError:
        return ""
    return payload.get("jti", "")


def _token_hash(token):
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def decode_jwt(token, expected_type=None):
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as exc:
        raise ValueError("Malformed token.") from exc

    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    expected_signature = _b64url_encode(_sign(signing_input))
    if not hmac.compare_digest(expected_signature, encoded_signature):
        raise ValueError("Invalid token signature.")

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Invalid token payload.") from exc

    if payload.get("exp", 0) < int(time.time()):
        raise ValueError("Token expired.")

    if expected_type and payload.get("type") != expected_type:
        raise ValueError("Unexpected token type.")

    return payload


def get_user_from_payload(payload):
    user = User.objects.filter(pk=payload.get("sub"), is_active=True).first()
    if user is None:
        raise ValueError("Unknown user.")
    if payload.get("pwd") != _password_fingerprint(user):
        raise ValueError("Token is no longer valid.")
    return user


def is_token_blacklisted(token):
    if not token:
        return False
    token_hash = _token_hash(token)
    token_jti = get_token_jti(token)
    queryset = BlacklistedToken.objects.filter(token_hash=token_hash)
    if token_jti:
        queryset = queryset | BlacklistedToken.objects.filter(token_jti=token_jti)
    queryset = queryset | BlacklistedToken.objects.filter(token=token)
    return queryset.exists()


def blacklist_token(token):
    if token:
        BlacklistedToken.objects.get_or_create(
            token_hash=_token_hash(token),
            defaults={
                "token": "",
                "token_jti": get_token_jti(token),
            },
        )


def authenticate_request(request):
    auth_header = request.headers.get("Authorization", "")
    token = ""

    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME):
        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME, "")

    if not token:
        return None

    try:
        payload = decode_jwt(token, expected_type="access")
        user = get_user_from_payload(payload)
    except ValueError:
        return None

    request.user = user
    request._cached_user = user
    request.jwt_payload = payload
    return user


def request_has_auth_token(request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return True
    return bool(request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME))


def resolve_api_user(request, allow_session_fallback=True):
    if request_has_auth_token(request):
        return authenticate_request(request)

    if allow_session_fallback and getattr(request, "user", None) and request.user.is_authenticated:
        return request.user

    return None


def build_auth_response_payload(user):
    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "public_id": str(user.public_id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": getattr(user, "get_role_display", lambda: "Utilisateur")(),
            "role_code": getattr(user, "role", ""),
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "platform_role": getattr(user, "platform_role", ""),
            "is_super_root": getattr(user, "is_super_root", False),
            "email_verified": getattr(user, "email_verified", False),
            "phone_verified": getattr(user, "phone_verified", False),
            "two_factor_enabled": getattr(user, "two_factor_enabled", False),
            "two_factor_required": getattr(user, "requires_two_factor", False),
            "organization_id": user.organization_id,
            "organization_name": user.organization.name if user.organization_id else "",
            "hotel_id": user.hotel_id,
            "hotel_name": user.hotel.name if user.hotel_id else "",
            "permissions": PermissionService.build_permission_map(user),
            "business_permissions": sorted(PermissionService.build_business_action_set(user)),
        },
    }


def _client_ip(request):
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _short_device_name(user_agent):
    if not user_agent:
        return "Appareil inconnu"
    lower = user_agent.lower()
    browser = "Navigateur"
    if "edg/" in lower:
        browser = "Edge"
    elif "chrome/" in lower:
        browser = "Chrome"
    elif "firefox/" in lower:
        browser = "Firefox"
    elif "safari/" in lower:
        browser = "Safari"
    os_name = "OS inconnu"
    if "windows" in lower:
        os_name = "Windows"
    elif "mac os" in lower:
        os_name = "macOS"
    elif "android" in lower:
        os_name = "Android"
    elif "iphone" in lower or "ipad" in lower:
        os_name = "iOS"
    elif "linux" in lower:
        os_name = "Linux"
    return f"{browser} sur {os_name}"


def _client_device(user_agent):
    name = _short_device_name(user_agent)
    if " sur " in name:
        browser, os_name = name.split(" sur ", 1)
        return browser, os_name
    return "", ""


def create_user_session(user, refresh_token, request=None):
    payload = decode_jwt(refresh_token, expected_type="refresh")
    user_agent = request.META.get("HTTP_USER_AGENT", "") if request is not None else ""
    browser, os_name = _client_device(user_agent)
    session, _ = UserSession.objects.update_or_create(
        refresh_token_jti=payload["jti"],
        defaults={
            "user": user,
            "device_name": _short_device_name(user_agent),
            "browser": browser,
            "os": os_name,
            "ip_address": _client_ip(request),
            "user_agent": user_agent,
            "last_activity": timezone.now(),
            "is_active": True,
            "revoked_at": None,
        },
    )
    return session


def revoke_user_session_by_token(refresh_token):
    jti = get_token_jti(refresh_token)
    if jti:
        UserSession.objects.filter(refresh_token_jti=jti, is_active=True).update(
            is_active=False,
            revoked_at=timezone.now(),
        )


def attach_auth_cookies(
    response,
    user,
    remember_me=False,
    request=None,
    access_lifetime=None,
    refresh_lifetime=None,
    mfa_context="",
):
    access_lifetime = int(access_lifetime or _access_lifetime_for_user(user))
    refresh_lifetime = int(refresh_lifetime or settings.JWT_REFRESH_LIFETIME_SECONDS)
    access_token = generate_jwt(user, "access", remember_me=remember_me, lifetime=access_lifetime, mfa_context=mfa_context)
    refresh_token = generate_jwt(user, "refresh", remember_me=remember_me, lifetime=refresh_lifetime, mfa_context=mfa_context)
    create_user_session(user, refresh_token, request=request)

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=access_lifetime,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path="/",
    )

    refresh_cookie_kwargs = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/api/auth/",
    }
    if remember_me:
        refresh_cookie_kwargs["max_age"] = refresh_lifetime

    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        **refresh_cookie_kwargs,
    )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, path="/api/auth/")
    return response
