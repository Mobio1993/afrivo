import json
import secrets

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.audit_logs.models import ActivityLog, PlatformAuditEvent
from apps.core.api_responses import api_error, api_success
from apps.core.api_views import api_login_required
from apps.iam.models import IAMPermission, IAMRole, User
from apps.iam.services.auth_service import AuthService
from apps.licensing.services.module_license_service import ModuleLicenseService
from apps.licensing.services.subscription_service import SubscriptionService
from apps.platform_admin.models import HotelSubscription, PlatformLicense, PlatformModule, SubscriptionPlan
from apps.super_root.api.serializers import SuperRootMaintenanceRunSerializer, SuperRootPlatformCreateSerializer
from apps.super_root.services.audit_service import SuperRootAuditService
from apps.super_root.services.dashboard_service import SuperRootDashboardService
from apps.super_root.services.maintenance_service import SuperRootMaintenanceService
from apps.super_root.services.monitoring_service import SuperRootMonitoringService
from apps.super_root.services.platform_service import SuperRootPlatformService
from apps.super_root.services.security_policy_service import SuperRootSecurityPolicyService
from apps.super_root.services.security_service import SuperRootSecurityService
from apps.tenancy.models import Hotel, HotelSettings, Organization
from apps.users.api_views import logout_api


def require_super_root(request):
    if SuperRootSecurityPolicyService.is_super_root(request.user):
        return None
    SuperRootAuditService.denied(
        request=request,
        actor=getattr(request, "user", None),
        action="access.denied",
        reason="super_root_required",
    )
    return api_error(
        detail="Seul le Super Root technique peut acceder a cette ressource.",
        http_status=403,
        code="super_root_required",
        module="super_root",
    )


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def parse_json_body_or_empty(request):
    if not request.body:
        return {}
    return parse_json_body(request)


def require_critical_confirmation(request, *, action, confirmation, target=None):
    try:
        SuperRootSecurityPolicyService.require_confirmation(
            action,
            confirmation,
            actor=request.user,
            request=request,
            target=target,
        )
    except ValidationError as exc:
        return api_error(
            detail="Confirmation obligatoire pour cette action critique.",
            http_status=400,
            code="critical_confirmation_required",
            errors=exc.messages,
        )
    return None


def generate_super_root_otp_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def audit_super_root_auth_event(request, *, action, user=None, identifier="", metadata=None, severity="info"):
    return SuperRootAuditService.auth(
        request=request,
        actor=user,
        action=action,
        identifier=identifier,
        severity=severity,
        metadata={
            **(metadata or {}),
        },
    )


def start_super_root_login_mfa_challenge(request, user):
    challenge_id = secrets.token_urlsafe(24)
    code = generate_super_root_otp_code()
    cache.set(
        f"auth:2fa-login:{challenge_id}",
        {
            "user_id": user.pk,
            "remember_me": False,
            "super_root": True,
            "session_age_seconds": SuperRootSecurityPolicyService.session_age_seconds(),
        },
        timeout=300,
    )
    cache.set(f"auth:2fa-login-code:{challenge_id}", code, timeout=300)

    audit_super_root_auth_event(
        request,
        action="mfa_required",
        user=user,
        identifier=user.username,
        metadata={
            "challenge_id": challenge_id,
            "delivery": "email" if user.email else "recovery",
            "session_age_seconds": SuperRootSecurityPolicyService.session_age_seconds(),
            "remember_me_ignored": True,
        },
        severity="warning",
    )

    payload = {
        "authenticated": False,
        "two_factor_required": True,
        "challenge_id": challenge_id,
        "delivery": "email" if user.email else "recovery",
        "session_age_seconds": SuperRootSecurityPolicyService.session_age_seconds(),
    }
    if settings.DEBUG:
        payload["otp"] = code
    return api_success(message="Verification MFA Super Root requise.", **payload)


def serialize_org(org):
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "platform_id": org.platform.slug if getattr(org, "platform_id", None) else "",
        "platform_name": org.platform.name if getattr(org, "platform_id", None) else "AFRIVO Default",
        "status": org.status,
        "is_active": org.is_active,
        "hotels_count": getattr(org, "hotels_count", 0),
        "users_count": getattr(org, "users_count", 0),
        "created_at": org.created_at.isoformat() if org.created_at else "",
    }


def serialize_hotel(hotel):
    usage = SubscriptionService.user_quota_usage(hotel)
    subscription = getattr(hotel, "subscription", None)
    modules_active = PlatformLicense.objects.filter(
        Q(hotel=hotel) | Q(organization=hotel.organization, hotel__isnull=True),
        status=PlatformLicense.Status.ACTIVE,
        module__is_active=True,
    ).count()
    activity = ActivityLog.objects.filter(hotel=hotel).order_by("-created_at").first()
    return {
        "id": hotel.id,
        "organization_id": hotel.organization_id,
        "organization_name": hotel.organization.name if hotel.organization_id else "",
        "platform_id": hotel.platform.slug if getattr(hotel, "platform_id", None) else (
            hotel.organization.platform.slug if hotel.organization_id and getattr(hotel.organization, "platform_id", None) else ""
        ),
        "platform_name": hotel.platform.name if getattr(hotel, "platform_id", None) else (
            hotel.organization.platform.name if hotel.organization_id and getattr(hotel.organization, "platform_id", None) else "AFRIVO Default"
        ),
        "name": hotel.name,
        "code": hotel.code,
        "slug": hotel.slug,
        "country": hotel.country,
        "city": hotel.city,
        "timezone": hotel.timezone,
        "currency": hotel.currency,
        "is_active": hotel.is_active,
        "subscription_status": subscription.status if subscription else "",
        "plan_name": subscription.plan.name if subscription and subscription.plan_id else "",
        "quota": usage,
        "rooms_count": getattr(hotel, "rooms_count", None),
        "modules_active": modules_active,
        "system_health": "critique" if not hotel.is_active else usage.get("status", "ok"),
        "last_activity": activity.created_at.isoformat() if activity else "",
        "created_at": hotel.created_at.isoformat() if hotel.created_at else "",
    }


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_super_root": user.is_super_root,
        "is_platform_admin": user.is_platform_admin,
        "platform_role": user.platform_role,
        "organization_id": user.organization_id,
        "organization_name": user.organization.name if user.organization_id else "",
        "hotel_id": user.hotel_id,
        "hotel_name": user.hotel.name if user.hotel_id else "",
        "two_factor_enabled": user.two_factor_enabled,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def serialize_module(module):
    return {
        "id": module.id,
        "code": module.code,
        "name": module.name,
        "description": module.description,
        "monthly_license_price": str(module.monthly_license_price),
        "is_active": module.is_active,
        "licenses_count": getattr(module, "licenses_count", 0),
    }


def serialize_license(license_obj):
    return {
        "id": license_obj.id,
        "module_id": license_obj.module_id,
        "module_code": license_obj.module.code if license_obj.module_id else "",
        "organization_id": license_obj.organization_id,
        "organization_name": license_obj.organization.name if license_obj.organization_id else "",
        "hotel_id": license_obj.hotel_id,
        "hotel_name": license_obj.hotel.name if license_obj.hotel_id else "",
        "status": license_obj.status,
        "starts_at": license_obj.starts_at.isoformat() if license_obj.starts_at else "",
        "ends_at": license_obj.ends_at.isoformat() if license_obj.ends_at else None,
        "monthly_price": str(license_obj.monthly_price),
        "is_valid": license_obj.is_valid_now,
    }


def serialize_activity_log(log):
    return {
        "id": log.id,
        "module": log.module,
        "action": log.action,
        "severity": log.severity,
        "description": log.description,
        "object_type": log.object_type,
        "object_id": log.object_id,
        "object_reference": log.object_reference,
        "user": log.user.username if log.user_id else "system",
        "hotel": log.hotel.name if log.hotel_id else "",
        "created_at": log.created_at.isoformat() if log.created_at else "",
    }


def serialize_platform_event(event):
    return {
        "id": event.id,
        "event_type": event.event_type,
        "actor": event.actor.username if event.actor_id else "system",
        "target_type": event.target_type,
        "target_id": event.target_id,
        "target_label": event.target_label,
        "metadata": event.metadata,
        "created_at": event.created_at.isoformat() if event.created_at else "",
    }


def audit_event_severity(event):
    if event.event_type in {
        PlatformAuditEvent.EventType.HOTEL_SUSPENDED,
        PlatformAuditEvent.EventType.LICENSE_SUSPENDED,
        PlatformAuditEvent.EventType.SECURITY_REVIEW,
    }:
        return "warning"
    return "info"


def csv_response(filename, rows, columns):
    lines = [",".join(columns)]
    for row in rows:
        values = []
        for column in columns:
            raw = str(row.get(column, "")).replace('"', '""')
            values.append(f'"{raw}"')
        lines.append(",".join(values))
    response = HttpResponse("\n".join(lines), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def list_response(key, queryset, serializer, *, total=None, limit=200, **extra):
    rows = [serializer(item) for item in queryset[:limit]]
    return api_success(**{key: rows, "count": total if total is not None else queryset.count(), **extra})


def paginate_rows(request, key, queryset, serializer, *, default_page_size=25):
    page = max(int(request.GET.get("page") or 1), 1)
    page_size = min(max(int(request.GET.get("page_size") or default_page_size), 1), 100)
    paginator = Paginator(queryset, page_size)
    current = paginator.get_page(page)
    return api_success(
        **{
            key: [serializer(item) for item in current.object_list],
            "count": paginator.count,
            "pagination": {
                "page": current.number,
                "page_size": page_size,
                "total": paginator.count,
                "pages": paginator.num_pages,
                "has_next": current.has_next(),
                "has_previous": current.has_previous(),
            },
        }
    )


def get_super_root_hotel(hotel_id):
    return get_object_or_404(
        Hotel.objects.select_related("organization", "subscription__plan").annotate(
            rooms_count=Count("rooms", distinct=True),
        ),
        pk=hotel_id,
    )


def serialize_hotel_module_license(license_obj):
    module = license_obj.module
    return {
        "id": license_obj.id,
        "module_id": license_obj.module_id,
        "code": module.code if module else "",
        "name": module.name if module else "",
        "description": module.description if module else "",
        "status": license_obj.status,
        "scope": "hotel" if license_obj.hotel_id else "organization",
        "monthly_price": str(license_obj.monthly_price),
        "starts_at": license_obj.starts_at.isoformat() if license_obj.starts_at else "",
        "ends_at": license_obj.ends_at.isoformat() if license_obj.ends_at else "",
        "is_valid": license_obj.is_valid_now,
    }


def serialize_hotel_activity(log):
    return {
        "id": log.id,
        "action": log.action,
        "module": log.module,
        "severity": log.severity,
        "description": log.description,
        "actor": log.user.username if log.user_id else "system",
        "object_reference": log.object_reference,
        "created_at": log.created_at.isoformat() if log.created_at else "",
    }


def build_hotel_detail_payload(hotel):
    subscription = getattr(hotel, "subscription", None)
    modules = PlatformLicense.objects.select_related("module").filter(
        Q(hotel=hotel) | Q(organization=hotel.organization, hotel__isnull=True)
    ).order_by("module__name", "-updated_at")
    users = User.objects.filter(hotel=hotel)
    activity = ActivityLog.objects.select_related("user").filter(hotel=hotel).order_by("-created_at", "-id")[:10]
    quota = SubscriptionService.user_quota_usage(hotel)
    return {
        "hotel": serialize_hotel(hotel),
        "identity": {
            "name": hotel.name,
            "code": hotel.code,
            "slug": hotel.slug,
            "city": hotel.city,
            "country": hotel.country,
            "timezone": hotel.timezone,
            "currency": hotel.currency,
            "is_active": hotel.is_active,
        },
        "organization": {
            "id": hotel.organization_id,
            "name": hotel.organization.name if hotel.organization_id else "",
            "slug": hotel.organization.slug if hotel.organization_id else "",
            "status": hotel.organization.status if hotel.organization_id else "",
            "is_active": hotel.organization.is_active if hotel.organization_id else False,
        },
        "subscription": {
            "id": subscription.id if subscription else None,
            "status": subscription.status if subscription else "",
            "plan_name": subscription.plan.name if subscription and subscription.plan_id else "",
            "billing_cycle": subscription.billing_cycle if subscription else "",
            "starts_at": subscription.starts_at.isoformat() if subscription and subscription.starts_at else "",
            "ends_at": subscription.ends_at.isoformat() if subscription and subscription.ends_at else "",
            "quota": quota,
        },
        "modules": [serialize_hotel_module_license(item) for item in modules[:100]],
        "security": {
            "users_total": users.count(),
            "active_users": users.filter(is_active=True).count(),
            "admins": users.filter(role=User.Role.ADMIN, is_active=True).count(),
            "without_2fa": users.filter(two_factor_enabled=False, is_active=True).count(),
            "locked_users": users.filter(locked_until__gt=timezone.now()).count(),
        },
        "monitoring": {
            "system_health": "critique" if not hotel.is_active else quota.get("status", "ok"),
            "api_status": "ok" if hotel.is_active else "warning",
            "database_status": "ok",
            "storage_status": "nominal",
            "performance_score": 96 if hotel.is_active else 60,
        },
        "activity": [serialize_hotel_activity(log) for log in activity],
    }


def super_root_auth_login_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="JSON invalide.", http_status=400, code="invalid_json")

    identifier = (payload.get("username") or payload.get("email") or payload.get("identifiant") or "").strip()
    password = payload.get("password") or ""
    audit_super_root_auth_event(
        request,
        action="login.attempt",
        identifier=identifier,
        metadata={"has_identifier": bool(identifier), "remember_me_requested": bool(payload.get("remember_me"))},
        severity="info",
    )
    if not identifier or not password:
        audit_super_root_auth_event(
            request,
            action="login.failed",
            identifier=identifier,
            metadata={"reason": "missing_credentials"},
            severity="warning",
        )
        return api_error(detail="Identifiant et mot de passe requis.", code="missing_credentials")

    user = AuthService.authenticate_credentials(request, identifier=identifier, password=password)
    if user is None:
        audit_super_root_auth_event(
            request,
            action="login.failed",
            identifier=identifier,
            metadata={"reason": "invalid_credentials"},
            severity="warning",
        )
        return api_error(detail="Identifiants invalides.", http_status=401, code="invalid_credentials")
    if not SuperRootSecurityPolicyService.is_super_root(user):
        audit_super_root_auth_event(
            request,
            action="login.denied",
            user=user,
            identifier=identifier,
            metadata={"reason": "super_root_required"},
            severity="critical",
        )
        return api_error(
            detail="Seul le Super Root technique peut ouvrir cette session.",
            http_status=403,
            code="super_root_required",
        )

    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    audit_super_root_auth_event(
        request,
        action="login.credentials_accepted",
        user=user,
        identifier=identifier,
        metadata={
            "mfa_forced": SuperRootSecurityPolicyService.mfa_required(user),
            "remember_me_ignored": bool(payload.get("remember_me")),
            "session_age_seconds": SuperRootSecurityPolicyService.session_age_seconds(),
        },
        severity="success",
    )
    return start_super_root_login_mfa_challenge(request, user)


def super_root_auth_logout_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    user = AuthService.resolve_request_user(request)
    if user is not None and SuperRootSecurityPolicyService.is_super_root(user):
        SuperRootAuditService.auth(request=request, actor=user, action="logout", severity="info")
    return logout_api(request)


@api_login_required
def super_root_dashboard_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="dashboard.access")
    return api_success(dashboard=SuperRootDashboardService.build())


@api_login_required
def super_root_platform_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="platform.overview")
    return api_success(
        platform=SuperRootPlatformService.overview(),
        quotas=SuperRootPlatformService.hotel_quota_snapshot(),
    )


@api_login_required
def super_root_platforms_api(request):
    if request.method not in {"GET", "POST"}:
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    if request.method == "POST":
        payload = parse_json_body(request)
        if payload is None:
            return api_error(detail="JSON invalide.", http_status=400, code="invalid_json")
        serializer = SuperRootPlatformCreateSerializer(data=payload)
        if not serializer.is_valid():
            SuperRootAuditService.denied(
                request=request,
                actor=request.user,
                action="platform.create.invalid",
                reason="validation_error",
                metadata={"errors": serializer.errors},
            )
            return api_error(
                detail="Les donnees de plateforme sont invalides.",
                http_status=400,
                code="validation_error",
                errors=serializer.errors,
            )
        try:
            platform = SuperRootPlatformService.create_platform(
                serializer.validated_data,
                actor=request.user,
                request=request,
            )
        except ValueError as exc:
            return api_error(detail=str(exc), http_status=400, code="platform_create_failed")
        return api_success(message="Plateforme creee.", platform=platform, **SuperRootPlatformService.platform_command_center())
    SuperRootAuditService.access(request=request, actor=request.user, action="platforms.list")
    return api_success(**SuperRootPlatformService.platform_command_center())


@api_login_required
def super_root_platform_action_api(request, platform_id, action):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    is_default_platform = platform_id == SuperRootPlatformService.PLATFORM_ID
    if not SuperRootPlatformService.platform_exists(platform_id):
        return api_error(detail="Plateforme introuvable.", http_status=404, code="platform_not_found")

    payload = parse_json_body_or_empty(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    normalized_action = action.replace("-", "_")

    if normalized_action == "healthcheck":
        if is_default_platform:
            return api_success(healthcheck=SuperRootPlatformService.healthcheck(actor=request.user, request=request))
        try:
            return api_success(healthcheck=SuperRootPlatformService.registered_healthcheck(platform_id, actor=request.user, request=request))
        except ValueError as exc:
            return api_error(detail=str(exc), http_status=404, code="platform_not_found")

    if normalized_action in {"attach", "attach_tenants", "rattacher"}:
        try:
            result = SuperRootPlatformService.attach_tenants(
                platform_id,
                organization_id=payload.get("organization_id"),
                hotel_ids=payload.get("hotel_ids") or [],
                include_organization_hotels=payload.get("include_organization_hotels", True),
                actor=request.user,
                request=request,
            )
        except ValueError as exc:
            return api_error(detail=str(exc), http_status=400, code="platform_attach_failed")
        return api_success(message="Rattachement plateforme effectue.", **result, **SuperRootPlatformService.platform_command_center())

    if normalized_action == "incidents":
        return api_success(**SuperRootPlatformService.incidents(actor=request.user, request=request))

    if normalized_action in {"monitoring", "monitoring_live"}:
        return api_success(monitoring=SuperRootPlatformService.monitoring_live(actor=request.user, request=request))

    if normalized_action in {"audit", "platform_audit"}:
        return api_success(**SuperRootPlatformService.platform_audit(actor=request.user, request=request))

    if normalized_action in {"integrity", "integrity_check"}:
        return api_success(integrity=SuperRootPlatformService.integrity_check(actor=request.user, request=request))

    if normalized_action in {"critical_quotas", "quotas_critique"}:
        SuperRootAuditService.access(
            request=request,
            actor=request.user,
            action="platform.critical_quotas",
            severity="warning",
        )
        return api_success(**SuperRootPlatformService.critical_quotas())

    if normalized_action in {"suspended_clients", "clients_suspendus"}:
        SuperRootAuditService.access(
            request=request,
            actor=request.user,
            action="platform.suspended_clients",
            severity="warning",
        )
        return api_success(**SuperRootPlatformService.suspended_clients())

    if normalized_action in {"subscription_lifecycle", "cycle_abonnements"}:
        dry_run = bool(payload.get("dry_run", False))
        if not dry_run:
            confirmation_error = require_critical_confirmation(
                request,
                action=SuperRootSecurityPolicyService.ACTION_MAINTENANCE,
                confirmation=payload.get("confirmation"),
                target=platform_id,
            )
            if confirmation_error is not None:
                return confirmation_error
        return api_success(
            message="Cycle abonnements execute.",
            result=SuperRootPlatformService.run_subscription_lifecycle(
                actor=request.user,
                request=request,
                dry_run=dry_run,
            ),
        )

    if normalized_action in {"snapshot", "export_snapshot"}:
        return api_success(snapshot=SuperRootPlatformService.export_snapshot_payload(actor=request.user, request=request))

    if normalized_action not in {"maintenance", "suspend", "reactivate"}:
        return api_error(detail="Action plateforme inconnue.", http_status=404, code="platform_action_not_found")

    if normalized_action in {"maintenance", "suspend"}:
        confirmation_error = require_critical_confirmation(
            request,
            action=(
                SuperRootSecurityPolicyService.ACTION_PLATFORM_SUSPEND
                if normalized_action == "suspend"
                else SuperRootSecurityPolicyService.ACTION_MAINTENANCE
            ),
            confirmation=payload.get("confirmation"),
            target=platform_id,
        )
        if confirmation_error is not None:
            return confirmation_error

    status = {
        "maintenance": "maintenance",
        "suspend": "suspended",
        "reactivate": "active",
    }[normalized_action]
    try:
        platform = SuperRootPlatformService.set_state(
            status,
            actor=request.user,
            request=request,
            reason=(payload.get("reason") or "").strip(),
            platform_id=platform_id,
        )
    except ValueError as exc:
        return api_error(detail=str(exc), http_status=400, code="invalid_platform_status")
    return api_success(message="Etat plateforme mis a jour.", platform=platform)


@api_login_required
def super_root_platform_snapshot_export_api(request, platform_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    if not SuperRootPlatformService.platform_exists(platform_id):
        return api_error(detail="Plateforme introuvable.", http_status=404, code="platform_not_found")
    payload = SuperRootPlatformService.export_snapshot_payload(actor=request.user, request=request)
    payload["requested_platform_id"] = platform_id
    response = HttpResponse(
        json.dumps(payload, ensure_ascii=False, indent=2),
        content_type="application/json; charset=utf-8",
    )
    response["Content-Disposition"] = f'attachment; filename="platform-{platform_id}-snapshot.json"'
    return response


@api_login_required
def super_root_organizations_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="organizations.list")
    queryset = Organization.objects.select_related("platform").annotate(
        hotels_count=Count("hotels", distinct=True),
        users_count=Count("users", distinct=True),
    ).order_by("name")
    return list_response("organizations", queryset, serialize_org)


@api_login_required
def super_root_hotels_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="hotels.list")
    queryset = Hotel.objects.select_related("organization__platform", "platform", "subscription__plan").annotate(
        rooms_count=Count("rooms", distinct=True),
    ).order_by("organization__name", "name")
    q = (request.GET.get("q") or request.GET.get("search") or "").strip()
    if q:
        queryset = queryset.filter(
            Q(name__icontains=q)
            | Q(code__icontains=q)
            | Q(slug__icontains=q)
            | Q(city__icontains=q)
            | Q(country__icontains=q)
            | Q(organization__name__icontains=q)
        )
    if request.GET.get("organization"):
        queryset = queryset.filter(organization_id=request.GET.get("organization"))
    if request.GET.get("platform"):
        platform_id = request.GET.get("platform")
        if platform_id == SuperRootPlatformService.PLATFORM_ID:
            queryset = queryset.filter(Q(platform__slug=platform_id) | Q(platform__isnull=True, organization__platform__isnull=True))
        else:
            queryset = queryset.filter(Q(platform__slug=platform_id) | Q(organization__platform__slug=platform_id))
    if request.GET.get("status"):
        is_active = request.GET.get("status") == "active"
        queryset = queryset.filter(is_active=is_active)
    if request.GET.get("city"):
        queryset = queryset.filter(city__icontains=request.GET.get("city"))
    if request.GET.get("country"):
        queryset = queryset.filter(country__icontains=request.GET.get("country"))
    if request.GET.get("license_status"):
        queryset = queryset.filter(subscription__status=request.GET.get("license_status"))
    return paginate_rows(request, "hotels", queryset, serialize_hotel)


@api_login_required
def super_root_hotel_detail_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    SuperRootAuditService.access(request=request, actor=request.user, action="hotels.detail", target=hotel)
    return api_success(**build_hotel_detail_payload(hotel))


@api_login_required
def super_root_hotel_modules_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    licenses = PlatformLicense.objects.select_related("module").filter(
        Q(hotel=hotel) | Q(organization=hotel.organization, hotel__isnull=True)
    ).order_by("module__name")
    return api_success(hotel=serialize_hotel(hotel), modules=[serialize_hotel_module_license(item) for item in licenses])


@api_login_required
def super_root_hotel_security_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    users = User.objects.filter(hotel=hotel).order_by("username")
    sessions = []
    for user in users[:100]:
        for session in user.sessions.filter(is_active=True).order_by("-last_activity")[:5]:
            sessions.append(SuperRootSecurityService.serialize_session(session))
    logs = ActivityLog.objects.select_related("user").filter(hotel=hotel, severity__in=["warning", "danger", "critical"]).order_by("-created_at", "-id")[:50]
    return api_success(
        hotel=serialize_hotel(hotel),
        security=build_hotel_detail_payload(hotel)["security"],
        sessions=sessions,
        access_logs=[serialize_hotel_activity(log) for log in logs],
    )


@api_login_required
def super_root_hotel_billing_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    payload = build_hotel_detail_payload(hotel)
    return api_success(
        hotel=payload["hotel"],
        subscription=payload["subscription"],
        licenses=payload["modules"],
        invoices=[],
        quota_usage=payload["subscription"]["quota"],
    )


@api_login_required
def super_root_hotel_monitoring_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    payload = build_hotel_detail_payload(hotel)
    return api_success(hotel=payload["hotel"], monitoring=payload["monitoring"], quota=payload["subscription"]["quota"])


@api_login_required
def super_root_hotel_audit_logs_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    q = (request.GET.get("q") or "").strip()
    page = max(int(request.GET.get("page") or 1), 1)
    page_size = min(max(int(request.GET.get("page_size") or 25), 1), 100)
    logs = ActivityLog.objects.select_related("user").filter(hotel=hotel).order_by("-created_at", "-id")
    if q:
        logs = logs.filter(Q(action__icontains=q) | Q(description__icontains=q) | Q(module__icontains=q) | Q(user__username__icontains=q))
    paginator = Paginator(logs, page_size)
    current = paginator.get_page(page)
    return api_success(
        hotel=serialize_hotel(hotel),
        audit_logs=[serialize_hotel_activity(log) for log in current.object_list],
        pagination={
            "page": current.number,
            "page_size": page_size,
            "total": paginator.count,
            "pages": paginator.num_pages,
            "has_next": current.has_next(),
            "has_previous": current.has_previous(),
        },
    )


@api_login_required
def super_root_hotel_audit_export_api(request, hotel_id):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    hotel = get_super_root_hotel(hotel_id)
    logs = ActivityLog.objects.select_related("user").filter(hotel=hotel).order_by("-created_at", "-id")[:1000]
    rows = [
        {
            "created_at": log.created_at.isoformat() if log.created_at else "",
            "action": log.action,
            "module": log.module,
            "severity": log.severity,
            "actor": log.user.username if log.user_id else "system",
            "description": log.description,
        }
        for log in logs
    ]
    SuperRootAuditService.critical(request=request, actor=request.user, action="hotel.audit_export", target=hotel, severity="warning")
    return csv_response(f"hotel-{hotel.id}-audit-logs.csv", rows, ["created_at", "action", "module", "severity", "actor", "description"])


def parse_confirmation_payload(request):
    payload = parse_json_body_or_empty(request)
    if payload is None:
        return None, api_error(detail="JSON invalide.", http_status=400, code="invalid_json")
    confirmation = payload.get("confirmation") or {"confirmed": bool(payload.get("confirmed")), "phrase": payload.get("phrase")}
    return payload, confirmation


@api_login_required
def super_root_hotel_suspend_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    payload, confirmation = parse_confirmation_payload(request)
    if payload is None:
        return confirmation
    hotel = get_super_root_hotel(hotel_id)
    confirmation_error = require_critical_confirmation(
        request,
        action=SuperRootSecurityPolicyService.ACTION_HOTEL_SUSPEND,
        confirmation=confirmation,
        target=hotel,
    )
    if confirmation_error is not None:
        return confirmation_error
    with transaction.atomic():
        hotel.is_active = False
        hotel.save(update_fields=["is_active", "updated_at"])
        subscription = getattr(hotel, "subscription", None)
        if subscription and subscription.status != HotelSubscription.Status.SUSPENDED:
            subscription.status = HotelSubscription.Status.SUSPENDED
            subscription.save(update_fields=["status", "updated_at"])
    SuperRootAuditService.critical(
        request=request,
        actor=request.user,
        action="hotel.suspend",
        target=hotel,
        metadata={"reason": payload.get("reason", ""), "hotel_id": hotel.id},
        severity="critical",
    )
    return api_success(message="Hotel suspendu.", **build_hotel_detail_payload(get_super_root_hotel(hotel_id)))


@api_login_required
def super_root_hotel_reactivate_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    payload, confirmation = parse_confirmation_payload(request)
    if payload is None:
        return confirmation
    hotel = get_super_root_hotel(hotel_id)
    confirmation_error = require_critical_confirmation(
        request,
        action=SuperRootSecurityPolicyService.ACTION_HOTEL_SUSPEND,
        confirmation=confirmation,
        target=hotel,
    )
    if confirmation_error is not None:
        return confirmation_error
    with transaction.atomic():
        hotel.is_active = True
        hotel.save(update_fields=["is_active", "updated_at"])
        subscription = getattr(hotel, "subscription", None)
        if subscription and subscription.status == HotelSubscription.Status.SUSPENDED:
            subscription.status = HotelSubscription.Status.ACTIVE
            subscription.save(update_fields=["status", "updated_at"])
    SuperRootAuditService.critical(
        request=request,
        actor=request.user,
        action="hotel.reactivate",
        target=hotel,
        metadata={"reason": payload.get("reason", ""), "hotel_id": hotel.id},
        severity="warning",
    )
    return api_success(message="Hotel reactive.", **build_hotel_detail_payload(get_super_root_hotel(hotel_id)))


@api_login_required
def super_root_hotel_maintenance_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    payload, confirmation = parse_confirmation_payload(request)
    if payload is None:
        return confirmation
    hotel = get_super_root_hotel(hotel_id)
    confirmation_error = require_critical_confirmation(
        request,
        action=SuperRootSecurityPolicyService.ACTION_MAINTENANCE,
        confirmation=confirmation,
        target=hotel,
    )
    if confirmation_error is not None:
        return confirmation_error
    SuperRootAuditService.critical(
        request=request,
        actor=request.user,
        action="hotel.maintenance",
        target=hotel,
        metadata={"reason": payload.get("reason", ""), "hotel_id": hotel.id},
        severity="warning",
    )
    return api_success(message="Hotel marque en maintenance.", **build_hotel_detail_payload(hotel))


@api_login_required
def super_root_users_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="users.list")
    queryset = User.objects.select_related("organization", "hotel").order_by("username")
    return list_response("users", queryset, serialize_user)


@api_login_required
def super_root_roles_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="roles.list")
    roles = [
        {
            "id": role.id,
            "code": role.code,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "is_active": role.is_active,
        }
        for role in IAMRole.objects.order_by("code")[:200]
    ]
    return api_success(roles=roles, count=IAMRole.objects.count())


@api_login_required
def super_root_permissions_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="permissions.list")
    permissions = [
        {
            "id": permission.id,
            "code": permission.code,
            "module_code": permission.module_code,
            "action": permission.action,
            "description": permission.description,
            "is_active": permission.is_active,
        }
        for permission in IAMPermission.objects.order_by("module_code", "action", "code")[:500]
    ]
    return api_success(permissions=permissions, count=IAMPermission.objects.count())


@api_login_required
def super_root_modules_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="modules.list")
    queryset = ModuleLicenseService.list_modules().annotate(licenses_count=Count("licenses", distinct=True))
    return list_response("modules", queryset, serialize_module)


@api_login_required
def super_root_licenses_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="licenses.list")
    queryset = ModuleLicenseService.list_licenses()
    return list_response("licenses", queryset, serialize_license)


@api_login_required
def super_root_audit_logs_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="audit_logs.view", severity="warning")
    q = (request.GET.get("q") or "").strip()
    source = (request.GET.get("source") or "all").strip()
    severity = (request.GET.get("severity") or "").strip()
    event_type = (request.GET.get("type") or "").strip()
    page = max(int(request.GET.get("page") or 1), 1)
    page_size = min(max(int(request.GET.get("page_size") or 25), 1), 100)

    rows = []
    if source in {"all", "activity"}:
        activity = ActivityLog.objects.select_related("user", "hotel").order_by("-created_at", "-id")
        if q:
            activity = activity.filter(
                Q(action__icontains=q)
                | Q(description__icontains=q)
                | Q(module__icontains=q)
                | Q(object_reference__icontains=q)
                | Q(user__username__icontains=q)
            )
        if severity:
            activity = activity.filter(severity=severity)
        if event_type:
            activity = activity.filter(action__icontains=event_type)
        rows.extend(
            {
                "id": f"activity-{log.id}",
                "source": "activity",
                "type": log.action,
                "severity": log.severity,
                "actor": log.user.username if log.user_id else "system",
                "target": log.object_reference,
                "description": log.description,
                "module": log.module,
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
            for log in activity[:500]
        )

    if source in {"all", "platform"}:
        platform_events = PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")
        if q:
            platform_events = platform_events.filter(
                Q(event_type__icontains=q)
                | Q(target_type__icontains=q)
                | Q(target_label__icontains=q)
                | Q(actor__username__icontains=q)
            )
        if event_type:
            platform_events = platform_events.filter(event_type__icontains=event_type)
        platform_rows = []
        for event in platform_events[:500]:
            row = {
                "id": f"platform-{event.id}",
                "source": "platform",
                "type": event.event_type,
                "severity": audit_event_severity(event),
                "actor": event.actor.username if event.actor_id else "system",
                "target": event.target_label,
                "description": event.target_type,
                "module": "platform",
                "created_at": event.created_at.isoformat() if event.created_at else "",
            }
            if not severity or row["severity"] == severity:
                platform_rows.append(row)
        rows.extend(platform_rows)

    rows.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    if request.GET.get("export") == "csv":
        return csv_response(
            "super-root-audit-logs.csv",
            rows,
            ["created_at", "source", "type", "severity", "actor", "target", "module", "description"],
        )

    paginator = Paginator(rows, page_size)
    current = paginator.get_page(page)
    return api_success(
        audit_logs=list(current.object_list),
        pagination={
            "page": current.number,
            "page_size": page_size,
            "total": paginator.count,
            "pages": paginator.num_pages,
            "has_next": current.has_next(),
            "has_previous": current.has_previous(),
        },
        filters={"q": q, "source": source, "severity": severity, "type": event_type},
    )


@api_login_required
def super_root_security_alerts_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="security_alerts.view")
    security = SuperRootSecurityService.review()
    dashboard = SuperRootDashboardService.build()
    return api_success(
        security_alerts=dashboard.get("alerts", []),
        sensitive_users_without_2fa=security.get("sensitive_users_without_2fa", []),
        locked_users=security.get("locked_users", []),
    )


@api_login_required
def super_root_system_settings_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="system_settings.view")
    return api_success(
        system_settings={
            "debug": settings.DEBUG,
            "timezone": settings.TIME_ZONE,
            "language_code": settings.LANGUAGE_CODE,
            "auth_user_model": settings.AUTH_USER_MODEL,
            "tenancy_strict_modules": getattr(settings, "TENANCY_STRICT_MODULES", {}),
            "media_url": settings.MEDIA_URL,
            "database_engine": settings.DATABASES.get("default", {}).get("ENGINE", ""),
            "hotel_settings_count": HotelSettings.objects.count(),
        }
    )


@api_login_required
def super_root_security_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="security.view")
    return api_success(security=SuperRootSecurityService.review())


@api_login_required
def super_root_monitoring_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="monitoring.view")
    return api_success(monitoring=SuperRootMonitoringService.snapshot())


@api_login_required
def super_root_monitoring_live_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    monitoring = SuperRootMonitoringService.live_snapshot()
    return api_success(
        monitoring=monitoring,
        monitoring_summary=SuperRootDashboardService._monitoring_summary(monitoring),
    )


@api_login_required
def super_root_security_session_revoke_api(request, session_id):
    if request.method != "DELETE":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied

    payload = parse_json_body_or_empty(request)
    if payload is None:
        return api_error(detail="JSON invalide.", http_status=400, code="invalid_json")

    session = SuperRootSecurityService.active_super_root_sessions().filter(pk=session_id).first()
    if session is None:
        SuperRootAuditService.denied(
            request=request,
            actor=request.user,
            action="security.session_revoke.denied",
            reason="session_not_found",
            metadata={"session_id": session_id},
        )
        return api_error(detail="Session Super Root introuvable.", http_status=404, code="session_not_found")

    confirmation_error = require_critical_confirmation(
        request,
        action=SuperRootSecurityPolicyService.ACTION_SESSION_REVOKE,
        confirmation=payload.get("confirmation"),
        target=session.user,
    )
    if confirmation_error is not None:
        return confirmation_error

    session = SuperRootSecurityService.revoke_super_root_session(session_id)

    SuperRootAuditService.critical(
        request=request,
        actor=request.user,
        action="security.session_revoke",
        target=session.user,
        metadata={
            "session_id": session.id,
            "target_username": session.user.username,
            "target_ip_address": session.ip_address,
            "target_device_name": session.device_name,
        },
        severity="warning",
    )
    return api_success(message="Session Super Root revoquee.")


@api_login_required
def super_root_maintenance_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="maintenance.view")
    return api_success(
        maintenance=SuperRootMaintenanceService.status(),
        readiness=SuperRootMaintenanceService.readiness(),
    )


@api_login_required
def super_root_maintenance_run_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="JSON invalide.", http_status=400, code="invalid_json")

    serializer = SuperRootMaintenanceRunSerializer(data=payload)
    if not serializer.is_valid():
        SuperRootAuditService.denied(
            request=request,
            actor=request.user,
            action="maintenance.run.invalid",
            reason="validation_error",
            metadata={"errors": serializer.errors},
        )
        return api_error(
            detail="Les donnees envoyees sont invalides.",
            http_status=400,
            code="validation_error",
            errors=serializer.errors,
        )

    confirmation_error = None
    if not serializer.validated_data.get("dry_run", True):
        confirmation_error = require_critical_confirmation(
            request,
            action=SuperRootSecurityPolicyService.ACTION_MAINTENANCE,
            confirmation=serializer.validated_data.get("confirmation"),
        )
    if confirmation_error is not None:
        return confirmation_error

    try:
        SuperRootAuditService.critical(
            request=request,
            actor=request.user,
            action="maintenance.run",
            metadata={
                "maintenance_action": serializer.validated_data["action"],
                "dry_run": serializer.validated_data.get("dry_run", True),
            },
            severity="warning" if serializer.validated_data.get("dry_run", True) else "critical",
        )
        result = SuperRootMaintenanceService.run_action(
            serializer.validated_data["action"],
            actor=request.user,
            dry_run=serializer.validated_data.get("dry_run", True),
        )
    except ValueError as exc:
        SuperRootAuditService.denied(
            request=request,
            actor=request.user,
            action="maintenance.run.denied",
            reason=str(exc),
            metadata={"payload": payload},
        )
        return api_error(detail=str(exc), http_status=400, code="unknown_maintenance_action")
    return api_success(message="Action de maintenance executee.", result=result)


@api_login_required
def super_root_backups_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")
    denied = require_super_root(request)
    if denied is not None:
        return denied
    SuperRootAuditService.access(request=request, actor=request.user, action="backups.view", severity="warning")
    return api_success(
        backups={
            "configured": False,
            "provider": "",
            "last_backup_at": None,
            "message": "Facade prete. Branchez ici le service de sauvegarde quand l'infrastructure backup sera disponible.",
        }
    )
