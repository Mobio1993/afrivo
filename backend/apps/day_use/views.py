import json
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.core.api_views import api_login_required, module_hotel_scope_required, module_license_required, module_permission_required
from apps.guests.models import Guest
from apps.guests.pagination import build_paginated_payload
from apps.history.models import HistoryEntry
from apps.iam.services.permission_service import PermissionService
from apps.rooms.models import Room
from apps.tenants.services.tenant_service import TenantService

get_request_hotel = TenantService.get_request_hotel
scope_queryset_to_hotel = TenantService.scope_queryset_to_hotel
validate_objects_belong_to_hotel = TenantService.validate_objects_belong_to_hotel

from apps.day_use.serializers import (
    DayUseDetailSerializer,
    DayUsePaymentSerializer,
    DayUseSerializer,
    serialize_availability_room,
    serialize_history_entry,
)
from apps.day_use.services import (
    DayUseAvailabilityService,
    DayUseConflictService,
    DayUseDashboardService,
    DayUseLifecycleService,
    DayUsePaymentService,
    DayUsePricingService,
    DayUseReceiptService,
    normalize_datetime,
)


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValidationError("Requete JSON invalide.")


def format_validation_error(error):
    if hasattr(error, "message_dict"):
        return {key: [str(item) for item in value] for key, value in error.message_dict.items()}
    if hasattr(error, "messages"):
        return {"non_field_errors": [str(item) for item in error.messages]}
    return {"non_field_errors": [str(error)]}


def require_business_action(request, action_code):
    if PermissionService.can_perform_action(request.user, action_code, strict=True):
        return None
    return JsonResponse(
        {
            "detail": "Permission metier insuffisante pour cette action.",
            "code": "business_permission_denied",
            "action": action_code,
        },
        status=403,
    )


def day_use_queryset(request):
    return scope_queryset_to_hotel(
        DayUse.objects.select_related("guest", "room__room_type", "converted_reservation").order_by("-created_at", "-id"),
        request,
    )


def get_day_use_or_404(request, day_use_id):
    day_use = day_use_queryset(request).filter(pk=day_use_id).first()
    if day_use is None:
        return None, JsonResponse({"detail": "Day use introuvable."}, status=404)
    return day_use, None


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations")
@require_http_methods(["GET", "POST"])
def day_use_list_api(request):
    if request.method == "POST":
        return day_use_create_api(request)

    queryset = day_use_queryset(request)
    search = (request.GET.get("search") or "").strip()
    status_value = (request.GET.get("status") or "").strip()
    payment_status = (request.GET.get("payment_status") or "").strip()
    room_id = request.GET.get("room")
    client_id = request.GET.get("client")
    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")

    if search:
        queryset = queryset.filter(
            reference__icontains=search
        ) | queryset.filter(
            guest__first_name__icontains=search
        ) | queryset.filter(
            guest__last_name__icontains=search
        ) | queryset.filter(
            guest__phone__icontains=search
        ) | queryset.filter(room__number__icontains=search)
    if status_value:
        queryset = queryset.filter(status=status_value)
    if payment_status:
        queryset = queryset.filter(payment_status=payment_status)
    if room_id:
        queryset = queryset.filter(room_id=room_id)
    if client_id:
        queryset = queryset.filter(guest_id=client_id)
    if date_from:
        queryset = queryset.filter(start_datetime__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(start_datetime__date__lte=date_to)

    payload = build_paginated_payload(request, queryset.distinct(), DayUseSerializer.serialize)
    payload["filters"] = {
        "search": search,
        "status": status_value,
        "payment_status": payment_status,
        "room": room_id,
        "client": client_id,
    }
    return JsonResponse(payload)


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations")
@require_http_methods(["GET", "PUT", "PATCH"])
def day_use_detail_api(request, day_use_id):
    if request.method in {"PUT", "PATCH"}:
        return day_use_update_api(request, day_use_id)

    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    return JsonResponse(DayUseDetailSerializer.serialize(day_use))


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="create")
@require_http_methods(["POST"])
def day_use_create_api(request):
    try:
        payload = parse_json_body(request)
        hotel = get_request_hotel(request)
        guest = scope_queryset_to_hotel(Guest.objects.filter(is_active=True), request).get(pk=payload.get("client_id") or payload.get("guest_id"))
        room = scope_queryset_to_hotel(Room.objects.select_related("room_type"), request).get(pk=payload.get("room_id"))
        validate_objects_belong_to_hotel(hotel, guest=guest, room=room)
        day_use = DayUseLifecycleService.create(
            hotel=hotel,
            guest=guest,
            room=room,
            payload=payload,
            actor=request.user,
            request=request,
        )
    except Guest.DoesNotExist:
        return JsonResponse({"detail": "Client introuvable."}, status=404)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Day use cree.", "day_use": DayUseSerializer.serialize(day_use)}, status=201)


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PUT", "PATCH"])
def day_use_update_api(request, day_use_id):
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    if day_use.status not in {DayUse.Status.DRAFT, DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY}:
        return JsonResponse({"detail": "Ce day use ne peut plus etre modifie."}, status=400)
    try:
        payload = parse_json_body(request)
        if payload.get("room_id"):
            day_use.room = scope_queryset_to_hotel(Room.objects.select_related("room_type"), request).get(pk=payload.get("room_id"))
        validate_objects_belong_to_hotel(day_use.hotel, room=day_use.room, guest=day_use.guest)
        if payload.get("start_datetime"):
            day_use.start_datetime = normalize_datetime(payload.get("start_datetime"), "start_datetime")
            day_use.planned_entry_at = day_use.start_datetime
        if payload.get("expected_duration_hours"):
            day_use.expected_duration_hours = DayUsePricingService.validate_duration(payload.get("expected_duration_hours"))
        pricing = DayUsePricingService.calculate(
            room=day_use.room,
            duration_hours=day_use.expected_duration_hours,
            discount_amount=payload.get("discount_amount", day_use.discount_amount),
            hourly_rate=payload.get("hourly_rate", day_use.hourly_rate),
        )
        day_use.end_datetime = day_use.start_datetime + timedelta(hours=pricing["expected_duration_hours"])
        DayUseAvailabilityService.validate_room_can_be_used(day_use.room)
        DayUseConflictService.validate_no_conflict(
            room=day_use.room,
            start_datetime=day_use.start_datetime,
            end_datetime=day_use.end_datetime,
            exclude_day_use=day_use,
        )
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    day_use.hourly_rate = pricing["hourly_rate"]
    day_use.subtotal_amount = pricing["subtotal_amount"]
    day_use.discount_amount = pricing["discount_amount"]
    day_use.final_amount = pricing["final_amount"]
    day_use.package_price = pricing["final_amount"]
    day_use.total_amount = pricing["final_amount"]
    day_use.notes = payload.get("notes", day_use.notes)
    day_use.updated_by = request.user
    try:
        day_use.save()
    except IntegrityError:
        return JsonResponse({"errors": {"room": ["Conflit horaire avec une occupation existante."]}}, status=400)
    return JsonResponse({"message": "Day use mis a jour.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PATCH", "POST"])
def day_use_check_in_api(request, day_use_id):
    permission_response = require_business_action(request, "dayuse.check_in")
    if permission_response:
        return permission_response
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        day_use = DayUseLifecycleService.check_in(day_use, actor=request.user, request=request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Check-in day use effectue.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PATCH", "POST"])
def day_use_check_out_api(request, day_use_id):
    permission_response = require_business_action(request, "dayuse.check_out")
    if permission_response:
        return permission_response
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        day_use = DayUseLifecycleService.check_out(day_use, actor=request.user, request=request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Check-out day use effectue.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PATCH", "POST"])
def day_use_cancel_api(request, day_use_id):
    permission_response = require_business_action(request, "dayuse.cancel")
    if permission_response:
        return permission_response
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        payload = parse_json_body(request)
        day_use = DayUseLifecycleService.cancel(day_use, reason=payload.get("reason") or payload.get("cancellation_reason"), actor=request.user, request=request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Day use annule.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PATCH", "POST"])
def day_use_no_show_api(request, day_use_id):
    permission_response = require_business_action(request, "dayuse.cancel")
    if permission_response:
        return permission_response
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        payload = parse_json_body(request)
        day_use = DayUseLifecycleService.no_show(day_use, reason=payload.get("reason") or payload.get("no_show_reason"), actor=request.user, request=request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Day use marque no-show.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="update")
@require_http_methods(["PATCH", "POST"])
def day_use_extend_api(request, day_use_id):
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        payload = parse_json_body(request)
        day_use = DayUseLifecycleService.extend(day_use, extra_hours=payload.get("extra_hours") or 1, actor=request.user, request=request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"message": "Day use prolonge.", "day_use": DayUseSerializer.serialize(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="create")
@require_http_methods(["POST"])
def day_use_payment_api(request, day_use_id):
    permission_response = require_business_action(request, "payments.record")
    if permission_response:
        return permission_response
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    try:
        payload = parse_json_body(request)
        payment = DayUsePaymentService.record_payment(day_use, payload=payload, actor=request.user, request=request)
        day_use.refresh_from_db()
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse(
        {
            "message": "Paiement day use enregistre.",
            "payment": DayUsePaymentSerializer.serialize(payment),
            "day_use": DayUseSerializer.serialize(day_use),
        },
        status=201,
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="view")
@require_http_methods(["GET"])
def day_use_history_api(request, day_use_id):
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    queryset = HistoryEntry.objects.select_related("actor").filter(entity_type="DayUse", entity_reference=day_use.reference).order_by("-created_at", "-id")
    return JsonResponse({"results": [serialize_history_entry(item) for item in queryset[:100]]})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="view")
@require_http_methods(["GET"])
def day_use_availability_api(request):
    try:
        start = normalize_datetime(request.GET.get("start_datetime"), "start_datetime") or timezone.now()
        duration = DayUsePricingService.validate_duration(request.GET.get("duration_hours") or request.GET.get("expected_duration_hours") or 3)
        from datetime import timedelta

        end = start + timedelta(hours=duration)
        rooms = DayUseAvailabilityService.available_rooms(hotel=get_request_hotel(request), start_datetime=start, end_datetime=end)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse({"results": [serialize_availability_room(room) for room in rooms], "start_datetime": start.isoformat(), "end_datetime": end.isoformat()})


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="view")
@require_http_methods(["GET"])
def day_use_dashboard_api(request):
    return JsonResponse(DayUseDashboardService.build(hotel=get_request_hotel(request)))


day_use_stats_api = day_use_dashboard_api


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="view")
@require_http_methods(["POST", "GET"])
def day_use_receipt_api(request, day_use_id):
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    return JsonResponse(DayUseReceiptService.build(day_use))


@api_login_required
@module_hotel_scope_required("operations")
@module_license_required("day_use")
@module_permission_required("operations", action="create")
@require_http_methods(["PATCH", "POST"])
def day_use_convert_to_night_api(request, day_use_id):
    day_use, error = get_day_use_or_404(request, day_use_id)
    if error:
        return error
    content_type = request.META.get("CONTENT_TYPE", "")
    payload = parse_json_body(request) if request.method == "POST" and "application/json" in content_type and request.body else {}
    try:
        booking, converted = DayUseLifecycleService.convert_to_night(
            day_use,
            payload=payload,
            actor=request.user,
            request=request,
        )
    except IntegrityError:
        return JsonResponse({"errors": {"room": ["Conflit avec une reservation existante."]}}, status=400)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)
    return JsonResponse(
        {
            "detail": "Day use converti en reservation classique.",
            "booking": {
                "id": booking.id,
                "reference": booking.reference,
                "status": booking.status,
                "check_in_date": booking.check_in_date.isoformat(),
                "check_out_date": booking.check_out_date.isoformat(),
            },
            "day_use": DayUseSerializer.serialize(converted),
        },
        status=201,
    )
