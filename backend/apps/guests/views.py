import json
from datetime import date
from functools import wraps

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.billing.models import ClientInvoice, Payment
from apps.consumptions.models import ClientConsumption
from apps.core.api_views import api_login_required, module_hotel_scope_required, module_license_required, module_permission_required
from apps.guests.models import Guest
from apps.guests.pagination import build_paginated_payload
from apps.guests.serializers import (
    ClientDetailSerializer,
    ClientSerializer,
    consumptions_table_is_available,
    search_clients,
)
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService
from apps.history.services import build_client_timeline_payload
from apps.iam.services.permission_service import PermissionService
from apps.satisfaction.models import ClientSatisfaction
from apps.stays.models import Stay
from apps.tenants.services.tenant_service import TenantService

get_request_hotel = TenantService.get_request_hotel
scope_queryset_to_hotel = TenantService.scope_queryset_to_hotel
log_history = HotelAuditService.log_history


CLIENT_AUDIT_FIELDS = [
    "first_name",
    "last_name",
    "gender",
    "client_type",
    "marital_status",
    "date_of_birth",
    "place_of_birth",
    "profession",
    "phone",
    "secondary_phone",
    "email",
    "address",
    "city",
    "nationality",
    "identity_document_type",
    "identity_document_number",
    "document_issue_date",
    "document_expiry_date",
    "document_issue_place",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relationship",
    "notes",
    "is_active",
    "is_blacklisted",
]


def build_client_audit_snapshot(client):
    snapshot = {}
    for field in CLIENT_AUDIT_FIELDS:
        value = getattr(client, field)
        snapshot[field] = value.isoformat() if hasattr(value, "isoformat") else value
    return snapshot


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValidationError("Requete JSON invalide.")


def build_validation_error(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    if hasattr(error, "messages"):
        return {"non_field_errors": [str(item) for item in error.messages]}
    return {"non_field_errors": [str(error)]}


def parse_history_date(value, label):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({label: "Date invalide."})


def client_queryset_for_request(request):
    return scope_queryset_to_hotel(Guest.objects.all(), request)


def get_client_or_404_payload(request, client_id):
    client = client_queryset_for_request(request).filter(pk=client_id).first()
    if client is None:
        return None, JsonResponse({"detail": "Client introuvable."}, status=404)
    return client, None


def client_permission_context(request):
    return {
        "include_sensitive": PermissionService.user_can_access(request.user, "clients", "update")
        or PermissionService.user_can_access(request.user, "clients", "manage"),
        "include_financial": PermissionService.user_can_access(request.user, "billing", "view"),
        "include_satisfaction": PermissionService.user_can_access(request.user, "satisfaction", "view"),
    }


def hotel_client_module_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if getattr(request.user, "is_platform_admin", False):
            return JsonResponse(
                {
                    "detail": "Le module clients est reserve aux utilisateurs rattaches a un hotel.",
                    "code": "hotel_user_required",
                },
                status=403,
            )
        return view_func(request, *args, **kwargs)

    return wrapped


def apply_client_filter(queryset, filter_key):
    if filter_key == "vip":
        return queryset.filter(client_type=Guest.ClientType.VIP, is_active=True)
    if filter_key == "blacklist":
        return queryset.filter(is_blacklisted=True, is_active=True)
    if filter_key == "missing_contact":
        return queryset.filter(phone="", secondary_phone="", email="", is_active=True)
    if filter_key == "missing_document":
        return queryset.filter(identity_document_number="", is_active=True)
    if filter_key == "archived":
        return queryset.filter(is_active=False)
    return queryset


def build_client_filter_counts(queryset):
    return {
        "all": queryset.filter(is_active=True).count(),
        "vip": queryset.filter(client_type=Guest.ClientType.VIP, is_active=True).count(),
        "blacklist": queryset.filter(is_blacklisted=True, is_active=True).count(),
        "missing_contact": queryset.filter(phone="", secondary_phone="", email="", is_active=True).count(),
        "missing_document": queryset.filter(identity_document_number="", is_active=True).count(),
        "archived": queryset.filter(is_active=False).count(),
    }


def integrity_error_payload():
    return JsonResponse(
        {
            "errors": {
                "non_field_errors": [
                    "Une fiche client existe deja avec ce telephone, cet email ou cette piece d'identite."
                ]
            }
        },
        status=400,
    )


def archive_client(client, request):
    old_values = build_client_audit_snapshot(client)
    client.is_active = False
    client.save(update_fields=["is_active", "updated_at"])
    log_history(
        action_type=HistoryEntry.ActionType.OTHER,
        module="guests",
        entity_type="Guest",
        entity_reference=client.full_name,
        description=f"Client archive : {client.full_name}.",
        actor=request.user,
        request=request,
        hotel=client.hotel,
        metadata={
            "guest_id": client.id,
            "old_values": old_values,
            "new_values": build_client_audit_snapshot(client),
        },
    )


def reactivate_client(client, request):
    old_values = build_client_audit_snapshot(client)
    client.is_active = True
    client.save(update_fields=["is_active", "updated_at"])
    log_history(
        action_type=HistoryEntry.ActionType.STATUS_UPDATED,
        module="guests",
        entity_type="Guest",
        entity_reference=client.full_name,
        description=f"Client reactive : {client.full_name}.",
        actor=request.user,
        request=request,
        hotel=client.hotel,
        metadata={
            "guest_id": client.id,
            "old_values": old_values,
            "new_values": build_client_audit_snapshot(client),
        },
    )


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients")
@require_http_methods(["GET", "POST"])
def clients_api(request):
    active_hotel = get_request_hotel(request)
    if request.method == "GET":
        search = request.GET.get("search", "").strip()
        include_inactive = request.GET.get("include_inactive", "").strip().lower() in {"1", "true", "yes"}
        active_filter = request.GET.get("filter", "all").strip().lower() or "all"
        base_queryset = client_queryset_for_request(request)
        filter_counts = build_client_filter_counts(search_clients(base_queryset, search))
        if not include_inactive and active_filter != "archived":
            base_queryset = base_queryset.filter(is_active=True)
        base_queryset = apply_client_filter(base_queryset, active_filter)
        queryset = (
            search_clients(base_queryset, search)
            .annotate(
                booking_count=Count("bookings", distinct=True),
                stay_count=Count("stays", distinct=True),
                day_use_count=Count("day_uses", distinct=True),
            )
            .order_by("last_name", "first_name", "-id")
        )
        if consumptions_table_is_available():
            queryset = queryset.annotate(consumption_count=Count("consumptions", distinct=True))
        payload = build_paginated_payload(request, queryset, ClientSerializer.serialize)
        payload["search"] = search
        payload["filter"] = active_filter
        payload["filter_counts"] = filter_counts
        return JsonResponse(payload)

    try:
        payload = parse_json_body(request)
        if active_hotel is not None:
            payload["hotel"] = active_hotel
        result = ClientSerializer.validate(payload)
        if result.get("errors"):
            return JsonResponse({"errors": result["errors"]}, status=400)

        with transaction.atomic():
            client = ClientSerializer.save(result["data"])
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="guests",
            entity_type="Guest",
            entity_reference=client.full_name,
            description=f"Client cree : {client.full_name}.",
            actor=request.user,
            request=request,
            hotel=client.hotel,
            metadata={
                "guest_id": client.id,
                "phone": client.phone,
                "email": client.email,
                "new_values": build_client_audit_snapshot(client),
            },
        )
        return JsonResponse(
            {
                "message": "Client cree avec succes.",
                "client": ClientDetailSerializer.serialize(client, include_related=False, **client_permission_context(request)),
                "warnings": result.get("warnings", []),
            },
            status=201,
        )
    except ValidationError as error:
        return JsonResponse({"errors": build_validation_error(error)}, status=400)
    except IntegrityError:
        return integrity_error_payload()


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients")
@require_http_methods(["GET", "PUT", "DELETE"])
def client_detail_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response

    if request.method == "GET":
        return JsonResponse(ClientDetailSerializer.serialize(client, include_related=False, **client_permission_context(request)))

    if request.method == "PUT":
        try:
            payload = parse_json_body(request)
            old_values = build_client_audit_snapshot(client)
            result = ClientSerializer.validate(payload, instance=client)
            if result.get("errors"):
                return JsonResponse({"errors": result["errors"]}, status=400)

            with transaction.atomic():
                client = ClientSerializer.save(result["data"], instance=client)
            new_values = build_client_audit_snapshot(client)
            log_history(
                action_type=HistoryEntry.ActionType.STATUS_UPDATED,
                module="guests",
                entity_type="Guest",
                entity_reference=client.full_name,
                description=f"Client mis a jour : {client.full_name}.",
                actor=request.user,
                request=request,
                hotel=client.hotel,
                metadata={
                    "guest_id": client.id,
                    "phone": client.phone,
                    "email": client.email,
                    "old_values": old_values,
                    "new_values": new_values,
                },
            )
            return JsonResponse(
                {
                    "message": "Client mis a jour avec succes.",
                    "client": ClientDetailSerializer.serialize(client, include_related=False, **client_permission_context(request)),
                    "warnings": result.get("warnings", []),
                }
            )
        except ValidationError as error:
            return JsonResponse({"errors": build_validation_error(error)}, status=400)
        except IntegrityError:
            return integrity_error_payload()

    try:
        archive_client(client, request)
        return JsonResponse({"message": "Client archive avec succes."})
    except ProtectedError:
        return JsonResponse(
            {
                "detail": "Ce client ne peut pas etre supprime car il est lie a des reservations, sejours ou day use."
            },
            status=409,
        )


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients", action="view")
@require_http_methods(["GET"])
def client_history_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response

    try:
        event_types = [value.strip() for value in request.GET.getlist("event_type") if value.strip()]
        if not event_types:
            raw_types = request.GET.get("event_types", "").strip()
            if raw_types:
                event_types = [value.strip() for value in raw_types.split(",") if value.strip()]
        date_from = parse_history_date(request.GET.get("date_from"), "date_from")
        date_to = parse_history_date(request.GET.get("date_to"), "date_to")
        page = int(request.GET.get("page", 1) or 1)
        page_size = int(request.GET.get("page_size", 20) or 20)
    except ValidationError as error:
        return JsonResponse({"errors": build_validation_error(error)}, status=400)
    except ValueError:
        return JsonResponse({"errors": {"page": ["Pagination invalide."]}}, status=400)

    payload = build_client_timeline_payload(
        client,
        event_types=event_types,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    payload["client_id"] = client.id
    payload["client_name"] = client.full_name
    return JsonResponse(payload)


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients", action="delete")
@require_http_methods(["POST"])
def client_archive_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    archive_client(client, request)
    return JsonResponse({"message": "Client archive avec succes."})


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients", action="update")
@require_http_methods(["POST"])
def client_reactivate_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    reactivate_client(client, request)
    return JsonResponse(
        {
            "message": "Client reactive avec succes.",
            "client": ClientDetailSerializer.serialize(client, include_related=False, **client_permission_context(request)),
        }
    )


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("clients")
@module_permission_required("clients", action="view")
@require_http_methods(["GET"])
def client_stays_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    bookings = client.bookings.select_related("room", "room_type").order_by("-created_at")[:20]
    stays = client.stays.select_related("room__room_type", "booking").order_by("-check_in_at", "-id")[:20]
    day_uses = client.day_uses.select_related("room").order_by("-created_at", "-id")[:20]
    return JsonResponse(
        {
            "stay_portfolio": {
                "active_count": client.stays.filter(status=Stay.Status.IN_PROGRESS).count(),
                "completed_count": client.stays.filter(status=Stay.Status.COMPLETED).count(),
                "cancelled_count": client.stays.filter(status=Stay.Status.CANCELLED).count(),
                "total_count": client.stays.count(),
            },
            "booking_history": [ClientDetailSerializer._serialize_booking(item) for item in bookings],
            "stay_history": [ClientDetailSerializer._serialize_stay(item) for item in stays],
            "day_use_history": [ClientDetailSerializer._serialize_day_use(item) for item in day_uses],
        }
    )


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("billing")
@module_permission_required("billing", action="view")
@require_http_methods(["GET"])
def client_payments_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    queryset = Payment.objects.filter(client=client).select_related("stay", "booking", "invoice").order_by("-paid_at", "-id")
    portfolio = {
        "total_count": queryset.exclude(status=Payment.Status.CANCELLED).count(),
        "pending_count": queryset.filter(status=Payment.Status.PENDING).count(),
        "confirmed_count": queryset.filter(status=Payment.Status.PAID).count(),
        "cancelled_count": queryset.filter(status=Payment.Status.CANCELLED).count(),
        "refunded_count": queryset.filter(status=Payment.Status.REFUNDED).count(),
        "confirmed_amount": f"{(queryset.filter(status=Payment.Status.PAID).aggregate(total=Sum('amount'))['total'] or 0):.2f}",
        "pending_amount": f"{(queryset.filter(status=Payment.Status.PENDING).aggregate(total=Sum('amount'))['total'] or 0):.2f}",
    }
    payload = build_paginated_payload(request, queryset, ClientDetailSerializer._serialize_payment)
    payload["payment_portfolio"] = portfolio
    return JsonResponse(payload)


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("billing")
@module_permission_required("billing", action="view")
@require_http_methods(["GET"])
def client_invoices_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    queryset = client.invoices.select_related("stay", "reservation").prefetch_related("items", "payments").order_by("-issued_at", "-id")
    active_queryset = queryset.exclude(status=ClientInvoice.Status.CANCELLED)
    portfolio = {
        "total_count": active_queryset.count(),
        "draft_count": queryset.filter(status=ClientInvoice.Status.DRAFT).count(),
        "issued_count": queryset.filter(status=ClientInvoice.Status.ISSUED).count(),
        "partially_paid_count": queryset.filter(status=ClientInvoice.Status.PARTIALLY_PAID).count(),
        "paid_count": queryset.filter(status=ClientInvoice.Status.PAID).count(),
        "total_amount": f"{(active_queryset.aggregate(total=Sum('total_amount'))['total'] or 0):.2f}",
        "balance_due": f"{(active_queryset.aggregate(total=Sum('balance_due'))['total'] or 0):.2f}",
    }
    payload = build_paginated_payload(request, queryset, ClientDetailSerializer._serialize_invoice)
    payload["invoice_portfolio"] = portfolio
    return JsonResponse(payload)


@api_login_required
@module_hotel_scope_required("guests")
@hotel_client_module_required
@module_license_required("billing")
@module_permission_required("billing", action="view")
@require_http_methods(["GET"])
def client_consumptions_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    queryset = client.consumptions.select_related("service_department", "stay", "reservation", "room").order_by("-service_date", "-id")
    active_queryset = queryset.exclude(status=ClientConsumption.Status.CANCELLED)
    portfolio = {
        "total_count": active_queryset.count(),
        "draft_count": queryset.filter(status=ClientConsumption.Status.DRAFT).count(),
        "posted_count": queryset.filter(status=ClientConsumption.Status.POSTED).count(),
        "billed_count": queryset.filter(status=ClientConsumption.Status.BILLED).count(),
        "paid_count": queryset.filter(payment_status=ClientConsumption.PaymentStatus.PAID).count(),
        "total_amount": f"{(active_queryset.aggregate(total=Sum('total_amount'))['total'] or 0):.2f}",
        "by_service": list(
            active_queryset.values("service_department__name", "service_department__code")
            .annotate(total_amount=Sum("total_amount"), count=Count("id"))
            .order_by("service_department__name")
        ),
    }
    payload = build_paginated_payload(request, queryset, ClientDetailSerializer._serialize_consumption)
    payload["consumption_portfolio"] = portfolio
    return JsonResponse(payload)


@api_login_required
@module_hotel_scope_required("guests")
@module_permission_required("satisfaction", action="view")
@hotel_client_module_required
@require_http_methods(["GET"])
def client_satisfaction_api(request, client_id):
    client, error_response = get_client_or_404_payload(request, client_id)
    if error_response is not None:
        return error_response
    queryset = client.satisfactions.select_related("stay", "consumption", "recorded_by").order_by("-submitted_at", "-id")
    portfolio = {
        "total_count": queryset.count(),
        "average_overall_rating": round(queryset.aggregate(total=Avg("overall_rating"))["total"] or 0, 2),
        "average_recommendation_score": round(queryset.aggregate(total=Avg("recommendation_score"))["total"] or 0, 2),
        "would_recommend_count": queryset.filter(would_recommend=True).count(),
        "dissatisfied_count": queryset.filter(
            satisfaction_level__in=[
                ClientSatisfaction.SatisfactionLevel.DISSATISFIED,
                ClientSatisfaction.SatisfactionLevel.VERY_DISSATISFIED,
            ]
        ).count(),
        "neutral_count": queryset.filter(satisfaction_level=ClientSatisfaction.SatisfactionLevel.NEUTRAL).count(),
        "average_reception_rating": round(queryset.aggregate(total=Avg("reception_rating"))["total"] or 0, 2),
        "average_room_rating": round(queryset.aggregate(total=Avg("room_rating"))["total"] or 0, 2),
        "average_cleanliness_rating": round(queryset.aggregate(total=Avg("cleanliness_rating"))["total"] or 0, 2),
        "average_restaurant_rating": round(queryset.aggregate(total=Avg("restaurant_rating"))["total"] or 0, 2),
        "average_bar_rating": round(queryset.aggregate(total=Avg("bar_rating"))["total"] or 0, 2),
        "average_pool_rating": round(queryset.aggregate(total=Avg("pool_rating"))["total"] or 0, 2),
        "average_spa_rating": round(queryset.aggregate(total=Avg("spa_rating"))["total"] or 0, 2),
        "average_laundry_rating": round(queryset.aggregate(total=Avg("laundry_rating"))["total"] or 0, 2),
    }
    latest = queryset.first()
    portfolio["latest_feedback"] = ClientDetailSerializer._serialize_satisfaction(latest) if latest else None
    payload = build_paginated_payload(request, queryset, ClientDetailSerializer._serialize_satisfaction)
    payload["satisfaction_portfolio"] = portfolio
    return JsonResponse(payload)
