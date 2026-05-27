import json
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.core.api_responses import api_error, api_success
from apps.core.api_views import api_login_required, module_permission_required
from apps.platform_admin.serializers import (
    ClientSaaSCommandCardSerializer,
    ClientSaaSCommandCenterSerializer,
    HotelSubscriptionSerializer,
    ModuleCommandCardSerializer,
    ModuleCommandCenterSerializer,
    PlatformCommandCenterSerializer,
    PlatformAuditEventSerializer,
    PlatformAdminUserResetAccessSerializer,
    PlatformAdminUserUpdateSerializer,
    PlatformAdminUserWriteSerializer,
    HotelPlatformCardSerializer,
    PlatformHotelAdminOnboardingSerializer,
    PlatformHotelSerializer,
    PlatformHotelSubscriptionWriteSerializer,
    PlatformHotelWriteSerializer,
    PlatformLicenseRenewSerializer,
    PlatformLicenseSerializer,
    PlatformLicenseWriteSerializer,
    PlatformModuleAccessCheckSerializer,
    PlatformModuleSerializer,
    PlatformModuleWriteSerializer,
    PlatformOnboardingBundleSerializer,
    PlatformOrganizationSerializer,
    PlatformOrganizationWriteSerializer,
    PlatformSecurityReviewSerializer,
    PlatformSubscriptionLifecycleRunSerializer,
    PlatformSubscriptionPlanChangeSerializer,
    PlatformSubscriptionRenewSerializer,
    PlatformUserSerializer,
    SubscriptionPlanSerializer,
    SubscriptionPlanWriteSerializer,
)
from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, PlatformLicense, PlatformModule, SubscriptionPlan
from apps.licensing.services.module_license_service import ModuleLicenseService
from apps.licensing.services.subscription_service import SubscriptionService
from apps.platform_admin.services import (
    build_platform_dashboard_payload,
    create_platform_audit_event,
    list_platform_admin_users,
    list_platform_audit_events,
    list_platform_hotels,
    list_platform_organizations,
    onboard_platform_bundle,
)
from apps.guests.pagination import build_paginated_payload
from apps.audit_logs.models import ActivityLog
from apps.audit_logs.services import AuditLogService
from apps.iam.services.permission_service import PermissionService
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User, UserSession
from apps.users.services import create_hotel_admin_user, create_platform_admin_user
from apps.users.serializers import UserSerializer

change_platform_subscription_plan = SubscriptionService.change_plan
list_platform_subscriptions = SubscriptionService.list
process_subscription_lifecycle = SubscriptionService.process_lifecycle
renew_platform_subscription = SubscriptionService.renew

list_platform_licenses = ModuleLicenseService.list_licenses
list_platform_modules = ModuleLicenseService.list_modules
platform_module_access_allowed = ModuleLicenseService.access_allowed
renew_platform_license = ModuleLicenseService.renew
suspend_platform_license = ModuleLicenseService.suspend


def require_platform_admin_response(request):
    if getattr(request.user, "is_platform_admin", False) or getattr(request.user, "is_super_root", False):
        return None
    return api_error(
        detail="Seul un administrateur plateforme peut acceder a cette fonctionnalite.",
        http_status=403,
        module="platform_security",
        code="platform_admin_required",
    )


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def serializer_error_response(serializer):
    return api_error(
        detail="Les donnees envoyees sont invalides.",
        http_status=400,
        code="validation_error",
        errors=serializer.errors,
    )


def success_for_subscription(subscription, message, extra=None):
    payload = {"message": message, "subscription": HotelSubscriptionSerializer(subscription).data}
    if extra:
        payload.update(extra)
    return api_success(**payload)


def _paginate(request, queryset, serializer_class):
    return build_paginated_payload(request, queryset, serialize_item=lambda obj: serializer_class(obj).data)


def _parse_bool(value):
    if value == "true":
        return True
    if value == "false":
        return False
    return None


@api_login_required
@module_permission_required("platform_security", action="view")
def platform_dashboard_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    return api_success(**build_platform_dashboard_payload())


@api_login_required
@module_permission_required("platform_hotels", action="create")
def platform_onboarding_bundle_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformOnboardingBundleSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    result = onboard_platform_bundle(actor=request.user, **serializer.validated_data)
    return api_success(
        http_status=201,
        message="Onboarding complet realise.",
        organization=PlatformOrganizationSerializer(result["organization"]).data,
        hotel=PlatformHotelSerializer(result["hotel"]).data,
        user=UserSerializer(result["admin_user"], context={"request": request}).data,
        subscription=HotelSubscriptionSerializer(result["subscription"]).data,
    )


@api_login_required
@module_permission_required("platform_organizations")
def platform_organizations_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        qs = list_platform_organizations(
            search=(request.GET.get("search") or "").strip(),
            is_active=_parse_bool(request.GET.get("is_active")),
        )
        return api_success(**_paginate(request, qs, PlatformOrganizationSerializer))

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformOrganizationWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    organization = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ORGANIZATION_CREATED,
        target=organization,
        metadata={"slug": organization.slug, "is_active": organization.is_active},
    )
    output_serializer = PlatformOrganizationSerializer(organization)
    return api_success(http_status=201, message="Organisation creee.", organization=output_serializer.data)


@api_login_required
@module_permission_required("platform_organizations", action="update")
def platform_organization_detail_api(request, organization_id):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    organization = get_object_or_404(Organization, pk=organization_id)

    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformOrganizationWriteSerializer(organization, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    organization = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ORGANIZATION_UPDATED,
        target=organization,
        metadata={
            "slug": organization.slug,
            "status": organization.status,
            "is_active": organization.is_active,
        },
    )
    organization = list_platform_organizations().get(pk=organization.pk)
    return api_success(message="Organisation mise a jour.", organization=PlatformOrganizationSerializer(organization).data)


@api_login_required
@module_permission_required("platform_organizations", action="view")
def platform_clients_saas_command_center_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    organizations_qs = Organization.objects.prefetch_related(
        "hotels",
        "hotel_subscriptions__plan",
        "users",
    ).order_by("name", "-id")

    clients_data = ClientSaaSCommandCardSerializer(organizations_qs, many=True).data

    total = organizations_qs.count()
    actives = sum(1 for client in clients_data if client["statut_display"] == "Active")
    suspendues = sum(1 for client in clients_data if client["statut_display"] == "Suspendue")
    hotels_total = sum(client["hotels_count"] for client in clients_data)
    abonnements_actifs = sum(client["abonnements_actifs"] for client in clients_data)

    critiques = sum(1 for client in clients_data if client["sante_statut"] == "critique")
    attentions = sum(1 for client in clients_data if client["sante_statut"] == "attention")
    sans_admin = sum(
        1 for client in clients_data
        if client["admins_count"] == 0 and client["hotels_count"] > 0
    )

    score = 100
    score -= min(30, critiques * 15)
    score -= min(20, attentions * 5)
    score -= min(10, sans_admin * 3)
    score -= min(10, suspendues * 5)
    score = max(0, score)

    if score >= 90:
        score_label = "Excellent"
        score_description = "Portefeuille en excellent etat"
    elif score >= 70:
        score_label = "Bon"
        score_description = "Quelques points a surveiller"
    elif score >= 50:
        score_label = "Attention"
        score_description = "Plusieurs clients necessitent une action"
    else:
        score_label = "Critique"
        score_description = "Actions urgentes requises sur le portefeuille"

    sans_abo = sum(
        1 for client in clients_data
        if client["abonnements_actifs"] == 0 and client["hotels_count"] > 0
    )
    quota_attention = sum(
        1 for client in clients_data
        if 60 <= client["quota_pct"] < 90
    )
    quota_critique = sum(
        1 for client in clients_data
        if client["quota_pct"] >= 90
    )

    checklist = [
        {
            "id": "suspendues",
            "label": "Organisations suspendues",
            "description": (
                "Aucune organisation suspendue"
                if suspendues == 0
                else f"{suspendues} organisation(s) suspendue(s) - action requise"
            ),
            "statut": "critique" if suspendues > 0 else "sain",
            "count": suspendues,
        },
        {
            "id": "admins",
            "label": "Admins hotels manquants",
            "description": (
                "Toutes les organisations ont un admin hotel"
                if sans_admin == 0
                else f"{sans_admin} organisation(s) sans admin hotel cree"
            ),
            "statut": "attention" if sans_admin > 0 else "sain",
            "count": sans_admin,
        },
        {
            "id": "quotas",
            "label": "Quota en attention",
            "description": (
                "Aucun quota en zone d'alerte"
                if quota_attention == 0 and quota_critique == 0
                else f"{quota_critique} critique(s) - {quota_attention} en attention"
            ),
            "statut": "critique" if quota_critique > 0 else "attention" if quota_attention > 0 else "sain",
            "count": quota_critique + quota_attention,
        },
        {
            "id": "abonnements",
            "label": "Abonnements manquants",
            "description": (
                "Tous les hotels ont un abonnement actif"
                if sans_abo == 0
                else f"{sans_abo} organisation(s) avec hotel(s) sans abonnement"
            ),
            "statut": "attention" if sans_abo > 0 else "sain",
            "count": sans_abo,
        },
    ]

    payload = {
        "total": total,
        "actives": actives,
        "suspendues": suspendues,
        "hotels_total": hotels_total,
        "abonnements_actifs": abonnements_actifs,
        "score_sante": score,
        "score_label": score_label,
        "score_description": score_description,
        "clients": list(clients_data),
        "checklist": checklist,
    }
    return api_success(**ClientSaaSCommandCenterSerializer(payload).data)


@api_login_required
@module_permission_required("platform_hotels")
def platform_hotels_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        qs = list_platform_hotels(
            organization_id=request.GET.get("organization") or None,
            is_active=_parse_bool(request.GET.get("is_active")),
            subscription_status=request.GET.get("subscription_status") or None,
            search=(request.GET.get("search") or "").strip(),
        )
        return api_success(**_paginate(request, qs, PlatformHotelSerializer))

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformHotelWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    hotel = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.HOTEL_CREATED,
        target=hotel,
        metadata={
            "organization_id": hotel.organization_id,
            "code": hotel.code,
            "is_active": hotel.is_active,
        },
    )
    output_serializer = PlatformHotelSerializer(hotel)
    return api_success(http_status=201, message="Hotel cree.", hotel=output_serializer.data)


@api_login_required
@module_permission_required("platform_hotels")
def platform_hotels_dashboard_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    hotels_qs = list_platform_hotels()
    hotels_data = HotelPlatformCardSerializer(hotels_qs, many=True, context={"request": request}).data

    hotels_total = hotels_qs.count()
    hotels_actifs = sum(1 for item in hotels_data if item["statut"] == "actif")
    hotels_suspendus = sum(1 for item in hotels_data if item["statut"] == "suspendu")
    admins_total = sum(item["admins_count"] for item in hotels_data)
    utilisateurs_total = sum(item["utilisateurs_actifs"] for item in hotels_data)
    quota_critique_count = sum(1 for item in hotels_data if item["quota_statut"] == "critique")

    severity = {"critique": 0, "warning": 1, "info": 2, "ok": 3}
    alertes = []
    for hotel in hotels_data:
        alerte = hotel.get("alerte")
        if alerte:
            alertes.append(
                {
                    "hotel_nom": hotel["nom"],
                    "hotel_code": hotel["code"],
                    "type": alerte["type"],
                    "message": alerte["msg"],
                }
            )
    alertes.sort(key=lambda item: severity.get(item["type"], 9))
    if not alertes:
        alertes.append(
            {
                "hotel_nom": "Tous les hotels",
                "hotel_code": "",
                "type": "ok",
                "message": "Parc sain - aucune alerte active",
            }
        )

    stats_plans = {}
    stats_quota = {"sain": 0, "attention": 0, "critique": 0, "sans_limite": 0}
    for hotel in hotels_data:
        plan = hotel["plan_nom"] or "Starter"
        stats_plans[plan] = stats_plans.get(plan, 0) + 1
        quota_key = hotel["quota_statut"]
        if quota_key in stats_quota:
            stats_quota[quota_key] += 1

    return api_success(
        hotels_total=hotels_total,
        hotels_actifs=hotels_actifs,
        hotels_suspendus=hotels_suspendus,
        admins_total=admins_total,
        utilisateurs_total=utilisateurs_total,
        quota_critique_count=quota_critique_count,
        hotels=list(hotels_data),
        alertes=alertes[:15],
        stats_plans=stats_plans,
        stats_quota=stats_quota,
    )


@api_login_required
@module_permission_required("platform_hotels")
def platform_hotel_detail_api(request, hotel_id):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    hotel = get_object_or_404(Hotel.objects.select_related("organization", "subscription__plan"), pk=hotel_id)

    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformHotelWriteSerializer(hotel, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    hotel = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.HOTEL_UPDATED,
        target=hotel,
        metadata={"organization_id": hotel.organization_id, "is_active": hotel.is_active},
    )
    output_serializer = PlatformHotelSerializer(hotel)
    return api_success(message="Hotel mis a jour.", hotel=output_serializer.data)


@api_login_required
@module_permission_required("platform_hotels", action="update")
def platform_hotel_suspend_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    hotel = get_object_or_404(Hotel.objects.select_related("organization", "subscription__plan"), pk=hotel_id)
    hotel.is_active = False
    hotel.save(update_fields=["is_active", "updated_at"])

    subscription = getattr(hotel, "subscription", None)
    if subscription and subscription.status != HotelSubscription.Status.SUSPENDED:
        subscription.status = HotelSubscription.Status.SUSPENDED
        subscription.save(update_fields=["status", "updated_at"])

    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.HOTEL_SUSPENDED,
        target=hotel,
        metadata={"subscription_id": getattr(subscription, "id", None)},
    )
    return api_success(message="Hotel suspendu.", hotel=PlatformHotelSerializer(hotel).data)


@api_login_required
@module_permission_required("platform_hotels", action="update")
def platform_hotel_reactivate_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    hotel = get_object_or_404(Hotel.objects.select_related("organization", "subscription__plan"), pk=hotel_id)
    hotel.is_active = True
    hotel.save(update_fields=["is_active", "updated_at"])

    subscription = getattr(hotel, "subscription", None)
    if subscription and subscription.status == HotelSubscription.Status.SUSPENDED:
        subscription.status = HotelSubscription.Status.ACTIVE
        subscription.save(update_fields=["status", "updated_at"])

    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.HOTEL_REACTIVATED,
        target=hotel,
        metadata={"subscription_id": getattr(subscription, "id", None)},
    )
    return api_success(message="Hotel reactive.", hotel=PlatformHotelSerializer(hotel).data)


@api_login_required
@module_permission_required("platform_users", action="create")
def platform_hotel_admin_create_api(request, hotel_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    hotel = get_object_or_404(Hotel.objects.select_related("organization"), pk=hotel_id)
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformHotelAdminOnboardingSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    admin_user = create_hotel_admin_user(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
        organization_id=hotel.organization_id,
        hotel_id=hotel.id,
        first_name=serializer.validated_data.get("first_name", ""),
        last_name=serializer.validated_data.get("last_name", ""),
        email=serializer.validated_data.get("email", ""),
        phone=serializer.validated_data.get("phone", ""),
    )
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.USER_LINKED,
        target=admin_user,
        target_label=admin_user.username,
        metadata={"hotel_id": hotel.id, "organization_id": hotel.organization_id, "scope": "hotel_admin"},
    )
    return api_success(message="Admin hotel cree.", user=UserSerializer(admin_user, context={"request": request}).data)


@api_login_required
@module_permission_required("platform_subscriptions")
def platform_subscription_plans_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        serializer = SubscriptionPlanSerializer(SubscriptionPlan.objects.all().order_by("name", "code"), many=True)
        return api_success(results=serializer.data)

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = SubscriptionPlanWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    plan = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
        target=plan,
        target_label=plan.name,
        metadata={"code": plan.code, "action": "plan_created"},
    )
    return api_success(http_status=201, message="Plan cree.", plan=SubscriptionPlanSerializer(plan).data)


@api_login_required
@module_permission_required("platform_subscriptions")
def platform_subscription_plan_detail_api(request, plan_id):
    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    plan = get_object_or_404(SubscriptionPlan, pk=plan_id)
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = SubscriptionPlanWriteSerializer(plan, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    plan = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
        target=plan,
        target_label=plan.name,
        metadata={"code": plan.code, "action": "plan_updated"},
    )
    return api_success(message="Plan mis a jour.", plan=SubscriptionPlanSerializer(plan).data)


@api_login_required
@module_permission_required("platform_modules")
def platform_modules_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        qs = list_platform_modules(
            search=(request.GET.get("search") or "").strip(),
            is_active=_parse_bool(request.GET.get("is_active")),
        )
        serializer = PlatformModuleSerializer(qs, many=True)
        return api_success(results=serializer.data)

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformModuleWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    module = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.MODULE_CREATED,
        target=module,
        metadata={"code": module.code, "monthly_license_price": str(module.monthly_license_price)},
    )
    return api_success(http_status=201, message="Module cree.", module=PlatformModuleSerializer(module).data)


@api_login_required
@module_permission_required("platform_modules", action="update")
def platform_module_detail_api(request, module_id):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    module = get_object_or_404(PlatformModule, pk=module_id)
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformModuleWriteSerializer(module, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    module = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.MODULE_UPDATED,
        target=module,
        metadata={"code": module.code, "is_active": module.is_active},
    )
    return api_success(message="Module mis a jour.", module=PlatformModuleSerializer(module).data)


@api_login_required
@module_permission_required("platform_modules", action="view")
def platform_modules_command_center_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    modules_qs = PlatformModule.objects.prefetch_related("licenses").order_by("name", "code")
    total_hotels = max(Hotel.objects.count(), 1)
    modules_data = ModuleCommandCardSerializer(modules_qs, many=True).data

    modules_total = len(modules_data)
    modules_actifs = sum(1 for module in modules_data if module["statut_display"] == "Actif")
    modules_inactifs = modules_total - modules_actifs
    hotels_abonnes_total = sum(module["hotels_abonnes"] for module in modules_data)
    taux_adoption_moyen = (
        round(sum(module["taux_adoption_pct"] for module in modules_data) / modules_total, 1)
        if modules_total
        else 0
    )

    attention_count = sum(1 for module in modules_data if module["sante_statut"] == "attention")
    inactif_count = sum(1 for module in modules_data if module["sante_statut"] == "inactif")
    module_by_id = {module.pk: module for module in modules_qs}
    sans_description = sum(
        1 for module_data in modules_data
        if not (getattr(module_by_id.get(module_data["id"]), "description", "") or "").strip()
    )
    sans_prix = sum(
        1 for module_data in modules_data
        if not float(getattr(module_by_id.get(module_data["id"]), "monthly_license_price", 0) or 0)
    )

    score = 100
    score -= min(30, inactif_count * 15)
    score -= min(20, attention_count * 5)
    score -= min(10, sans_description * 2)
    score -= min(10, sans_prix * 2)
    score = max(0, score)

    if score >= 90:
        score_label = "Excellent"
        score_description = "Catalogue en excellent etat"
    elif score >= 70:
        score_label = "Bon"
        score_description = "Quelques modules a surveiller"
    elif score >= 50:
        score_label = "Attention"
        score_description = "Plusieurs modules necessitent une action"
    else:
        score_label = "Critique"
        score_description = "Actions urgentes sur le catalogue"

    adoption_stats = [
        {
            "id": module["id"],
            "nom": module.get("name", ""),
            "hotels_abonnes": module["hotels_abonnes"],
            "taux_adoption_pct": module["taux_adoption_pct"],
            "total_hotels": total_hotels,
        }
        for module in modules_data
    ]

    checklist = [
        {
            "id": "actifs",
            "label": "Modules actifs",
            "description": (
                "Tous les modules sont disponibles a la vente"
                if modules_inactifs == 0
                else f"{modules_inactifs} module(s) inactif(s) - masques du catalogue"
            ),
            "statut": "critique" if modules_inactifs > 0 else "sain",
            "count": modules_inactifs,
        },
        {
            "id": "adoption",
            "label": "Adoption faible",
            "description": (
                "Tous les modules ont une adoption satisfaisante"
                if attention_count == 0
                else f"{attention_count} module(s) avec adoption <20% du parc"
            ),
            "statut": "attention" if attention_count > 0 else "sain",
            "count": attention_count,
        },
        {
            "id": "descriptions",
            "label": "Descriptions manquantes",
            "description": (
                "Tous les modules ont une description"
                if sans_description == 0
                else f"{sans_description} module(s) sans description renseignee"
            ),
            "statut": "info" if sans_description > 0 else "sain",
            "count": sans_description,
        },
        {
            "id": "prix",
            "label": "Prix configures",
            "description": (
                "Tous les modules ont un prix defini"
                if sans_prix == 0
                else f"{sans_prix} module(s) sans prix mensuel"
            ),
            "statut": "attention" if sans_prix > 0 else "sain",
            "count": sans_prix,
        },
    ]

    payload = {
        "modules_total": modules_total,
        "modules_actifs": modules_actifs,
        "modules_inactifs": modules_inactifs,
        "hotels_abonnes_total": hotels_abonnes_total,
        "taux_adoption_moyen": taux_adoption_moyen,
        "score_catalogue": score,
        "score_label": score_label,
        "score_description": score_description,
        "modules": list(modules_data),
        "adoption_stats": adoption_stats,
        "checklist": checklist,
    }
    return api_success(**ModuleCommandCenterSerializer(payload).data)


@api_login_required
@module_permission_required("platform_licenses")
def platform_licenses_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        qs = list_platform_licenses(
            module_id=request.GET.get("module") or None,
            organization_id=request.GET.get("organization") or None,
            hotel_id=request.GET.get("hotel") or None,
            status=request.GET.get("status") or "",
            search=(request.GET.get("search") or "").strip(),
        )
        return api_success(**_paginate(request, qs, PlatformLicenseSerializer))

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformLicenseWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    license_obj = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.LICENSE_CREATED,
        target=license_obj,
        metadata={
            "module_id": license_obj.module_id,
            "organization_id": license_obj.organization_id,
            "hotel_id": license_obj.hotel_id,
            "status": license_obj.status,
        },
    )
    return api_success(http_status=201, message="Licence creee.", license=PlatformLicenseSerializer(license_obj).data)


@api_login_required
@module_permission_required("platform_licenses", action="update")
def platform_license_detail_api(request, license_id):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    license_obj = get_object_or_404(PlatformLicense.objects.select_related("module", "organization", "hotel"), pk=license_id)
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformLicenseWriteSerializer(license_obj, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    license_obj = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.LICENSE_UPDATED,
        target=license_obj,
        metadata={"module_id": license_obj.module_id, "status": license_obj.status},
    )
    return api_success(message="Licence mise a jour.", license=PlatformLicenseSerializer(license_obj).data)


@api_login_required
@module_permission_required("platform_licenses", action="manage")
def platform_license_suspend_api(request, license_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    license_obj = get_object_or_404(PlatformLicense.objects.select_related("module", "organization", "hotel"), pk=license_id)
    payload = parse_json_body(request) or {}
    license_obj = suspend_platform_license(license_obj=license_obj, actor=request.user, note=payload.get("note", ""))
    return api_success(message="Licence suspendue.", license=PlatformLicenseSerializer(license_obj).data)


@api_login_required
@module_permission_required("platform_licenses", action="manage")
def platform_license_renew_api(request, license_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    license_obj = get_object_or_404(PlatformLicense.objects.select_related("module", "organization", "hotel"), pk=license_id)
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformLicenseRenewSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    license_obj = renew_platform_license(
        license_obj=license_obj,
        ends_at=serializer.validated_data["ends_at"],
        actor=request.user,
        note=serializer.validated_data.get("note", ""),
    )
    return api_success(message="Licence renouvelee.", license=PlatformLicenseSerializer(license_obj).data)


@api_login_required
@module_permission_required("platform_licenses", action="view")
def platform_module_access_check_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    serializer = PlatformModuleAccessCheckSerializer(data=request.GET)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    allowed = platform_module_access_allowed(**serializer.validated_data)
    return api_success(
        module_code=serializer.validated_data["module_code"],
        organization_id=serializer.validated_data.get("organization_id"),
        hotel_id=serializer.validated_data.get("hotel_id"),
        allowed=allowed,
    )


@api_login_required
@module_permission_required("platform_subscriptions")
def platform_subscriptions_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        qs = list_platform_subscriptions(
            organization_id=request.GET.get("organization") or None,
            hotel_id=request.GET.get("hotel") or None,
            status=request.GET.get("status") or None,
            plan_id=request.GET.get("plan") or None,
            search=(request.GET.get("search") or "").strip(),
        )
        return api_success(**_paginate(request, qs, HotelSubscriptionSerializer))

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformHotelSubscriptionWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    subscription = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED,
        target=subscription,
        metadata={
            "hotel_id": subscription.hotel_id,
            "plan_id": subscription.plan_id,
            "status": subscription.status,
        },
    )
    output_serializer = HotelSubscriptionSerializer(subscription)
    return api_success(http_status=201, message="Abonnement cree.", subscription=output_serializer.data)


@api_login_required
@module_permission_required("platform_subscriptions")
def platform_subscription_detail_api(request, subscription_id):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    subscription = get_object_or_404(
        HotelSubscription.objects.select_related("organization", "hotel", "plan"),
        pk=subscription_id,
    )

    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformHotelSubscriptionWriteSerializer(subscription, data=payload, partial=True)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    subscription = serializer.save()
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
        target=subscription,
        metadata={"plan_id": subscription.plan_id, "status": subscription.status},
    )
    output_serializer = HotelSubscriptionSerializer(subscription)
    return api_success(message="Abonnement mis a jour.", subscription=output_serializer.data)


@api_login_required
@module_permission_required("platform_subscriptions", action="manage")
def platform_subscription_lifecycle_run_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    payload = parse_json_body(request)
    if payload is None:
        payload = {}

    serializer = PlatformSubscriptionLifecycleRunSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    result = process_subscription_lifecycle()
    processed_ids = result.get("suspended_ids", []) + result.get("expired_ids", [])
    organizations_processed = (
        HotelSubscription.objects.filter(id__in=processed_ids)
        .values("organization_id")
        .distinct()
        .count()
    )
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
        target_type="PlatformSubscriptionLifecycle",
        target_label="Cycle commercial",
        metadata={
            "action": "commercial_cycle_executed",
            "organizations_processed": organizations_processed,
            "suspended_count": result.get("suspended_count", 0),
            "expired_count": result.get("expired_count", 0),
            "processed_at": result.get("processed_at", ""),
        },
    )
    AuditLogService.log_activity(
        request=request,
        user=request.user,
        action=ActivityLog.Action.OTHER,
        module="platform_subscriptions",
        object_type="PlatformSubscriptionLifecycle",
        object_reference="Cycle commercial",
        description=(
            f"Cycle commercial execute par {request.user.username} - "
            f"{organizations_processed} organisation(s) traitee(s)."
        ),
        metadata=result,
        severity=ActivityLog.Severity.WARNING,
    )
    result["organizations_processed"] = organizations_processed
    return api_success(
        message=f"Cycle execute pour {organizations_processed} organisation(s).",
        lifecycle=result,
    )


@api_login_required
@module_permission_required("platform_subscriptions", action="manage")
def platform_subscription_renew_api(request, subscription_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    subscription = get_object_or_404(
        HotelSubscription.objects.select_related("organization", "hotel", "plan"),
        pk=subscription_id,
    )
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformSubscriptionRenewSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    subscription = renew_platform_subscription(
        subscription=subscription,
        duration_days=serializer.validated_data["duration_days"],
        actor=request.user,
        note=serializer.validated_data.get("note", ""),
    )
    return success_for_subscription(subscription, "Abonnement renouvele.")


@api_login_required
@module_permission_required("platform_subscriptions", action="manage")
def platform_subscription_change_plan_api(request, subscription_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    subscription = get_object_or_404(
        HotelSubscription.objects.select_related("organization", "hotel", "plan"),
        pk=subscription_id,
    )
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformSubscriptionPlanChangeSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    subscription, change_kind = change_platform_subscription_plan(
        subscription=subscription,
        new_plan=serializer.validated_data["plan"],
        actor=request.user,
        note=serializer.validated_data.get("note", ""),
    )
    return success_for_subscription(
        subscription,
        f"Plan {change_kind}.",
        extra={"change_kind": change_kind},
    )


@api_login_required
@module_permission_required("platform_users")
def platform_users_api(request):
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if request.method == "GET":
        serializer = PlatformUserSerializer(list_platform_admin_users(), many=True)
        return api_success(results=serializer.data)

    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    if not user_can_manage_platform_users(request.user):
        return api_error(
            detail="Vous n'avez pas les droits suffisants pour creer un administrateur.",
            http_status=403,
            code="permission_denied",
        )

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformAdminUserWriteSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    data = serializer.validated_data
    scope = data["admin_scope"]
    if scope == PlatformAdminUserWriteSerializer.AdminScope.PLATFORM:
        candidate = User(
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )
        if not PermissionService.can_manage_user(request.user, candidate):
            return api_error(
                detail="Vous ne pouvez pas creer un compte de niveau egal ou superieur.",
                http_status=403,
                code="user_hierarchy_denied",
            )
        admin_user = create_platform_admin_user(
            username=data["username"],
            password=data["password"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )
    else:
        organization = data.get("organization")
        hotel = data.get("hotel")
        if scope == PlatformAdminUserWriteSerializer.AdminScope.HOTEL:
            organization = hotel.organization

        candidate = User(
            username=data["username"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            role=User.Role.ADMIN,
            is_active=True,
            organization=organization,
            hotel=hotel,
        )
        if not PermissionService.can_manage_user(request.user, candidate):
            return api_error(
                detail="Vous ne pouvez pas creer un compte de niveau egal ou superieur.",
                http_status=403,
                code="user_hierarchy_denied",
            )
        admin_user = candidate
        admin_user.set_password(data["password"])
        admin_user.save()

    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ADMIN_CREATED,
        target=admin_user,
        target_label=admin_user.username,
        metadata={
            "admin_scope": scope,
            "organization_id": admin_user.organization_id,
            "hotel_id": admin_user.hotel_id,
        },
    )
    return api_success(
        http_status=201,
        message="Administrateur cree.",
        user=PlatformUserSerializer(admin_user).data,
    )


def user_can_manage_platform_users(user):
    return bool(getattr(user, "is_super_root", False) or getattr(user, "is_super_admin_platform", False))


def _platform_user_status_response(request, user_id, *, is_active):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    if not user_can_manage_platform_users(request.user):
        return api_error(
            detail="Vous n'avez pas les droits suffisants pour modifier le statut d'un administrateur.",
            http_status=403,
            code="permission_denied",
        )

    target_user = get_object_or_404(User.objects.select_related("organization", "hotel"), pk=user_id)
    if not PermissionService.can_manage_user(request.user, target_user):
        return api_error(
            detail="Vous ne pouvez pas modifier un compte de niveau egal ou superieur.",
            http_status=403,
            code="user_hierarchy_denied",
        )

    previous_status = target_user.is_active
    if previous_status != is_active:
        target_user.is_active = is_active
        target_user.save(update_fields=["is_active"])
        if not is_active:
            UserSession.objects.filter(user=target_user, is_active=True).update(
                is_active=False,
                revoked_at=timezone.now(),
            )

    action = "admin_activated" if is_active else "admin_deactivated"
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ADMIN_UPDATED,
        target=target_user,
        target_label=target_user.username,
        metadata={
            "action": action,
            "admin_scope": "platform" if target_user.is_platform_admin else "hotel",
            "previous_is_active": previous_status,
            "is_active": target_user.is_active,
            "sessions_revoked": not is_active,
        },
    )
    return api_success(
        message=f"Administrateur {'active' if is_active else 'desactive'}.",
        user=PlatformUserSerializer(target_user).data,
    )


@api_login_required
@module_permission_required("platform_users", action="update")
def platform_user_detail_api(request, user_id):
    if request.method != "PATCH":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    target_user = get_object_or_404(User.objects.select_related("organization", "hotel"), pk=user_id)
    if not PermissionService.can_manage_user(request.user, target_user):
        return api_error(
            detail="Vous ne pouvez pas modifier un compte de niveau egal ou superieur.",
            http_status=403,
            code="user_hierarchy_denied",
        )
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformAdminUserUpdateSerializer(data=payload, context={"target_user": target_user})
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    for field, value in serializer.validated_data.items():
        setattr(target_user, field, value)
    target_user.save(update_fields=[*serializer.validated_data.keys()])

    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ADMIN_UPDATED,
        target=target_user,
        target_label=target_user.username,
        metadata=serializer.validated_data,
    )
    return api_success(message="Administrateur mis a jour.", user=PlatformUserSerializer(target_user).data)


@api_login_required
@module_permission_required("platform_users", action="update")
def platform_user_activate_api(request, user_id):
    return _platform_user_status_response(request, user_id, is_active=True)


@api_login_required
@module_permission_required("platform_users", action="update")
def platform_user_deactivate_api(request, user_id):
    return _platform_user_status_response(request, user_id, is_active=False)


@api_login_required
@module_permission_required("platform_users", action="manage")
def platform_user_reset_access_api(request, user_id):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    target_user = get_object_or_404(User.objects.select_related("organization", "hotel"), pk=user_id)
    if not PermissionService.can_manage_user(request.user, target_user):
        return api_error(
            detail="Vous ne pouvez pas reinitialiser un compte de niveau egal ou superieur.",
            http_status=403,
            code="user_hierarchy_denied",
        )
    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformAdminUserResetAccessSerializer(data=payload, context={"target_user": target_user})
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    target_user.set_password(serializer.validated_data["password"])
    target_user.save(update_fields=["password"])
    create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.ADMIN_ACCESS_RESET,
        target=target_user,
        target_label=target_user.username,
        metadata={"admin_scope": "platform" if target_user.is_platform_admin else "hotel"},
    )
    return api_success(message="Acces administrateur reinitialise.")


@api_login_required
@module_permission_required("platform_security", action="view")
def platform_security_events_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    serializer = PlatformAuditEventSerializer(
        list_platform_audit_events(
            limit=int(request.GET.get("limit", 20) or 20),
            event_type=request.GET.get("event_type", ""),
            target_type=request.GET.get("target_type", ""),
            search=request.GET.get("search", ""),
        ),
        many=True,
    )
    return api_success(results=serializer.data)


@api_login_required
@module_permission_required("platform_security", action="manage")
def platform_security_review_api(request):
    if request.method != "POST":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    payload = parse_json_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    serializer = PlatformSecurityReviewSerializer(data=payload)
    if not serializer.is_valid():
        return serializer_error_response(serializer)

    event = create_platform_audit_event(
        actor=request.user,
        event_type=PlatformAuditEvent.EventType.SECURITY_REVIEW,
        target_type=serializer.validated_data["target_type"],
        target_id=serializer.validated_data.get("target_id"),
        target_label=serializer.validated_data["target_label"],
        metadata={
            "note": serializer.validated_data["note"],
            "severity": serializer.validated_data["severity"],
        },
    )
    return api_success(message="Revue securite enregistree.", event=PlatformAuditEventSerializer(event).data)


def _event_entity_label(target_type):
    target = (target_type or "").lower()
    if "organization" in target or "organisation" in target:
        return "Organisation"
    if "hotel" in target:
        return "Hotel"
    if "user" in target or "admin" in target:
        return "User"
    if "subscription" in target or "abonnement" in target:
        return "Abonnement"
    if "license" in target or "security" in target or "securite" in target:
        return "Securite"
    return target_type or "Plateforme"


def _platform_event_description(event):
    if event.target_label:
        return event.target_label
    metadata = event.metadata or {}
    for key in ("description", "detail", "note"):
        if metadata.get(key):
            return str(metadata[key])
    return event.get_event_type_display()


@api_login_required
@module_permission_required("platform_security", action="view")
def platform_command_center_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    now = timezone.now()
    in_7_days = now + timedelta(days=7)
    in_30_days = now + timedelta(days=30)

    organizations_total = Organization.objects.count()
    hotels_qs = Hotel.objects.select_related("organization", "subscription__plan").prefetch_related("users")
    hotels_actifs = hotels_qs.filter(is_active=True).count()
    hotels_inactifs = hotels_qs.filter(is_active=False).count()

    subscriptions_qs = HotelSubscription.objects.select_related("hotel", "organization", "plan")
    abo_actifs = subscriptions_qs.filter(status=HotelSubscription.Status.ACTIVE).count()
    abo_essai = subscriptions_qs.filter(status=HotelSubscription.Status.TRIAL).count()
    abo_suspendus = subscriptions_qs.filter(status=HotelSubscription.Status.SUSPENDED).count()
    abo_expires = subscriptions_qs.filter(status=HotelSubscription.Status.EXPIRED).count()
    abo_total = subscriptions_qs.count()
    taux_retention = round((abo_actifs / abo_total) * 100, 1) if abo_total else 0

    admins_plateforme = User.objects.filter(is_platform_admin=True, is_active=True).count()
    admins_hotels = User.objects.filter(
        role=User.Role.ADMIN,
        is_platform_admin=False,
        hotel__isnull=False,
        is_active=True,
    ).count()

    quota_critique_count = 0
    hotels_proche_quota = 0
    hotels_hors_quota = 0
    hotels_sans_admin = 0

    for hotel in hotels_qs:
        subscription = getattr(hotel, "subscription", None)
        plan = getattr(subscription, "plan", None)
        quota = getattr(plan, "max_users", None)
        active_users = hotel.users.filter(is_active=True).count()

        if quota and quota > 0:
            usage_pct = (active_users / quota) * 100
            if usage_pct >= 100:
                hotels_hors_quota += 1
                quota_critique_count += 1
            elif usage_pct >= 80:
                hotels_proche_quota += 1

        has_admin = hotel.users.filter(
            role=User.Role.ADMIN,
            is_platform_admin=False,
            is_active=True,
        ).exists()
        if not has_admin:
            hotels_sans_admin += 1

    essais_expirants_7j = subscriptions_qs.filter(
        status=HotelSubscription.Status.TRIAL,
        trial_ends_at__lte=in_7_days,
        trial_ends_at__gte=now,
    ).count()
    contrats_a_renouveler = subscriptions_qs.filter(
        status=HotelSubscription.Status.ACTIVE,
        ends_at__lte=in_30_days,
        ends_at__gte=now,
    ).count()

    score = 100
    if hotels_inactifs > 0:
        score -= min(20, hotels_inactifs * 5)
    if quota_critique_count > 0:
        score -= min(20, quota_critique_count * 10)
    if hotels_proche_quota > 0:
        score -= min(10, hotels_proche_quota * 3)
    if abo_expires > 0:
        score -= min(15, abo_expires * 5)
    if abo_suspendus > 0:
        score -= min(10, abo_suspendus * 3)
    if essais_expirants_7j > 0:
        score -= min(10, essais_expirants_7j * 2)
    if contrats_a_renouveler > 0:
        score -= min(5, contrats_a_renouveler)
    if hotels_sans_admin > 0:
        score -= min(5, hotels_sans_admin * 2)
    score = max(0, score)

    if score >= 90:
        score_label = "Excellent"
        score_description = "Parc en excellent etat - aucune alerte critique active"
    elif score >= 70:
        score_label = "Bon"
        score_description = "Quelques points a surveiller"
    elif score >= 50:
        score_label = "Attention"
        score_description = "Plusieurs indicateurs necessitent une action"
    else:
        score_label = "Critique"
        score_description = "Actions urgentes requises sur le parc"

    checklist = [
        {
            "id": "quotas",
            "label": "Quotas utilisateurs",
            "description": (
                "Aucun hotel >80% de son quota"
                if hotels_proche_quota == 0 and quota_critique_count == 0
                else f"{quota_critique_count} hotel(s) hors quota - {hotels_proche_quota} proche(s)"
            ),
            "statut": "critique" if quota_critique_count > 0 else "attention" if hotels_proche_quota > 0 else "ok",
            "count": quota_critique_count + hotels_proche_quota,
        },
        {
            "id": "essais",
            "label": "Essais expirants",
            "description": (
                "Aucun essai proche expiration"
                if essais_expirants_7j == 0
                else f"{essais_expirants_7j} essai(s) expire(nt) dans 7j"
            ),
            "statut": "attention" if essais_expirants_7j > 0 else "ok",
            "count": essais_expirants_7j,
        },
        {
            "id": "renouvellements",
            "label": "Renouvellements",
            "description": (
                "Aucun contrat a renouveler"
                if contrats_a_renouveler == 0
                else f"{contrats_a_renouveler} contrat(s) a renouveler (30j)"
            ),
            "statut": "attention" if contrats_a_renouveler > 0 else "ok",
            "count": contrats_a_renouveler,
        },
        {
            "id": "admins",
            "label": "Admins hotels",
            "description": (
                "Tous les hotels ont un admin assigne"
                if hotels_sans_admin == 0
                else f"{hotels_sans_admin} hotel(s) sans admin cree"
            ),
            "statut": "attention" if hotels_sans_admin > 0 else "ok",
            "count": hotels_sans_admin,
        },
        {
            "id": "inactifs",
            "label": "Hotels inactifs",
            "description": (
                "Aucun hotel suspendu"
                if hotels_inactifs == 0
                else f"{hotels_inactifs} hotel(s) suspendu(s) ou ferme(s)"
            ),
            "statut": "critique" if hotels_inactifs > 0 else "ok",
            "count": hotels_inactifs,
        },
    ]

    events = []
    for event in PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")[:10]:
        created_at = timezone.localtime(event.created_at) if event.created_at else None
        actor_name = "systeme"
        if event.actor:
            actor_name = event.actor.get_full_name().strip() or event.actor.username
        events.append(
            {
                "id": event.pk,
                "action": event.get_event_type_display(),
                "description": _platform_event_description(event),
                "acteur": actor_name,
                "type_entite": _event_entity_label(event.target_type),
                "created_at_raw": created_at.isoformat() if created_at else None,
                "created_at_display": created_at.strftime("%d/%m %H:%M") if created_at else "-",
            }
        )

    payload = {
        "score_sante": score,
        "score_label": score_label,
        "score_description": score_description,
        "organisations_total": organizations_total,
        "hotels_actifs": hotels_actifs,
        "hotels_inactifs": hotels_inactifs,
        "abonnements_total": abo_total,
        "admins_plateforme": admins_plateforme,
        "admins_hotels": admins_hotels,
        "quota_critique_count": quota_critique_count,
        "abonnements_actifs": abo_actifs,
        "abonnements_essai": abo_essai,
        "abonnements_suspendus": abo_suspendus,
        "abonnements_expires": abo_expires,
        "taux_retention_pct": taux_retention,
        "checklist": checklist,
        "events": events,
        "essais_expirants_7j": essais_expirants_7j,
        "contrats_a_renouveler": contrats_a_renouveler,
        "hotels_proche_quota": hotels_proche_quota,
        "hotels_hors_quota": hotels_hors_quota,
    }
    return api_success(**PlatformCommandCenterSerializer(payload).data)
