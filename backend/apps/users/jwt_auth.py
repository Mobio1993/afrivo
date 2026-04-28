import base64
import hashlib
import hmac
import json
import secrets
import time

from django.conf import settings

from apps.users.access import build_user_permission_map
from apps.users.models import BlacklistedToken, User


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


def generate_jwt(user, token_type, remember_me=False):
    now = int(time.time())
    if token_type == "access":
        lifetime = settings.JWT_ACCESS_LIFETIME_SECONDS
    elif token_type == "refresh":
        lifetime = settings.JWT_REFRESH_LIFETIME_SECONDS
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

    encoded_header = _b64url_encode(_json_dumps(header))
    encoded_payload = _b64url_encode(_json_dumps(payload))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = _b64url_encode(_sign(signing_input))
    return f"{encoded_header}.{encoded_payload}.{signature}"


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
    return BlacklistedToken.objects.filter(token=token).exists()


def blacklist_token(token):
    if token:
        BlacklistedToken.objects.create(token=token)


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
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": getattr(user, "get_role_display", lambda: "Utilisateur")(),
            "role_code": getattr(user, "role", ""),
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "organization_id": user.organization_id,
            "organization_name": user.organization.name if user.organization_id else "",
            "hotel_id": user.hotel_id,
            "hotel_name": user.hotel.name if user.hotel_id else "",
            "permissions": build_user_permission_map(user),
        },
    }


def attach_auth_cookies(response, user, remember_me=False):
    access_token = generate_jwt(user, "access", remember_me=remember_me)
    refresh_token = generate_jwt(user, "refresh", remember_me=remember_me)

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.JWT_ACCESS_LIFETIME_SECONDS,
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
        refresh_cookie_kwargs["max_age"] = settings.JWT_REFRESH_LIFETIME_SECONDS

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
