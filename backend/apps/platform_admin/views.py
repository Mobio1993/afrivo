import json

from django.shortcuts import get_object_or_404

from apps.core.api_responses import api_error, api_success
from apps.core.api_views import api_login_required, module_permission_required
from apps.platform_admin.serializers import (
    HotelSubscriptionSerializer,
    PlatformAuditEventSerializer,
    PlatformHotelAdminOnboardingSerializer,
    PlatformHotelSerializer,
    PlatformHotelSubscriptionWriteSerializer,
    PlatformHotelWriteSerializer,
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
from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, SubscriptionPlan
from apps.platform_admin.services import (
    build_platform_dashboard_payload,
    change_platform_subscription_plan,
    create_platform_audit_event,
    list_platform_admin_users,
    list_platform_audit_events,
    list_platform_hotels,
    list_platform_organizations,
    list_platform_subscriptions,
    onboard_platform_bundle,
    process_subscription_lifecycle,
    renew_platform_subscription,
)
from apps.guests.pagination import build_paginated_payload
from apps.tenancy.models import Hotel
from apps.users.services import create_hotel_admin_user
from apps.users.serializers import UserSerializer


def require_platform_admin_response(request):
    if getattr(request.user, "is_platform_admin", False):
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
    return api_success(message="Cycle commercial execute.", lifecycle=result)


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
@module_permission_required("platform_users", action="view")
def platform_users_api(request):
    if request.method != "GET":
        return api_error(detail="Methode non autorisee.", http_status=405, code="method_not_allowed")

    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    serializer = PlatformUserSerializer(list_platform_admin_users(), many=True)
    return api_success(results=serializer.data)


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
