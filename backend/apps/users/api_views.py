import json
import secrets

from django.conf import settings
from django.core.cache import cache
from django.core import signing
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from apps.audit_logs.models import ActivityLog, HistoryEntry
from apps.audit_logs.services import AuditLogService, HotelAuditService
from apps.super_root.services.audit_service import SuperRootAuditService
from apps.core.api_responses import api_error, api_success
from apps.iam.models import User, UserSession
from apps.iam.services.auth_service import AuthService
from apps.iam.services.token_service import (
    attach_auth_cookies,
    build_auth_response_payload,
    blacklist_token,
    clear_auth_cookies,
    decode_jwt,
    get_user_from_payload,
    is_token_blacklisted,
    resolve_api_user,
    revoke_user_session_by_token,
)


log_activity = AuditLogService.log_activity
log_history = HotelAuditService.log_history


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _parse_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _signed_token(prefix, user):
    signer = signing.TimestampSigner(salt=f"afrivo.{prefix}")
    return signer.sign(f"{user.pk}:{user.password[:16]}")


def _user_from_signed_token(prefix, token, max_age):
    signer = signing.TimestampSigner(salt=f"afrivo.{prefix}")
    value = signer.unsign(token, max_age=max_age)
    user_id, password_prefix = value.split(":", 1)
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None or not user.password.startswith(password_prefix):
        raise signing.BadSignature("invalid user token")
    return user


def _generic_security_response(message, **extra):
    if settings.DEBUG:
        return api_success(message=message, **extra)
    return api_success(message=message)


def _generate_otp_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def _validation_error_messages(exc):
    return getattr(exc, "messages", None) or [str(exc)]


WEAK_PASSWORD_TERMS = ("password", "admin", "afrivo", "123456")


def _strong_password_policy_errors(password, user, *, confirmation=None):
    errors = []
    value = password or ""
    lower_value = value.lower()
    username = (getattr(user, "username", "") or "").lower()

    if confirmation is None or confirmation == "":
        errors.append("La confirmation du mot de passe est obligatoire.")
    elif value != confirmation:
        errors.append("La confirmation du mot de passe ne correspond pas.")
    if len(value) < 8:
        errors.append("Le mot de passe doit contenir au moins 8 caracteres.")
    if not any(char.isupper() for char in value):
        errors.append("Le mot de passe doit contenir au moins une majuscule.")
    if not any(char.islower() for char in value):
        errors.append("Le mot de passe doit contenir au moins une minuscule.")
    if not any(char.isdigit() for char in value):
        errors.append("Le mot de passe doit contenir au moins un chiffre.")
    if not any(not char.isalnum() for char in value):
        errors.append("Le mot de passe doit contenir au moins un caractere special.")
    if username and username in lower_value:
        errors.append("Le mot de passe ne doit pas contenir le username.")
    if any(term in lower_value for term in WEAK_PASSWORD_TERMS):
        errors.append("Le mot de passe contient un terme trop faible ou interdit.")
    if user is not None and value and user.check_password(value):
        errors.append("Le nouveau mot de passe doit etre different de l'ancien.")

    return errors


def _revoke_all_user_sessions(user):
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False, revoked_at=timezone.now())


def _log_auth_security_event(*, request, user, action, description, metadata=None):
    log_activity(
        request=request,
        user=user,
        hotel=getattr(user, "hotel", None) if user is not None else None,
        action=action,
        module="auth",
        object_type="User",
        object_id=getattr(user, "id", "") or "",
        object_reference=getattr(user, "username", "") or "",
        description=description,
        severity=ActivityLog.Severity.INFO,
        metadata=metadata or {},
    )


def _log_super_root_mfa_event(*, request, user=None, action, challenge_id="", metadata=None, severity="info"):
    SuperRootAuditService.auth(
        request=request,
        actor=user,
        action=action,
        identifier=getattr(user, "username", "") or "",
        severity=severity,
        metadata={
            "security_event": action,
            "challenge_id": challenge_id,
            **(metadata or {}),
        },
    )


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


def _serialize_user_session(session):
    return {
        "id": session.id,
        "device_name": session.device_name,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
        "last_activity": session.last_activity.isoformat() if session.last_activity else "",
        "is_active": session.is_active,
        "revoked_at": session.revoked_at.isoformat() if session.revoked_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else "",
    }


def _auth_user_or_error(request):
    user = resolve_api_user(request)
    if user is None:
        return None, api_error(detail="Authentification requise.", http_status=401, code="auth_required", authenticated=False)
    request.user = user
    return user, None


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


def _complete_login_response(
    request,
    user,
    *,
    remember_me=False,
    access_lifetime=None,
    refresh_lifetime=None,
    mfa_context="",
):
    _clear_failed_attempts(user.username, _client_ip(request))
    user.clear_login_failures()
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    log_activity(
        request=request,
        user=user,
        hotel=getattr(user, "hotel", None),
        action=ActivityLog.Action.LOGIN,
        module="auth",
        object_type="User",
        object_id=user.id,
        object_reference=user.username,
        description=f"Connexion reussie pour {user.username}.",
        severity=ActivityLog.Severity.SUCCESS,
    )
    _log_admin_auth_event(user=user, action="login", request=request)
    response = api_success(message="Connexion reussie.", **build_auth_response_payload(user))
    return attach_auth_cookies(
        response,
        user,
        remember_me=remember_me,
        request=request,
        access_lifetime=access_lifetime,
        refresh_lifetime=refresh_lifetime,
        mfa_context=mfa_context,
    )


def _start_login_2fa_challenge(request, user, *, remember_me=False):
    challenge_id = secrets.token_urlsafe(24)
    code = _generate_otp_code()
    cache.set(
        f"auth:2fa-login:{challenge_id}",
        {"user_id": user.pk, "remember_me": remember_me},
        timeout=300,
    )
    cache.set(f"auth:2fa-login-code:{challenge_id}", code, timeout=300)
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.OTHER,
        description=f"Challenge 2FA login prepare pour {user.username}.",
        metadata={"security_event": "2fa_login_challenge_prepared"},
    )
    payload = {
        "authenticated": False,
        "two_factor_required": True,
        "challenge_id": challenge_id,
        "delivery": "email" if user.email else "recovery",
    }
    if settings.DEBUG:
        payload["otp"] = code
    return api_success(message="Verification 2FA requise.", **payload)


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
    if len(username) > 150 or len(password) > 256:
        return api_error(detail="Identifiants invalides.", code="invalid_credentials")

    if _is_throttled(username, ip_address):
        return api_error(
            detail="Trop de tentatives de connexion. Reessayez plus tard.",
            http_status=429,
            code="login_throttled",
        )

    matched_user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).first()
    if matched_user and matched_user.is_locked:
        return api_error(
            detail="Compte temporairement verrouille. Reessayez plus tard.",
            http_status=423,
            code="account_locked",
        )
    auth_username = matched_user.username if matched_user else username
    user = AuthService.authenticate_credentials(request, identifier=auth_username, password=password)
    if user is None:
        _record_failed_attempt(username, ip_address)
        if matched_user:
            matched_user.register_failed_login(
                lock_threshold=settings.AUTH_LOGIN_THROTTLE_ATTEMPTS,
                lock_seconds=settings.AUTH_LOGIN_THROTTLE_WINDOW_SECONDS,
            )
        log_activity(
            request=request,
            user=None,
            hotel=None,
            action=ActivityLog.Action.LOGIN,
            module="auth",
            object_type="User",
            object_reference=username,
            description=f"Tentative de connexion echouee pour {username}.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"username": username, "reason": "invalid_credentials"},
        )
        return api_error(detail="Identifiants invalides.", code="invalid_credentials")
    if not getattr(user, "is_platform_admin", False) and not (user.hotel_id or user.organization_id):
        log_activity(
            request=request,
            user=user,
            hotel=None,
            action=ActivityLog.Action.LOGIN,
            module="auth",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=f"Connexion refusee pour {user.username}: aucun rattachement organisation/hotel.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"username": user.username, "reason": "missing_tenant_scope"},
        )
        return api_error(
            detail="Compte non rattache a une organisation ou a un hotel. Contactez l'administrateur.",
            http_status=403,
            code="hotel_required",
        )

    if getattr(user, "requires_two_factor", False):
        return _start_login_2fa_challenge(request, user, remember_me=remember_me)

    return _complete_login_response(request, user, remember_me=remember_me)


@require_POST
def two_factor_login_verify_api(request):
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    challenge_id = str(payload.get("challenge_id") or "").strip()
    code = str(payload.get("code") or "").strip()
    challenge = cache.get(f"auth:2fa-login:{challenge_id}")
    expected_code = cache.get(f"auth:2fa-login-code:{challenge_id}")
    if not challenge_id or not code or not challenge or expected_code != code:
        if challenge and challenge.get("super_root"):
            user = User.objects.filter(pk=challenge.get("user_id"), is_active=True).first()
            _log_super_root_mfa_event(
                request=request,
                user=user,
                action="mfa_failed",
                challenge_id=challenge_id,
                metadata={"reason": "invalid_or_expired_code"},
                severity="warning",
            )
        return api_error(detail="Code 2FA invalide ou expire.", http_status=400, code="invalid_2fa_code")
    user = User.objects.filter(pk=challenge.get("user_id"), is_active=True).first()
    if user is None:
        if challenge.get("super_root"):
            _log_super_root_mfa_event(
                request=request,
                action="mfa_failed",
                challenge_id=challenge_id,
                metadata={"reason": "invalid_challenge_user"},
                severity="warning",
            )
        return api_error(detail="Challenge 2FA invalide ou expire.", http_status=400, code="invalid_2fa_challenge")
    if challenge.get("super_root") and not getattr(user, "is_super_root", False):
        _log_super_root_mfa_event(
            request=request,
            user=user,
            action="mfa_failed",
            challenge_id=challenge_id,
            metadata={"reason": "super_root_required"},
            severity="critical",
        )
        return api_error(detail="Challenge Super Root invalide ou expire.", http_status=400, code="invalid_2fa_challenge")
    cache.delete_many([f"auth:2fa-login:{challenge_id}", f"auth:2fa-login-code:{challenge_id}"])
    is_super_root_challenge = bool(challenge.get("super_root"))
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.LOGIN,
        description=f"Challenge 2FA login valide pour {user.username}.",
        metadata={
            "security_event": "2fa_login_verified",
            "super_root": is_super_root_challenge,
            "session_age_seconds": challenge.get("session_age_seconds") if is_super_root_challenge else None,
        },
    )
    if is_super_root_challenge:
        if hasattr(request, "session"):
            request.session["super_root_mfa_at"] = int(timezone.now().timestamp())
        _log_super_root_mfa_event(
            request=request,
            user=user,
            action="mfa_success",
            challenge_id=challenge_id,
            metadata={"session_age_seconds": challenge.get("session_age_seconds")},
            severity="success",
        )
    session_age = int(challenge.get("session_age_seconds") or 0) if is_super_root_challenge else None
    return _complete_login_response(
        request,
        user,
        remember_me=False if is_super_root_challenge else bool(challenge.get("remember_me")),
        access_lifetime=session_age if is_super_root_challenge else None,
        refresh_lifetime=session_age if is_super_root_challenge else None,
        mfa_context="super_root" if is_super_root_challenge else "",
    )


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

    if not UserSession.objects.filter(
        user=user,
        refresh_token_jti=payload.get("jti", ""),
        is_active=True,
    ).exists():
        response = api_error(detail="Session revoquee.", http_status=401, code="session_revoked")
        return clear_auth_cookies(response)

    blacklist_token(refresh_token)
    revoke_user_session_by_token(refresh_token)
    response = api_success(message="Session renouvelee.", **build_auth_response_payload(user))
    return attach_auth_cookies(response, user, remember_me=bool(payload.get("rmb")), request=request)


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
        revoke_user_session_by_token(refresh_token)
    if user is not None:
        log_activity(
            request=request,
            user=user,
            hotel=getattr(user, "hotel", None),
            action=ActivityLog.Action.LOGOUT,
            module="auth",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=f"Deconnexion de {user.username}.",
            severity=ActivityLog.Severity.INFO,
        )
        _log_admin_auth_event(user=user, action="logout", request=request)
    response = api_success(message="Deconnexion reussie.", authenticated=False)
    return clear_auth_cookies(response)


@require_GET
def me_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    return api_success(**build_auth_response_payload(user))


@require_POST
def change_password_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""
    new_password_confirm = (
        payload.get("new_password_confirm")
        or payload.get("confirm_password")
        or payload.get("password_confirm")
        or ""
    )
    if not user.check_password(current_password):
        return api_error(detail="Mot de passe actuel invalide.", http_status=400, code="invalid_current_password")
    policy_errors = _strong_password_policy_errors(new_password, user, confirmation=new_password_confirm)
    if policy_errors:
        return api_error(
            detail="Mot de passe invalide.",
            http_status=400,
            code="invalid_password",
            errors=policy_errors,
        )
    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        return api_error(detail="Mot de passe invalide.", http_status=400, code="invalid_password", errors=_validation_error_messages(exc))
    user.set_password(new_password)
    user.save(update_fields=["password"])
    _revoke_all_user_sessions(user)
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.UPDATE,
        description=f"Mot de passe modifie pour {user.username}.",
        metadata={"security_event": "password_changed"},
    )
    response = api_success(message="Mot de passe modifie. Veuillez vous reconnecter.", authenticated=False)
    return clear_auth_cookies(response)


@require_POST
def forgot_password_api(request):
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    identifier = (payload.get("email") or payload.get("username") or "").strip()
    user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier), is_active=True).first()
    extra = {}
    if user is not None:
        token = _signed_token("password_reset", user)
        cache.set(f"auth:password-reset:{user.pk}", token, timeout=3600)
        extra["reset_token"] = token
        _log_auth_security_event(
            request=request,
            user=user,
            action=ActivityLog.Action.OTHER,
            description=f"Demande de reinitialisation de mot de passe pour {user.username}.",
            metadata={"security_event": "password_reset_requested"},
        )
    return _generic_security_response("Si ce compte existe, un lien de reinitialisation a ete prepare.", **extra)


@require_POST
def reset_password_api(request):
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    token = payload.get("token") or ""
    new_password = payload.get("new_password") or ""
    try:
        user = _user_from_signed_token("password_reset", token, max_age=3600)
    except Exception:
        return api_error(detail="Lien de reinitialisation invalide ou expire.", http_status=400, code="invalid_reset_token")
    if cache.get(f"auth:password-reset:{user.pk}") != token:
        return api_error(detail="Lien de reinitialisation invalide ou expire.", http_status=400, code="invalid_reset_token")
    try:
        validate_password(new_password, user=user)
    except Exception as exc:
        return api_error(detail="Mot de passe invalide.", http_status=400, code="invalid_password", errors=_validation_error_messages(exc))
    user.set_password(new_password)
    user.clear_login_failures()
    user.save(update_fields=["password", "failed_login_attempts", "locked_until"])
    cache.delete(f"auth:password-reset:{user.pk}")
    _revoke_all_user_sessions(user)
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.UPDATE,
        description=f"Mot de passe reinitialise pour {user.username}.",
        metadata={"security_event": "password_reset_completed"},
    )
    return api_success(message="Mot de passe reinitialise.")


@require_POST
def email_verification_request_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    if not user.email:
        return api_error(detail="Aucun email n'est associe a ce compte.", code="email_missing")
    token = _signed_token("email_verify", user)
    cache.set(f"auth:email-verify:{user.pk}", token, timeout=86400)
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.OTHER,
        description=f"Demande de verification email pour {user.username}.",
        metadata={"security_event": "email_verification_requested"},
    )
    return _generic_security_response("Un lien de verification email a ete prepare.", verification_token=token)


@require_POST
def email_verification_confirm_api(request):
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    token = payload.get("token") or ""
    try:
        user = _user_from_signed_token("email_verify", token, max_age=86400)
    except Exception:
        return api_error(detail="Lien de verification invalide ou expire.", http_status=400, code="invalid_email_token")
    if cache.get(f"auth:email-verify:{user.pk}") != token:
        return api_error(detail="Lien de verification invalide ou expire.", http_status=400, code="invalid_email_token")
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    cache.delete(f"auth:email-verify:{user.pk}")
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.UPDATE,
        description=f"Email verifie pour {user.username}.",
        metadata={"security_event": "email_verified"},
    )
    return api_success(message="Email verifie.")


@require_POST
def two_factor_setup_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    code = _generate_otp_code()
    cache.set(f"auth:2fa:{user.pk}", code, timeout=300)
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.OTHER,
        description=f"Code 2FA email prepare pour {user.username}.",
        metadata={"security_event": "2fa_email_otp_prepared"},
    )
    return _generic_security_response("Un code 2FA email a ete prepare.", otp=code)


@require_POST
def two_factor_verify_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")
    code = str(payload.get("code") or "").strip()
    if not code or cache.get(f"auth:2fa:{user.pk}") != code:
        return api_error(detail="Code 2FA invalide ou expire.", http_status=400, code="invalid_2fa_code")
    cache.delete(f"auth:2fa:{user.pk}")
    user.two_factor_enabled = True
    user.two_factor_enabled_at = timezone.now()
    user.save(update_fields=["two_factor_enabled", "two_factor_enabled_at"])
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.UPDATE,
        description=f"2FA activee pour {user.username}.",
        metadata={"security_event": "2fa_enabled"},
    )
    return api_success(message="Verification 2FA validee.")


@require_POST
def two_factor_disable_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    cache.delete(f"auth:2fa:{user.pk}")
    user.two_factor_enabled = False
    user.two_factor_enabled_at = None
    user.save(update_fields=["two_factor_enabled", "two_factor_enabled_at"])
    _log_auth_security_event(
        request=request,
        user=user,
        action=ActivityLog.Action.UPDATE,
        description=f"2FA desactivee pour {user.username}.",
        metadata={"security_event": "2fa_disabled"},
    )
    return api_success(message="2FA desactivee.")


@require_GET
def sessions_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    sessions = UserSession.objects.filter(user=user, is_active=True).order_by("-last_activity", "-created_at")
    return api_success(results=[_serialize_user_session(session) for session in sessions])


def session_detail_api(request, session_id):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    if request.method != "DELETE":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    updated = UserSession.objects.filter(user=user, pk=session_id, is_active=True).update(
        is_active=False,
        revoked_at=timezone.now(),
    )
    if not updated:
        return api_error(detail="Session introuvable.", http_status=404, code="session_not_found")
    return api_success(message="Session revoquee.")


@require_http_methods(["POST", "DELETE"])
def sessions_revoke_all_api(request):
    user, error = _auth_user_or_error(request)
    if error is not None:
        return error
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False, revoked_at=timezone.now())
    response = api_success(message="Toutes les sessions ont ete revoquees.")
    return clear_auth_cookies(response)
