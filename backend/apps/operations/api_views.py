import json
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.bookings.models import Booking, DayUse
from apps.consumptions.models import ClientConsumption
from apps.core.api_views import api_login_required, format_amount, module_hotel_scope_required, module_permission_required
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenancy.utils import get_request_hotel, scope_queryset_to_hotel
from apps.users.models import User


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValidationError("Requete JSON invalide.")


def parse_date(value, label):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({label: "Date invalide."})


def parse_datetime(value, label):
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({label: "Date et heure invalides."})

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def format_validation_error(error):
    if hasattr(error, "message_dict"):
        return {key: [str(item) for item in value] for key, value in error.message_dict.items()}
    if hasattr(error, "messages"):
        return {"non_field_errors": [str(item) for item in error.messages]}
    return {"non_field_errors": [str(error)]}


def format_date_value(value):
    return value.isoformat() if value else "-"


def format_datetime_value(value):
    if not value:
        return "-"
    return timezone.localtime(value).isoformat()


def hotel_scoped(queryset, request, field_name="hotel"):
    return scope_queryset_to_hotel(queryset, request, field_name=field_name)


def hotel_scoped_get(queryset, request, **lookup):
    return hotel_scoped(queryset, request).get(**lookup)


def serialize_guest(item):
    return {
        "id": item.id,
        "full_name": item.full_name,
        "phone": item.phone or "-",
        "email": item.email or "-",
        "country": item.country or "-",
        "is_blacklisted": item.is_blacklisted,
    }


def serialize_room(item):
    return {
        "id": item.id,
        "number": item.number,
        "status": item.get_status_display(),
        "floor": item.floor or "-",
        "room_type": item.room_type.name,
        "room_type_code": item.room_type.code,
    }


def serialize_history_entry(item):
    actor = "Systeme"
    if item.actor:
        actor = item.actor.get_full_name() or item.actor.username
    return {
        "id": item.id,
        "label": item.get_action_type_display(),
        "description": item.description,
        "actor": actor,
        "module": item.module,
        "created_at": format_datetime_value(item.created_at),
    }


def serialize_payment(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "payment_reference": item.reference,
        "status": item.get_status_display(),
        "status_code": item.status,
        "method": item.get_method_display(),
        "method_code": item.method,
        "payment_type": item.get_payment_type_display(),
        "payment_type_code": item.payment_type,
        "amount": format_amount(item.amount),
        "paid_at": format_datetime_value(item.paid_at),
        "detail_path": f"/operations/payments/{item.id}",
        "client_id": item.client_id,
        "client_name": item.client.full_name if item.client_id else "-",
        "booking_id": item.booking_id,
        "reservation_reference": item.booking.reference if item.booking_id else "-",
        "stay_id": item.stay_id,
        "stay_reference": item.stay.reference if item.stay_id else "-",
        "day_use_id": item.day_use_id,
        "invoice_id": item.invoice_id,
        "invoice_reference": item.invoice.reference if item.invoice_id else "-",
        "external_reference": item.external_reference or "-",
        "currency": item.currency,
        "source": item.source or "-",
    }


def serialize_consumption(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "label": item.label,
        "service": item.service_department.name,
        "service_code": item.service_department.code,
        "status": item.get_status_display(),
        "payment_status": item.get_payment_status_display(),
        "quantity": format_amount(item.quantity),
        "unit_price": format_amount(item.unit_price),
        "total_amount": format_amount(item.total_amount),
        "consumed_at": format_datetime_value(item.service_date),
        "stay_reference": item.stay.reference if item.stay_id else "-",
        "reservation_reference": item.reservation.reference if getattr(item, "reservation_id", None) else "-",
        "room": item.room.number if getattr(item, "room_id", None) else "-",
        "detail_path": f"/api/consumptions/client-consumptions/{item.id}/",
    }


def serialize_invoice(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "status": item.get_status_display(),
        "status_code": item.status,
        "issued_at": format_datetime_value(item.issued_at),
        "due_date": item.due_date.isoformat() if item.due_date else "-",
        "subtotal_amount": format_amount(item.subtotal_amount),
        "discount_amount": format_amount(item.discount_amount),
        "tax_amount": format_amount(item.tax_amount),
        "total_amount": format_amount(item.total_amount),
        "amount_paid": format_amount(item.amount_paid),
        "balance_due": format_amount(item.balance_due),
        "item_count": item.items.count(),
        "detail_path": f"/api/billing/client-invoices/{item.id}/",
    }


def serialize_booking(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "guest": item.guest.full_name,
        "room_type": item.room_type.name,
        "room": item.room.number if item.room else "-",
        "status": item.get_status_display(),
        "source": item.get_source_display(),
        "check_in_date": item.check_in_date.isoformat(),
        "check_out_date": item.check_out_date.isoformat(),
        "estimated_amount": format_amount(item.estimated_amount),
        "can_check_in": item.status == Booking.Status.CONFIRMED,
        "detail_path": f"/operations/bookings/{item.id}",
    }


def serialize_stay(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "stay_number": item.reference,
        "guest": item.guest.full_name,
        "guest_id": item.guest_id,
        "room": item.room.number,
        "room_id": item.room_id,
        "room_type": item.room.room_type.name,
        "room_type_id": item.room.room_type_id,
        "status": item.get_status_display(),
        "status_code": item.status,
        "source": item.get_source_display(),
        "source_code": item.source,
        "planned_check_in": format_datetime_value(item.planned_check_in),
        "actual_check_in": format_datetime_value(item.actual_check_in or item.check_in_at),
        "planned_check_out": format_datetime_value(item.planned_check_out),
        "actual_check_out": format_datetime_value(item.actual_check_out or item.check_out_at),
        "expected_check_out_date": item.expected_check_out_date.isoformat() if item.expected_check_out_date else "-",
        "number_of_guests": item.number_of_guests,
        "adults_count": item.adults_count,
        "children_count": item.children_count,
        "notes": item.notes or "-",
        "can_check_out": item.status == Stay.Status.IN_PROGRESS,
        "detail_path": f"/operations/stays/{item.id}",
    }


def serialize_day_use(item):
    return {
        "id": item.id,
        "reference": item.reference,
        "guest": item.guest.full_name,
        "room": item.room.number,
        "status": item.get_status_display(),
        "total_amount": format_amount(item.total_amount),
        "paid_amount": format_amount(item.paid_amount),
        "can_check_in": item.status == DayUse.Status.READY,
        "can_check_out": item.status == DayUse.Status.IN_PROGRESS,
        "detail_path": f"/operations/day-uses/{item.id}",
    }


def serialize_cleaning_room(item):
    current_stay = item.stays.filter(status=Stay.Status.IN_PROGRESS).select_related("guest").first()
    current_day_use = item.day_uses.filter(status=DayUse.Status.IN_PROGRESS).select_related("guest").first()
    occupant = "-"
    source = "-"
    if current_stay:
        occupant = current_stay.guest.full_name
        source = f"Sejour {current_stay.reference}"
    elif current_day_use:
        occupant = current_day_use.guest.full_name
        source = f"Day use {current_day_use.reference}"

    return {
        "id": item.id,
        "room": item.number,
        "room_type": item.room_type.name,
        "floor": item.floor or "-",
        "status": item.get_status_display(),
        "occupant": occupant,
        "source": source,
    }


def get_history_entries(references):
    cleaned_references = [value for value in references if value]
    queryset = (
        HistoryEntry.objects.select_related("actor")
        .filter(entity_reference__in=cleaned_references)
        .order_by("-created_at", "-id")[:12]
    )
    return [serialize_history_entry(item) for item in queryset]


def get_related_actions(actions):
    return [item for item in actions if item]


def get_booking_stay(item):
    try:
        return item.stay
    except Stay.DoesNotExist:
        return None


def get_payment_links(payment):
    links = []
    if payment.booking_id:
        links.append({"label": "Voir la reservation", "path": f"/operations/bookings/{payment.booking_id}"})
    if payment.stay_id:
        links.append({"label": "Voir le sejour", "path": f"/operations/stays/{payment.stay_id}"})
    if payment.day_use_id:
        links.append({"label": "Voir le day use", "path": f"/operations/day-uses/{payment.day_use_id}"})
    if payment.invoice_id:
        links.append({"label": "Voir la facture API", "path": f"/api/billing/client-invoices/{payment.invoice_id}/"})
    return links


def serialize_choice_options(choices):
    return [{"value": value, "label": label} for value, label in choices]


def priority_payload(level, label, sla):
    return {
        "level": level,
        "label": label,
        "sla": sla,
    }


def serialize_supervisor_user(user):
    return {
        "id": user.id,
        "label": user.get_full_name() or user.username,
        "role": user.get_role_display(),
    }


def serialize_supervisor_history(item):
    actor = item.actor.get_full_name() or item.actor.username if item.actor else "Systeme"
    return {
        "id": item.id,
        "label": item.get_action_type_display(),
        "reference": item.entity_reference,
        "description": item.description,
        "actor": actor,
        "module": item.module,
        "created_at": format_datetime_value(item.created_at),
    }


def build_booking_detail(booking):
    stay = get_booking_stay(booking)
    paid_total = booking.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount"))["total"] or 0
    balance_total = booking.estimated_amount - paid_total
    payments = [serialize_payment(item) for item in booking.payments.order_by("-paid_at", "-id")[:10]]
    timeline = get_history_entries([booking.reference, stay.reference if stay else None])
    related_actions = get_related_actions(
        [
            {
                "label": "Effectuer le check-in",
                "kind": "mutation",
                "endpoint": f"/api/operations/bookings/{booking.id}/check-in/",
                "enabled": booking.status == Booking.Status.CONFIRMED and bool(booking.room_id),
                "variant": "primary",
            },
            {
                "label": "Confirmer la reservation",
                "kind": "mutation",
                "endpoint": f"/api/operations/bookings/{booking.id}/confirm/",
                "enabled": booking.status == Booking.Status.PENDING,
                "variant": "secondary",
            },
            {
                "label": "Annuler la reservation",
                "kind": "mutation",
                "endpoint": f"/api/operations/bookings/{booking.id}/cancel/",
                "enabled": booking.status in {Booking.Status.PENDING, Booking.Status.CONFIRMED},
                "variant": "danger",
            },
            {
                "label": "Voir le sejour lie",
                "kind": "link",
                "path": f"/operations/stays/{stay.id}",
                "enabled": bool(stay),
                "variant": "secondary",
            }
            if stay
            else None,
        ]
    )
    return {
        "entity_type": "booking",
        "title": booking.reference,
        "subtitle": "Fiche detaillee de reservation avec client, hebergement, encaissements et historique.",
        "status": booking.get_status_display(),
        "reference": booking.reference,
        "room_type_id": booking.room_type_id,
        "summary_cards": [
            {"label": "Montant estime", "value": format_amount(booking.estimated_amount), "meta": "Montant saisi a la creation"},
            {"label": "Montant encaisse", "value": format_amount(paid_total), "meta": "Paiements valides lies a cette reservation"},
            {"label": "Solde estime", "value": format_amount(balance_total if balance_total > 0 else 0), "meta": "Reste theorique a encaisser"},
            {"label": "Occupation", "value": f"{booking.adults} adulte(s) / {booking.children} enfant(s)", "meta": "Capacite declaree"},
        ],
        "sections": [
            {
                "title": "Client",
                "items": [
                    {"label": "Nom", "value": booking.guest.full_name},
                    {"label": "Telephone", "value": booking.guest.phone or "-"},
                    {"label": "Email", "value": booking.guest.email or "-"},
                    {"label": "Pays", "value": booking.guest.country or "-"},
                ],
            },
            {
                "title": "Hebergement",
                "items": [
                    {"label": "Type de chambre", "value": booking.room_type.name},
                    {"label": "Code type", "value": booking.room_type.code},
                    {"label": "Chambre affectee", "value": booking.room.number if booking.room else "-"},
                    {"label": "Source", "value": booking.get_source_display()},
                ],
            },
            {
                "title": "Reservation",
                "items": [
                    {"label": "Date d'arrivee", "value": format_date_value(booking.check_in_date)},
                    {"label": "Date de depart", "value": format_date_value(booking.check_out_date)},
                    {"label": "Statut", "value": booking.get_status_display()},
                    {"label": "Notes", "value": booking.notes or "-"},
                ],
            },
        ],
        "related_records": {
            "payments": payments,
            "stay": serialize_stay(stay) if stay else None,
        },
        "timeline": timeline,
        "guest": serialize_guest(booking.guest),
        "room": serialize_room(booking.room) if booking.room else None,
        "context_actions": related_actions,
        "edit_form": {
            "title": "Modifier la reservation",
            "endpoint": f"/api/operations/bookings/{booking.id}/update/",
            "fields": {
                "room_id": str(booking.room_id or ""),
                "source": booking.source,
                "check_in_date": format_date_value(booking.check_in_date) if booking.check_in_date else "",
                "check_out_date": format_date_value(booking.check_out_date) if booking.check_out_date else "",
                "adults": booking.adults,
                "children": booking.children,
                "estimated_amount": str(booking.estimated_amount),
                "notes": booking.notes or "",
            },
        },
        "payment_form": {
            "title": "Enregistrer un paiement",
            "endpoint": "/api/operations/payments/create/",
            "fields": {
                "client_id": booking.guest_id,
                "booking_id": booking.id,
                "stay_id": stay.id if stay else "",
                "day_use_id": "",
                "invoice_id": "",
                "status": Payment.Status.PAID,
                "payment_type": Payment.PaymentType.ADVANCE if not stay else Payment.PaymentType.PARTIAL,
                "method": Payment.Method.CASH,
                "amount": "",
                "paid_at": "",
                "notes": "",
                "source": "operations_booking",
                "external_reference": "",
                "currency": "XOF",
            },
        },
        "workflow_forms": [
            {
                "title": "Check-in guide",
                "endpoint": f"/api/operations/bookings/{booking.id}/check-in/",
                "submit_label": "Creer le sejour",
                "type": "booking_check_in",
                "fields": {
                    "room_id": str(booking.room_id or ""),
                },
            }
        ]
        if booking.status == Booking.Status.CONFIRMED
        else [],
    }


def build_stay_detail(stay):
    paid_total = stay.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount"))["total"] or 0
    consumptions_queryset = stay.consumptions.select_related("service_department", "reservation", "room")
    consumption_total = (
        consumptions_queryset.exclude(status=ClientConsumption.Status.CANCELLED).aggregate(total=Sum("total_amount"))["total"] or 0
    )
    invoices_queryset = stay.invoices.prefetch_related("items", "payments")
    invoices_total = invoices_queryset.exclude(status=ClientInvoice.Status.CANCELLED).aggregate(total=Sum("total_amount"))["total"] or 0
    timeline = get_history_entries([stay.reference, stay.booking.reference if stay.booking_id else None])
    payments = [serialize_payment(item) for item in stay.payments.order_by("-paid_at", "-id")[:10]]
    consumptions = [serialize_consumption(item) for item in consumptions_queryset.order_by("-service_date", "-id")[:10]]
    invoices = [serialize_invoice(item) for item in invoices_queryset.order_by("-issued_at", "-id")[:10]]
    edit_form = None
    if stay.status == Stay.Status.IN_PROGRESS:
        edit_form = {
            "title": "Ajuster le sejour",
            "endpoint": f"/api/operations/stays/{stay.id}/update/",
            "fields": {
                "planned_check_out": format_datetime_value(stay.planned_check_out) if stay.planned_check_out else "",
                "expected_check_out_date": format_date_value(stay.expected_check_out_date) if stay.expected_check_out_date else "",
                "adults": stay.adults,
                "adults_count": stay.adults_count,
                "children": stay.children,
                "children_count": stay.children_count,
                "number_of_guests": stay.number_of_guests,
                "purpose_of_stay": stay.purpose_of_stay or "",
                "special_requests": stay.special_requests or "",
                "notes": stay.notes or "",
            },
        }
    return {
        "entity_type": "stay",
        "title": stay.reference,
        "subtitle": "Fiche detaillee du sejour en cours ou termine, avec chambre, reservation d'origine et historique.",
        "status": stay.get_status_display(),
        "reference": stay.reference,
        "summary_cards": [
            {"label": "Montant encaisse", "value": format_amount(paid_total), "meta": "Paiements valides lies a ce sejour"},
            {"label": "Consommations", "value": format_amount(consumption_total), "meta": "Montant cumule hors lignes annulees"},
            {"label": "Factures", "value": format_amount(invoices_total), "meta": "Montant total des factures liees a ce sejour"},
            {"label": "Arrivee prevue", "value": format_datetime_value(stay.planned_check_in), "meta": "Donnee previsionnelle de sejour"},
            {"label": "Depart prevu", "value": format_datetime_value(stay.planned_check_out), "meta": "Cible operationnelle actuelle"},
            {"label": "Occupation", "value": f"{stay.number_of_guests} occupant(s)", "meta": f"{stay.adults_count} adulte(s) / {stay.children_count} enfant(s)"},
        ],
        "sections": [
            {
                "title": "Client",
                "items": [
                    {"label": "Nom", "value": stay.guest.full_name},
                    {"label": "Telephone", "value": stay.guest.phone or "-"},
                    {"label": "Email", "value": stay.guest.email or "-"},
                    {"label": "Pays", "value": stay.guest.country or "-"},
                ],
            },
            {
                "title": "Chambre",
                "items": [
                    {"label": "Numero", "value": stay.room.number},
                    {"label": "Type", "value": stay.room.room_type.name},
                    {"label": "Etage", "value": stay.room.floor or "-"},
                    {"label": "Statut actuel", "value": stay.room.get_status_display()},
                ],
            },
            {
                "title": "Sejour",
                "items": [
                    {"label": "Statut", "value": stay.get_status_display()},
                    {"label": "Origine", "value": stay.get_source_display()},
                    {"label": "Adultes / enfants", "value": f"{stay.adults_count} / {stay.children_count}"},
                    {"label": "Nombre total", "value": stay.number_of_guests},
                    {"label": "Reservation liee", "value": stay.booking.reference if stay.booking_id else "-"},
                    {"label": "Motif", "value": stay.purpose_of_stay or "-"},
                    {"label": "Demandes speciales", "value": stay.special_requests or "-"},
                    {"label": "Notes", "value": stay.notes or "-"},
                ],
            },
            {
                "title": "Prevu vs reel",
                "items": [
                    {"label": "Arrivee prevue", "value": format_datetime_value(stay.planned_check_in)},
                    {"label": "Arrivee reelle", "value": format_datetime_value(stay.actual_check_in or stay.check_in_at)},
                    {"label": "Depart prevu", "value": format_datetime_value(stay.planned_check_out)},
                    {"label": "Depart reel", "value": format_datetime_value(stay.actual_check_out or stay.check_out_at)},
                ],
            },
        ],
        "related_records": {
            "payments": payments,
            "consumptions": consumptions,
            "invoices": invoices,
            "booking": serialize_booking(stay.booking) if stay.booking_id else None,
        },
        "timeline": timeline,
        "guest": serialize_guest(stay.guest),
        "room": serialize_room(stay.room),
        "context_actions": get_related_actions(
            [
                {
                    "label": "Effectuer le check-out",
                    "kind": "mutation",
                    "endpoint": f"/api/operations/stays/{stay.id}/check-out/",
                    "enabled": stay.status == Stay.Status.IN_PROGRESS,
                    "variant": "danger",
                },
                {
                    "label": "Voir la reservation liee",
                    "kind": "link",
                    "path": f"/operations/bookings/{stay.booking_id}",
                    "enabled": bool(stay.booking_id),
                    "variant": "secondary",
                }
                if stay.booking_id
                else None,
                {
                    "label": "Terminer le nettoyage",
                    "kind": "mutation",
                    "endpoint": f"/api/operations/rooms/{stay.room_id}/complete-cleaning/",
                    "enabled": stay.room.status == Room.Status.CLEANING,
                    "variant": "secondary",
                },
            ]
        ),
        "edit_form": edit_form,
        "payment_form": {
            "title": "Enregistrer un paiement",
            "endpoint": "/api/operations/payments/create/",
            "fields": {
                "client_id": stay.guest_id,
                "booking_id": stay.booking_id or "",
                "stay_id": stay.id,
                "day_use_id": "",
                "invoice_id": "",
                "status": Payment.Status.PAID,
                "payment_type": Payment.PaymentType.PARTIAL,
                "method": Payment.Method.CASH,
                "amount": "",
                "paid_at": "",
                "notes": "",
                "source": "operations_stay",
                "external_reference": "",
                "currency": "XOF",
            },
        },
        "workflow_forms": [],
    }


def build_day_use_detail(day_use):
    timeline = get_history_entries([day_use.reference])
    payments = [serialize_payment(item) for item in day_use.payments.order_by("-paid_at", "-id")[:10]]
    balance_total = day_use.balance_amount
    return {
        "entity_type": "day_use",
        "title": day_use.reference,
        "subtitle": "Fiche detaillee day use avec statut de paiement, occupation de chambre et historique.",
        "status": day_use.get_status_display(),
        "reference": day_use.reference,
        "summary_cards": [
            {"label": "Montant total", "value": format_amount(day_use.total_amount), "meta": "Formule et depassement inclus"},
            {"label": "Montant encaisse", "value": format_amount(day_use.paid_amount), "meta": "Paiements valides day use"},
            {"label": "Solde", "value": format_amount(balance_total), "meta": "Reste a encaisser"},
            {"label": "Entree prevue", "value": format_datetime_value(day_use.planned_entry_at), "meta": "Heure planifiee"},
        ],
        "sections": [
            {
                "title": "Client",
                "items": [
                    {"label": "Nom", "value": day_use.guest.full_name},
                    {"label": "Telephone", "value": day_use.guest.phone or "-"},
                    {"label": "Email", "value": day_use.guest.email or "-"},
                    {"label": "Pays", "value": day_use.guest.country or "-"},
                ],
            },
            {
                "title": "Chambre",
                "items": [
                    {"label": "Numero", "value": day_use.room.number},
                    {"label": "Type", "value": day_use.room.room_type.name},
                    {"label": "Statut actuel", "value": day_use.room.get_status_display()},
                    {"label": "Etage", "value": day_use.room.floor or "-"},
                ],
            },
            {
                "title": "Day use",
                "items": [
                    {"label": "Statut", "value": day_use.get_status_display()},
                    {"label": "Depassement", "value": day_use.get_overtime_choice_display()},
                    {"label": "Entree reelle", "value": format_datetime_value(day_use.check_in_at)},
                    {"label": "Sortie reelle", "value": format_datetime_value(day_use.check_out_at)},
                ],
            },
        ],
        "related_records": {
            "payments": payments,
            "booking": None,
        },
        "timeline": timeline,
        "guest": serialize_guest(day_use.guest),
        "room": serialize_room(day_use.room),
        "context_actions": [
            {
                "label": "Effectuer l'entree",
                "kind": "mutation",
                "endpoint": f"/api/operations/day-use/{day_use.id}/check-in/",
                "enabled": day_use.status == DayUse.Status.READY,
                "variant": "primary",
            },
            {
                "label": "Effectuer la sortie",
                "kind": "mutation",
                "endpoint": f"/api/operations/day-use/{day_use.id}/check-out/",
                "enabled": day_use.status == DayUse.Status.IN_PROGRESS,
                "variant": "danger",
            },
            {
                "label": "Terminer le nettoyage",
                "kind": "mutation",
                "endpoint": f"/api/operations/rooms/{day_use.room_id}/complete-cleaning/",
                "enabled": day_use.room.status == Room.Status.CLEANING,
                "variant": "secondary",
            },
        ],
        "edit_form": {
            "title": "Modifier le day use",
            "endpoint": f"/api/operations/day-uses/{day_use.id}/update/",
            "fields": {
                "room_id": str(day_use.room_id),
                "package_price": str(day_use.package_price),
                "overtime_choice": day_use.overtime_choice,
                "overtime_fee": str(day_use.overtime_fee),
                "planned_entry_at": format_datetime_value(day_use.planned_entry_at),
                "notes": day_use.notes or "",
            },
        },
        "payment_form": {
            "title": "Enregistrer un paiement",
            "endpoint": "/api/operations/payments/create/",
            "fields": {
                "client_id": day_use.guest_id,
                "booking_id": "",
                "stay_id": "",
                "day_use_id": day_use.id,
                "invoice_id": "",
                "status": Payment.Status.PAID,
                "payment_type": Payment.PaymentType.PARTIAL,
                "method": Payment.Method.CASH,
                "amount": "",
                "paid_at": "",
                "notes": "",
                "source": "operations_day_use",
                "external_reference": "",
                "currency": "XOF",
            },
        },
        "workflow_forms": [],
    }


def build_payment_detail(payment):
    guest_name = "-"
    if payment.client_id:
        guest_name = payment.client.full_name
    elif payment.day_use_id:
        guest_name = payment.day_use.guest.full_name
    elif payment.stay_id:
        guest_name = payment.stay.guest.full_name
    elif payment.booking_id:
        guest_name = payment.booking.guest.full_name

    references = [payment.reference]
    if payment.booking_id:
        references.append(payment.booking.reference)
    if payment.stay_id:
        references.append(payment.stay.reference)
    if payment.day_use_id:
        references.append(payment.day_use.reference)

    return {
        "entity_type": "payment",
        "title": payment.reference,
        "subtitle": "Fiche detaillee du paiement avec rattachement metier et historique associe.",
        "status": payment.get_status_display(),
        "reference": payment.reference,
        "summary_cards": [
            {"label": "Montant", "value": format_amount(payment.amount), "meta": "Valeur de la transaction"},
            {"label": "Statut", "value": payment.get_status_display(), "meta": "Etat courant du paiement"},
            {"label": "Mode", "value": payment.get_method_display(), "meta": "Canal d'encaissement"},
            {"label": "Type", "value": payment.get_payment_type_display(), "meta": "Nature metier du paiement"},
            {"label": "Date", "value": format_datetime_value(payment.paid_at), "meta": "Horodatage du paiement"},
        ],
        "sections": [
            {
                "title": "Paiement",
                "items": [
                    {"label": "Reference", "value": payment.reference},
                    {"label": "Statut", "value": payment.get_status_display()},
                    {"label": "Type", "value": payment.get_payment_type_display()},
                    {"label": "Mode", "value": payment.get_method_display()},
                    {"label": "Reference externe", "value": payment.external_reference or "-"},
                    {"label": "Origine", "value": payment.source or "-"},
                    {"label": "Devise", "value": payment.currency},
                    {"label": "Notes", "value": payment.notes or "-"},
                ],
            },
            {
                "title": "Rattachement",
                "items": [
                    {"label": "Reservation", "value": payment.booking.reference if payment.booking_id else "-"},
                    {"label": "Sejour", "value": payment.stay.reference if payment.stay_id else "-"},
                    {"label": "Day use", "value": payment.day_use.reference if payment.day_use_id else "-"},
                    {"label": "Facture", "value": payment.invoice.reference if payment.invoice_id else "-"},
                    {"label": "Client", "value": guest_name},
                ],
            },
        ],
        "related_records": {
            "payments": [],
            "links": get_payment_links(payment),
        },
        "timeline": get_history_entries(references),
        "guest": None,
        "room": None,
        "context_actions": [
            {
                "label": "Annuler le paiement",
                "kind": "mutation",
                "endpoint": f"/api/operations/payments/{payment.id}/cancel/",
                "enabled": payment.status in {Payment.Status.PENDING, Payment.Status.PAID},
                "variant": "danger",
            },
            {
                "label": "Rembourser le paiement",
                "kind": "mutation",
                "endpoint": f"/api/operations/payments/{payment.id}/refund/",
                "enabled": payment.status == Payment.Status.PAID,
                "variant": "secondary",
            },
        ]
        + [
            {
                "label": item["label"],
                "kind": "link",
                "path": item["path"],
                "enabled": True,
                "variant": "secondary",
            }
            for item in get_payment_links(payment)
        ],
        "edit_form": {
            "title": "Corriger le paiement",
            "endpoint": f"/api/operations/payments/{payment.id}/update/",
            "fields": {
                "status": payment.status,
                "method": payment.method,
                "payment_type": payment.payment_type,
                "amount": str(payment.amount),
                "paid_at": format_datetime_value(payment.paid_at),
                "notes": payment.notes or "",
                "source": payment.source or "",
                "external_reference": payment.external_reference or "",
                "currency": payment.currency,
            },
        },
        "payment_form": None,
        "workflow_forms": [],
    }


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def operations_choices_api(request):
    active_hotel = get_request_hotel(request)
    actionable_booking_statuses = {Room.Status.AVAILABLE, Room.Status.RESERVED}
    guests = [
        {
            "id": guest.id,
            "label": f"{guest.full_name} - {guest.phone or 'Sans telephone'}",
        }
        for guest in hotel_scoped(Guest.objects.filter(is_active=True, is_blacklisted=False), request)[:100]
    ]
    room_types = [
        {
            "id": item.id,
            "label": f"{item.name} ({item.code})",
            "capacity": item.capacity,
            "base_price_per_night": format_amount(item.base_price_per_night),
        }
        for item in hotel_scoped(RoomType.objects.filter(is_active=True), request).order_by("name")
    ]
    rooms = [
        {
            "id": item.id,
            "label": f"Chambre {item.number} - {item.room_type.name}",
            "room_type_id": item.room_type_id,
            "status": item.get_status_display(),
            "status_code": item.status,
            "can_assign_booking": item.status in actionable_booking_statuses,
            "can_open_stay": item.status == Room.Status.AVAILABLE,
            "can_open_day_use": item.status == Room.Status.AVAILABLE,
        }
        for item in hotel_scoped(Room.objects.select_related("room_type").filter(is_active=True), request).order_by("number")
    ]
    room_agents = [
        serialize_supervisor_user(item)
        for item in hotel_scoped(
            User.objects.filter(
                is_active=True,
                role__in=[
                    User.Role.ADMIN,
                    User.Role.MANAGER,
                    User.Role.RECEPTION,
                    User.Role.HOUSEKEEPING,
                ],
            ),
            request,
        ).order_by("first_name", "last_name", "username")
    ]
    bookings = [
        {
            "id": item.id,
            "label": f"{item.reference} - {item.guest.full_name}",
        }
        for item in hotel_scoped(Booking.objects.select_related("guest"), request)
        .filter(status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN])[:50]
    ]
    stays = [
        {
            "id": item.id,
            "label": f"{item.reference} - {item.guest.full_name}",
        }
        for item in hotel_scoped(Stay.objects.select_related("guest").filter(status=Stay.Status.IN_PROGRESS), request)[:50]
    ]
    day_uses = [
        {
            "id": item.id,
            "label": f"{item.reference} - {item.guest.full_name}",
        }
        for item in hotel_scoped(DayUse.objects.select_related("guest"), request)
        .filter(status__in=[DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY, DayUse.Status.IN_PROGRESS])[:50]
    ]
    payment_methods = [{"value": value, "label": label} for value, label in Payment.Method.choices]
    payment_statuses = [{"value": value, "label": label} for value, label in Payment.Status.choices]
    payment_types = [{"value": value, "label": label} for value, label in Payment.PaymentType.choices]
    booking_sources = [{"value": value, "label": label} for value, label in Booking.BookingSource.choices]
    stay_sources = [{"value": value, "label": label} for value, label in Stay.Source.choices]
    overtime_choices = [{"value": value, "label": label} for value, label in DayUse.OvertimeChoice.choices]

    return JsonResponse(
        {
            "guests": guests,
            "room_types": room_types,
            "rooms": rooms,
            "room_agents": room_agents,
            "bookings": bookings,
            "stays": stays,
            "day_uses": day_uses,
            "payment_methods": payment_methods,
            "payment_statuses": payment_statuses,
            "payment_types": payment_types,
            "booking_sources": booking_sources,
            "stay_sources": stay_sources,
            "overtime_choices": overtime_choices,
        }
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def bookings_list_api(request):
    status = request.GET.get("status", "").strip()
    search = request.GET.get("search", "").strip()
    queryset = hotel_scoped(Booking.objects.select_related("guest", "room_type", "room").order_by("-created_at"), request)
    if status:
        queryset = queryset.filter(status=status)
    if search:
        queryset = queryset.filter(
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(room__number__icontains=search)
        )

    return JsonResponse({"results": [serialize_booking(item) for item in queryset[:30]]})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def stays_list_api(request):
    status = request.GET.get("status", "").strip()
    search = request.GET.get("search", "").strip()
    queryset = hotel_scoped(
        Stay.objects.select_related("guest", "room__room_type", "booking").order_by("-check_in_at", "-id"),
        request,
    )
    if status:
        queryset = queryset.filter(status=status)
    if search:
        queryset = queryset.filter(
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(room__number__icontains=search)
            | Q(booking__reference__icontains=search)
        )
    return JsonResponse({"results": [serialize_stay(item) for item in queryset[:30]]})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def day_uses_list_api(request):
    queryset = hotel_scoped(DayUse.objects.select_related("guest", "room").order_by("-created_at"), request)
    return JsonResponse({"results": [serialize_day_use(item) for item in queryset[:30]]})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def payments_list_api(request):
    queryset = hotel_scoped(
        Payment.objects.select_related("client", "booking", "stay", "day_use", "invoice").order_by("-paid_at", "-id"),
        request,
    )
    return JsonResponse({"results": [serialize_payment(item) for item in queryset[:30]]})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def booking_detail_api(request, booking_id):
    try:
        booking = hotel_scoped_get(
            Booking.objects.select_related("guest", "room_type", "room__room_type"),
            request,
            pk=booking_id,
        )
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)
    return JsonResponse(build_booking_detail(booking))


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def stay_detail_api(request, stay_id):
    try:
        stay = hotel_scoped_get(
            Stay.objects.select_related("guest", "room__room_type", "booking__guest", "booking__room_type", "booking__room"),
            request,
            pk=stay_id,
        )
    except Stay.DoesNotExist:
        return JsonResponse({"detail": "Sejour introuvable."}, status=404)
    return JsonResponse(build_stay_detail(stay))


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def day_use_detail_api(request, day_use_id):
    try:
        day_use = hotel_scoped_get(DayUse.objects.select_related("guest", "room__room_type"), request, pk=day_use_id)
    except DayUse.DoesNotExist:
        return JsonResponse({"detail": "Day use introuvable."}, status=404)
    return JsonResponse(build_day_use_detail(day_use))


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def payment_detail_api(request, payment_id):
    try:
        payment = hotel_scoped_get(
            Payment.objects.select_related(
                "client",
                "booking__guest",
                "booking__room_type",
                "booking__room",
                "stay__guest",
                "stay__room",
                "day_use__guest",
                "day_use__room",
                "invoice__client",
                "invoice__stay",
            ),
            request,
            pk=payment_id,
        )
    except Payment.DoesNotExist:
        return JsonResponse({"detail": "Paiement introuvable."}, status=404)
    return JsonResponse(build_payment_detail(payment))


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="view")
def operations_board_api(request):
    search = request.GET.get("search", "").strip()
    actor_id = request.GET.get("actor_id", "").strip()
    today = timezone.localdate()

    arrivals_queryset = hotel_scoped(Booking.objects.select_related("guest", "room_type", "room"), request).filter(
        check_in_date=today,
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
    ).order_by("status", "created_at")
    departures_queryset = hotel_scoped(Stay.objects.select_related("guest", "room"), request).filter(
        status=Stay.Status.IN_PROGRESS,
        expected_check_out_date=today,
    ).order_by("expected_check_out_date", "check_in_at")
    cleaning_queryset = hotel_scoped(Room.objects.select_related("room_type"), request).filter(
        status=Room.Status.CLEANING,
        is_active=True,
    ).order_by("floor", "number")
    day_use_cash_queryset = hotel_scoped(DayUse.objects.select_related("guest", "room"), request).filter(
        status=DayUse.Status.PENDING_PAYMENT,
    ).order_by("planned_entry_at", "created_at")
    day_use_ready_queryset = hotel_scoped(DayUse.objects.select_related("guest", "room"), request).filter(
        status=DayUse.Status.READY,
    ).order_by("planned_entry_at", "created_at")
    day_use_in_progress_queryset = hotel_scoped(DayUse.objects.select_related("guest", "room"), request).filter(
        status=DayUse.Status.IN_PROGRESS,
    ).order_by("check_in_at", "planned_entry_at")

    if search:
        arrivals_queryset = arrivals_queryset.filter(
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(room__number__icontains=search)
        )
        departures_queryset = departures_queryset.filter(
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(room__number__icontains=search)
        )
        cleaning_queryset = cleaning_queryset.filter(
            Q(number__icontains=search) | Q(room_type__name__icontains=search)
        )
        day_use_filter = (
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(room__number__icontains=search)
        )
        day_use_cash_queryset = day_use_cash_queryset.filter(day_use_filter)
        day_use_ready_queryset = day_use_ready_queryset.filter(day_use_filter)
        day_use_in_progress_queryset = day_use_in_progress_queryset.filter(day_use_filter)

    arrivals = []
    for item in arrivals_queryset[:30]:
        payload = serialize_booking(item)
        payload["priority"] = priority_payload(
            "high" if item.status == Booking.Status.PENDING else "medium",
            "Accueil immediat" if item.status == Booking.Status.PENDING else "Confirmee",
            "Avant 14:00 aujourd'hui",
        )
        arrivals.append(payload)

    departures = []
    for item in departures_queryset[:30]:
        payload = serialize_stay(item)
        payload["priority"] = priority_payload("medium", "Depart a cloturer", "Avant 12:00 aujourd'hui")
        departures.append(payload)

    cleaning_rooms = []
    for item in cleaning_queryset[:30]:
        payload = serialize_cleaning_room(item)
        payload["priority"] = priority_payload("medium", "Rotation chambre", "Remise en vente aujourd'hui")
        cleaning_rooms.append(payload)

    day_use_cash = []
    for item in day_use_cash_queryset[:30]:
        payload = serialize_day_use(item)
        payload["priority"] = priority_payload("high", "Paiement bloque", "Avant entree day use")
        day_use_cash.append(payload)

    day_use_ready = []
    for item in day_use_ready_queryset[:30]:
        payload = serialize_day_use(item)
        payload["priority"] = priority_payload("medium", "Pret a entrer", "Dans l'heure de l'entree prevue")
        day_use_ready.append(payload)

    day_use_in_progress = []
    for item in day_use_in_progress_queryset[:30]:
        payload = serialize_day_use(item)
        payload["priority"] = priority_payload("medium", "Sortie a suivre", "Avant remise en nettoyage")
        day_use_in_progress.append(payload)

    supervisor_users_queryset = hotel_scoped(
        User.objects.filter(is_active=True, role=User.Role.RECEPTION),
        request,
    ).order_by("first_name", "last_name", "username")
    supervisor_users = [serialize_supervisor_user(item) for item in supervisor_users_queryset]

    journal_queryset = HistoryEntry.objects.select_related("actor").filter(
        module__in=["bookings", "stays", "billing", "rooms"]
    )
    active_hotel = get_request_hotel(request)
    if active_hotel is not None:
        journal_queryset = journal_queryset.filter(hotel=active_hotel)
    if actor_id.isdigit():
        journal_queryset = journal_queryset.filter(actor_id=int(actor_id))
    journal_queryset = journal_queryset.order_by("-created_at", "-id")[:20]
    journal = [serialize_supervisor_history(item) for item in journal_queryset]

    notifications = []
    if arrivals:
        notifications.append(
            {
                "level": "high" if any(item["priority"]["level"] == "high" for item in arrivals) else "medium",
                "title": "Arrivees du jour a traiter",
                "message": f"{len(arrivals)} arrivee(s) encore ouvertes dans la file d'accueil.",
            }
        )
    if cleaning_rooms:
        notifications.append(
            {
                "level": "medium",
                "title": "Chambres en attente de remise",
                "message": f"{len(cleaning_rooms)} chambre(s) sont encore en nettoyage.",
            }
        )
    if day_use_cash:
        notifications.append(
            {
                "level": "high",
                "title": "Day use bloques au paiement",
                "message": f"{len(day_use_cash)} day use demandent un encaissement avant entree.",
            }
        )
    if len(journal) >= 8:
        notifications.append(
            {
                "level": "low",
                "title": "Activite soutenue reception",
                "message": f"{len(journal)} action(s) recentes remontees dans le journal d'exploitation.",
            }
        )

    return JsonResponse(
        {
            "date": today.isoformat(),
            "search": search,
            "actor_id": actor_id,
            "supervisor_users": supervisor_users,
            "summary_cards": [
                {"label": "Arrivees du jour", "value": len(arrivals), "meta": "Reservations a accueillir aujourd'hui"},
                {"label": "Departs du jour", "value": len(departures), "meta": "Sejours a cloturer aujourd'hui"},
                {"label": "Chambres nettoyage", "value": len(cleaning_rooms), "meta": "Chambres a remettre disponibles"},
                {"label": "Day use a encaisser", "value": len(day_use_cash), "meta": "Paiements a regulariser avant entree"},
            ],
            "notifications": notifications,
            "journal": journal,
            "queues": {
                "arrivals": arrivals,
                "departures": departures,
                "cleaning": cleaning_rooms,
                "day_use_pending_payment": day_use_cash,
                "day_use_ready": day_use_ready,
                "day_use_in_progress": day_use_in_progress,
            },
        }
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def update_booking_api(request, booking_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        booking = hotel_scoped_get(Booking.objects.all(), request, pk=booking_id)
        payload = parse_json_body(request)
        next_room_id = payload.get("room_id") or None
        if get_booking_stay(booking) and str(next_room_id or "") != str(booking.room_id or ""):
            raise ValidationError({"room_id": "La chambre ne peut plus etre modifiee apres creation du sejour."})
        booking.room_id = next_room_id
        booking.source = payload.get("source") or booking.source
        booking.check_in_date = parse_date(payload.get("check_in_date"), "check_in_date")
        booking.check_out_date = parse_date(payload.get("check_out_date"), "check_out_date")
        booking.adults = payload.get("adults") or 1
        booking.children = payload.get("children") or 0
        booking.estimated_amount = payload.get("estimated_amount") or 0
        booking.notes = payload.get("notes") or ""
        booking.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=booking.reference,
            description=f"Reservation {booking.reference} mise a jour via le poste de travail.",
            actor=request.user,
            metadata={"booking_id": booking.id},
        )
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": "Reservation mise a jour.", "booking": serialize_booking(booking)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def update_stay_api(request, stay_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        stay = hotel_scoped_get(Stay.objects.all(), request, pk=stay_id)
        if stay.status != Stay.Status.IN_PROGRESS:
            raise ValidationError({"status": "Seul un sejour actif peut etre ajuste depuis cet ecran."})
        payload = parse_json_body(request)
        planned_check_out = payload.get("planned_check_out")
        stay.planned_check_out = parse_datetime(planned_check_out, "planned_check_out") if planned_check_out else None
        stay.expected_check_out_date = stay.planned_check_out.date() if stay.planned_check_out else parse_date(
            payload.get("expected_check_out_date"), "expected_check_out_date"
        )
        stay.adults = payload.get("adults") or 1
        stay.adults_count = payload.get("adults_count") or stay.adults or 1
        stay.children = payload.get("children") or 0
        stay.children_count = payload.get("children_count") or stay.children or 0
        stay.number_of_guests = payload.get("number_of_guests") or (stay.adults_count + stay.children_count)
        stay.purpose_of_stay = payload.get("purpose_of_stay") or ""
        stay.special_requests = payload.get("special_requests") or ""
        stay.notes = payload.get("notes") or ""
        stay.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="stays",
            entity_type="Stay",
            entity_reference=stay.reference,
            description=f"Sejour {stay.reference} ajuste via le poste de travail.",
            actor=request.user,
            metadata={"stay_id": stay.id},
        )
    except Stay.DoesNotExist:
        return JsonResponse({"detail": "Sejour introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": "Sejour mis a jour.", "stay": serialize_stay(stay)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="create")
def create_stay_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payload = parse_json_body(request)
        guest = hotel_scoped_get(Guest.objects.all(), request, pk=payload.get("guest_id"))
        room = hotel_scoped_get(Room.objects.select_related("room_type"), request, pk=payload.get("room_id"))
        planned_check_in = parse_datetime(payload.get("planned_check_in"), "planned_check_in") if payload.get("planned_check_in") else None
        actual_check_in = parse_datetime(payload.get("actual_check_in"), "actual_check_in") if payload.get("actual_check_in") else timezone.now()
        planned_check_out = parse_datetime(payload.get("planned_check_out"), "planned_check_out") if payload.get("planned_check_out") else None
        stay = Stay.create_walk_in(
            guest=guest,
            room=room,
            planned_check_in=planned_check_in,
            actual_check_in=actual_check_in,
            planned_check_out=planned_check_out,
            adults_count=int(payload.get("adults_count") or payload.get("adults") or 1),
            children_count=int(payload.get("children_count") or payload.get("children") or 0),
            source=payload.get("source") or Stay.Source.WALK_IN,
            purpose_of_stay=payload.get("purpose_of_stay") or "",
            notes=payload.get("notes") or "",
            special_requests=payload.get("special_requests") or "",
            actor=request.user,
        )
    except Guest.DoesNotExist:
        return JsonResponse({"detail": "Client introuvable."}, status=404)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": f"Sejour {stay.reference} cree avec succes.",
            "stay": serialize_stay(stay),
        },
        status=201,
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def update_day_use_api(request, day_use_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        day_use = hotel_scoped_get(DayUse.objects.all(), request, pk=day_use_id)
        payload = parse_json_body(request)
        next_room_id = payload.get("room_id") or day_use.room_id
        if str(next_room_id) != str(day_use.room_id):
            if day_use.status != DayUse.Status.PENDING_PAYMENT:
                raise ValidationError(
                    {"room_id": "La chambre ne peut etre modifiee qu'avant l'entree effective du day use."}
                )
        day_use.room_id = next_room_id
        day_use.package_price = payload.get("package_price") or 0
        day_use.overtime_choice = payload.get("overtime_choice") or DayUse.OvertimeChoice.NONE
        day_use.overtime_fee = payload.get("overtime_fee") or 0
        day_use.planned_entry_at = parse_datetime(payload.get("planned_entry_at"), "planned_entry_at")
        day_use.notes = payload.get("notes") or ""
        day_use.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="DayUse",
            entity_reference=day_use.reference,
            description=f"Day use {day_use.reference} mis a jour via le poste de travail.",
            actor=request.user,
            metadata={"day_use_id": day_use.id},
        )
    except DayUse.DoesNotExist:
        return JsonResponse({"detail": "Day use introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": "Day use mis a jour.", "day_use": serialize_day_use(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def update_payment_api(request, payment_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payment = hotel_scoped_get(Payment.objects.all(), request, pk=payment_id)
        payload = parse_json_body(request)
        payment.status = payload.get("status") or payment.status
        payment.method = payload.get("method") or payment.method
        payment.payment_type = payload.get("payment_type") or payment.payment_type
        payment.amount = payload.get("amount") or payment.amount
        payment.paid_at = parse_datetime(payload.get("paid_at"), "paid_at")
        payment.notes = payload.get("notes") or ""
        payment.source = payload.get("source") or payment.source
        payment.external_reference = payload.get("external_reference") or payment.external_reference
        payment.currency = payload.get("currency") or payment.currency
        payment.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="Payment",
            entity_reference=payment.reference,
            description=f"Paiement {payment.reference} corrige via le poste de travail.",
            actor=request.user,
            metadata={"payment_id": payment.id},
        )
    except Payment.DoesNotExist:
        return JsonResponse({"detail": "Paiement introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": "Paiement mis a jour.", "payment": serialize_payment(payment)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def confirm_booking_api(request, booking_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        booking = hotel_scoped_get(Booking.objects.all(), request, pk=booking_id)
        if booking.status != Booking.Status.PENDING:
            raise ValidationError("Seule une reservation en attente peut etre confirmee.")
        booking.status = Booking.Status.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=booking.reference,
            description=f"Reservation {booking.reference} confirmee via le poste de travail.",
            actor=request.user,
            metadata={"booking_id": booking.id, "status": booking.status},
        )
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Reservation {booking.reference} confirmee.", "booking": serialize_booking(booking)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def cancel_booking_api(request, booking_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        booking = hotel_scoped_get(Booking.objects.all(), request, pk=booking_id)
        if get_booking_stay(booking):
            raise ValidationError("Une reservation convertie en sejour ne peut plus etre annulee.")
        if booking.status not in {Booking.Status.PENDING, Booking.Status.CONFIRMED}:
            raise ValidationError("Cette reservation ne peut pas etre annulee dans son etat actuel.")
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=booking.reference,
            description=f"Reservation {booking.reference} annulee via le poste de travail.",
            actor=request.user,
            metadata={"booking_id": booking.id, "status": booking.status},
        )
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Reservation {booking.reference} annulee.", "booking": serialize_booking(booking)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def refund_payment_api(request, payment_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payment = hotel_scoped_get(Payment.objects.select_related("day_use"), request, pk=payment_id)
        if payment.status != Payment.Status.PAID:
            raise ValidationError("Seul un paiement paye peut etre rembourse.")
        payment.status = Payment.Status.REFUNDED
        payment.payment_type = Payment.PaymentType.REFUND
        payment.save(update_fields=["status", "payment_type", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="Payment",
            entity_reference=payment.reference,
            description=f"Paiement {payment.reference} rembourse via le poste de travail.",
            actor=request.user,
            metadata={"payment_id": payment.id, "status": payment.status},
        )
        if payment.day_use_id:
            payment.day_use.refresh_payment_status()
    except Payment.DoesNotExist:
        return JsonResponse({"detail": "Paiement introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Paiement {payment.reference} rembourse.", "payment": serialize_payment(payment)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def cancel_payment_api(request, payment_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payment = hotel_scoped_get(Payment.objects.select_related("day_use"), request, pk=payment_id)
        if payment.status not in {Payment.Status.PENDING, Payment.Status.PAID}:
            raise ValidationError("Ce paiement ne peut pas etre annule dans son etat actuel.")
        payment.status = Payment.Status.CANCELLED
        payment.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="Payment",
            entity_reference=payment.reference,
            description=f"Paiement {payment.reference} annule via le poste de travail.",
            actor=request.user,
            metadata={"payment_id": payment.id, "status": payment.status},
        )
        if payment.day_use_id:
            payment.day_use.refresh_payment_status()
    except Payment.DoesNotExist:
        return JsonResponse({"detail": "Paiement introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Paiement {payment.reference} annule.", "payment": serialize_payment(payment)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def complete_room_cleaning_api(request, room_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        room = hotel_scoped_get(Room.objects.all(), request, pk=room_id)
        room.complete_cleaning()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Nettoyage confirme via le poste de travail pour la chambre {room.number}.",
            actor=request.user,
            metadata={"room_id": room.id, "status": room.status},
        )
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": f"Nettoyage termine pour la chambre {room.number}.",
            "room": serialize_room(hotel_scoped_get(Room.objects.select_related("room_type"), request, pk=room_id)),
        }
    )


def _collect_ids(payload, key):
    ids = payload.get(key) or []
    if not isinstance(ids, list) or not all(str(item).isdigit() for item in ids):
        raise ValidationError({key: "La liste d'identifiants est invalide."})
    return [int(item) for item in ids]


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def bulk_booking_check_in_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    processed = 0
    errors = []
    try:
        payload = parse_json_body(request)
        booking_ids = _collect_ids(payload, "booking_ids")
        for booking in hotel_scoped(
            Booking.objects.select_related("guest", "room", "room_type").filter(id__in=booking_ids),
            request,
        ):
            try:
                Stay.create_from_booking(booking, actor=request.user)
                processed += 1
            except ValidationError as error:
                errors.append({"reference": booking.reference, "message": "; ".join(sum(format_validation_error(error).values(), []))})
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    if processed:
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="stays",
            entity_type="BulkAction",
            entity_reference="bulk-booking-check-in",
            description=f"{processed} check-in(s) effectue(s) en masse.",
            actor=request.user,
            metadata={"processed": processed, "errors": errors},
        )

    return JsonResponse({"message": f"{processed} check-in(s) effectue(s).", "processed": processed, "errors": errors})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def bulk_stay_check_out_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    processed = 0
    errors = []
    try:
        payload = parse_json_body(request)
        stay_ids = _collect_ids(payload, "stay_ids")
        for stay in hotel_scoped(Stay.objects.select_related("guest", "room").filter(id__in=stay_ids), request):
            try:
                stay.complete_checkout(actor=request.user)
                processed += 1
            except ValidationError as error:
                errors.append({"reference": stay.reference, "message": "; ".join(sum(format_validation_error(error).values(), []))})
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    if processed:
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="stays",
            entity_type="BulkAction",
            entity_reference="bulk-stay-check-out",
            description=f"{processed} check-out(s) effectue(s) en masse.",
            actor=request.user,
            metadata={"processed": processed, "errors": errors},
        )

    return JsonResponse({"message": f"{processed} check-out(s) effectue(s).", "processed": processed, "errors": errors})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def bulk_day_use_check_in_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    processed = 0
    errors = []
    try:
        payload = parse_json_body(request)
        day_use_ids = _collect_ids(payload, "day_use_ids")
        for day_use in hotel_scoped(DayUse.objects.select_related("guest", "room").filter(id__in=day_use_ids), request):
            try:
                day_use.perform_check_in()
                processed += 1
            except ValidationError as error:
                errors.append({"reference": day_use.reference, "message": "; ".join(sum(format_validation_error(error).values(), []))})
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    if processed:
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="BulkAction",
            entity_reference="bulk-day-use-check-in",
            description=f"{processed} entree(s) day use effectuee(s) en masse.",
            actor=request.user,
            metadata={"processed": processed, "errors": errors},
        )

    return JsonResponse({"message": f"{processed} entree(s) day use effectuee(s).", "processed": processed, "errors": errors})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def bulk_day_use_check_out_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    processed = 0
    errors = []
    try:
        payload = parse_json_body(request)
        day_use_ids = _collect_ids(payload, "day_use_ids")
        for day_use in hotel_scoped(DayUse.objects.select_related("guest", "room").filter(id__in=day_use_ids), request):
            try:
                day_use.perform_check_out()
                processed += 1
            except ValidationError as error:
                errors.append({"reference": day_use.reference, "message": "; ".join(sum(format_validation_error(error).values(), []))})
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    if processed:
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="BulkAction",
            entity_reference="bulk-day-use-check-out",
            description=f"{processed} sortie(s) day use effectuee(s) en masse.",
            actor=request.user,
            metadata={"processed": processed, "errors": errors},
        )

    return JsonResponse({"message": f"{processed} sortie(s) day use effectuee(s).", "processed": processed, "errors": errors})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def bulk_complete_cleaning_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    processed = 0
    errors = []
    try:
        payload = parse_json_body(request)
        room_ids = _collect_ids(payload, "room_ids")
        for room in hotel_scoped(Room.objects.filter(id__in=room_ids), request):
            try:
                room.complete_cleaning()
                processed += 1
            except ValidationError as error:
                errors.append({"reference": room.number, "message": "; ".join(sum(format_validation_error(error).values(), []))})
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    if processed:
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="BulkAction",
            entity_reference="bulk-complete-cleaning",
            description=f"{processed} nettoyage(s) cloture(s) en masse.",
            actor=request.user,
            metadata={"processed": processed, "errors": errors},
        )

    return JsonResponse({"message": f"{processed} nettoyage(s) cloture(s).", "processed": processed, "errors": errors})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="create")
def create_booking_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payload = parse_json_body(request)
        guest = hotel_scoped_get(Guest.objects.all(), request, pk=payload.get("guest_id"))
        room_type = hotel_scoped_get(RoomType.objects.all(), request, pk=payload.get("room_type_id"))
        room = None
        if payload.get("room_id"):
            room = hotel_scoped_get(Room.objects.all(), request, pk=payload.get("room_id"))
        booking = Booking(
            guest=guest,
            room_type=room_type,
            room=room,
            hotel=get_request_hotel(request),
            source=payload.get("source") or Booking.BookingSource.WALK_IN,
            check_in_date=parse_date(payload.get("check_in_date"), "check_in_date"),
            check_out_date=parse_date(payload.get("check_out_date"), "check_out_date"),
            adults=payload.get("adults") or 1,
            children=payload.get("children") or 0,
            estimated_amount=payload.get("estimated_amount") or 0,
            notes=payload.get("notes") or "",
        )
        booking.save()
    except Guest.DoesNotExist:
        return JsonResponse({"detail": "Client introuvable."}, status=404)
    except RoomType.DoesNotExist:
        return JsonResponse({"detail": "Type de chambre introuvable."}, status=404)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": "Reservation creee.",
            "booking": serialize_booking(booking),
        },
        status=201,
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="create")
def create_day_use_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payload = parse_json_body(request)
        guest = hotel_scoped_get(Guest.objects.all(), request, pk=payload.get("guest_id"))
        room = hotel_scoped_get(Room.objects.all(), request, pk=payload.get("room_id"))
        day_use = DayUse(
            guest=guest,
            room=room,
            hotel=get_request_hotel(request),
            package_price=payload.get("package_price") or 0,
            overtime_choice=payload.get("overtime_choice") or DayUse.OvertimeChoice.NONE,
            overtime_fee=payload.get("overtime_fee") or 0,
            planned_entry_at=parse_datetime(payload.get("planned_entry_at"), "planned_entry_at"),
            notes=payload.get("notes") or "",
        )
        day_use.save()
    except Guest.DoesNotExist:
        return JsonResponse({"detail": "Client introuvable."}, status=404)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Chambre introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": "Day use cree.",
            "day_use": serialize_day_use(day_use),
        },
        status=201,
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="create")
def create_payment_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payload = parse_json_body(request)
        client = hotel_scoped_get(Guest.objects.all(), request, pk=payload.get("client_id")) if payload.get("client_id") else None
        booking = hotel_scoped_get(Booking.objects.all(), request, pk=payload.get("booking_id")) if payload.get("booking_id") else None
        stay = hotel_scoped_get(Stay.objects.all(), request, pk=payload.get("stay_id")) if payload.get("stay_id") else None
        day_use = hotel_scoped_get(DayUse.objects.all(), request, pk=payload.get("day_use_id")) if payload.get("day_use_id") else None
        invoice = hotel_scoped_get(ClientInvoice.objects.all(), request, pk=payload.get("invoice_id")) if payload.get("invoice_id") else None
        payment = Payment(
            client=client,
            booking=booking,
            stay=stay,
            day_use=day_use,
            invoice=invoice,
            hotel=get_request_hotel(request),
            status=payload.get("status") or Payment.Status.PAID,
            payment_type=payload.get("payment_type") or Payment.PaymentType.PARTIAL,
            method=payload.get("method") or Payment.Method.CASH,
            amount=payload.get("amount") or 0,
            paid_at=parse_datetime(payload.get("paid_at"), "paid_at"),
            notes=payload.get("notes") or "",
            source=payload.get("source") or "",
            external_reference=payload.get("external_reference") or "",
            currency=payload.get("currency") or "XOF",
            recorded_by=request.user,
        )
        payment.save()
    except Guest.DoesNotExist:
        return JsonResponse({"detail": "Client introuvable."}, status=404)
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)
    except Stay.DoesNotExist:
        return JsonResponse({"detail": "Sejour introuvable."}, status=404)
    except DayUse.DoesNotExist:
        return JsonResponse({"detail": "Day use introuvable."}, status=404)
    except ClientInvoice.DoesNotExist:
        return JsonResponse({"detail": "Facture introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": "Paiement enregistre.",
            "payment": serialize_payment(payment),
        },
        status=201,
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def booking_check_in_api(request, booking_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        payload = parse_json_body(request)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    try:
        booking = hotel_scoped_get(Booking.objects.select_related("guest", "room", "room_type"), request, pk=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"detail": "Reservation introuvable."}, status=404)

    room = None
    room_id = payload.get("room_id")
    if room_id:
        try:
            room = hotel_scoped_get(Room.objects.all(), request, pk=room_id)
        except Room.DoesNotExist:
            return JsonResponse({"detail": "Chambre introuvable."}, status=404)

    try:
        with transaction.atomic():
            if room_id and room:
                if room.room_type_id != booking.room_type_id:
                    raise ValidationError({"room_id": "La chambre choisie ne correspond pas au type reserve."})
                booking.room = room
                booking.save(update_fields=["room", "updated_at"])
            stay = Stay.create_from_booking(booking, room=room, actor=request.user)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse(
        {
            "message": f"Check-in effectue pour {booking.reference}.",
            "booking": serialize_booking(booking),
            "stay": serialize_stay(stay),
        }
    )


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def stay_check_out_api(request, stay_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        stay = hotel_scoped_get(Stay.objects.select_related("guest", "room"), request, pk=stay_id)
        stay.complete_checkout(actor=request.user)
        stay.refresh_from_db()
    except Stay.DoesNotExist:
        return JsonResponse({"detail": "Sejour introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Check-out effectue pour {stay.reference}.", "stay": serialize_stay(stay)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def day_use_check_in_api(request, day_use_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        day_use = hotel_scoped_get(DayUse.objects.select_related("guest", "room"), request, pk=day_use_id)
        day_use.perform_check_in()
        day_use.refresh_from_db()
    except DayUse.DoesNotExist:
        return JsonResponse({"detail": "Day use introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Entree effectuee pour {day_use.reference}.", "day_use": serialize_day_use(day_use)})


@api_login_required
@module_hotel_scope_required("operations")
@module_permission_required("operations", action="update")
def day_use_check_out_api(request, day_use_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)

    try:
        day_use = hotel_scoped_get(DayUse.objects.select_related("guest", "room"), request, pk=day_use_id)
        day_use.perform_check_out()
        day_use.refresh_from_db()
    except DayUse.DoesNotExist:
        return JsonResponse({"detail": "Day use introuvable."}, status=404)
    except ValidationError as error:
        return JsonResponse({"errors": format_validation_error(error)}, status=400)

    return JsonResponse({"message": f"Sortie effectuee pour {day_use.reference}.", "day_use": serialize_day_use(day_use)})
