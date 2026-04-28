import json
from datetime import date

from django.core.exceptions import ValidationError
from django.db.models import Count
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.core.api_views import api_login_required, module_hotel_scope_required, module_permission_required
from apps.guests.models import Guest
from apps.guests.pagination import build_paginated_payload
from apps.guests.serializers import (
    ClientDetailSerializer,
    ClientSerializer,
    consumptions_table_is_available,
    search_clients,
)
from apps.history.models import HistoryEntry
from apps.history.services import build_client_timeline_payload, log_history
from apps.tenancy.utils import get_request_hotel, scope_queryset_to_hotel


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


@api_login_required
@module_hotel_scope_required("guests")
@module_permission_required("clients")
@require_http_methods(["GET", "POST"])
def clients_api(request):
    active_hotel = get_request_hotel(request)
    if request.method == "GET":
        search = request.GET.get("search", "").strip()
        queryset = (
            search_clients(scope_queryset_to_hotel(Guest.objects.all(), request), search)
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
        return JsonResponse(payload)

    try:
        payload = parse_json_body(request)
        if active_hotel is not None:
            payload["hotel"] = active_hotel
        result = ClientSerializer.validate(payload)
        if result.get("errors"):
            return JsonResponse({"errors": result["errors"]}, status=400)

        client = ClientSerializer.save(result["data"])
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="guests",
            entity_type="Guest",
            entity_reference=client.full_name,
            description=f"Client cree : {client.full_name}.",
            actor=request.user,
            metadata={"guest_id": client.id, "phone": client.phone, "email": client.email},
        )
        return JsonResponse(
            {
                "message": "Client cree avec succes.",
                "client": ClientDetailSerializer.serialize(client),
                "warnings": result.get("warnings", []),
            },
            status=201,
        )
    except ValidationError as error:
        return JsonResponse({"errors": build_validation_error(error)}, status=400)


@api_login_required
@module_hotel_scope_required("guests")
@module_permission_required("clients")
@require_http_methods(["GET", "PUT", "DELETE"])
def client_detail_api(request, client_id):
    client = scope_queryset_to_hotel(Guest.objects.all(), request).filter(pk=client_id).first()
    if client is None:
        return JsonResponse({"detail": "Client introuvable."}, status=404)

    if request.method == "GET":
        return JsonResponse(ClientDetailSerializer.serialize(client))

    if request.method == "PUT":
        try:
            payload = parse_json_body(request)
            result = ClientSerializer.validate(payload, instance=client)
            if result.get("errors"):
                return JsonResponse({"errors": result["errors"]}, status=400)

            client = ClientSerializer.save(result["data"], instance=client)
            log_history(
                action_type=HistoryEntry.ActionType.STATUS_UPDATED,
                module="guests",
                entity_type="Guest",
                entity_reference=client.full_name,
                description=f"Client mis a jour : {client.full_name}.",
                actor=request.user,
                metadata={"guest_id": client.id, "phone": client.phone, "email": client.email},
            )
            return JsonResponse(
                {
                    "message": "Client mis a jour avec succes.",
                    "client": ClientDetailSerializer.serialize(client),
                    "warnings": result.get("warnings", []),
                }
            )
        except ValidationError as error:
            return JsonResponse({"errors": build_validation_error(error)}, status=400)

    try:
        client_name = client.full_name
        client_id_value = client.id
        client.delete()
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="guests",
            entity_type="Guest",
            entity_reference=client_name,
            description=f"Client supprime : {client_name}.",
            actor=request.user,
            metadata={"guest_id": client_id_value},
        )
        return JsonResponse({"message": "Client supprime avec succes."})
    except ProtectedError:
        return JsonResponse(
            {
                "detail": "Ce client ne peut pas etre supprime car il est lie a des reservations, sejours ou day use."
            },
            status=409,
        )


@api_login_required
@module_hotel_scope_required("guests")
@module_permission_required("clients", action="view")
@require_http_methods(["GET"])
def client_history_api(request, client_id):
    client = scope_queryset_to_hotel(Guest.objects.all(), request).filter(pk=client_id).first()
    if client is None:
        return JsonResponse({"detail": "Client introuvable."}, status=404)

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
