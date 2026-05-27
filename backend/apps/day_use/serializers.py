from django.utils import timezone

from apps.billing.models import Payment
from apps.bookings.models import DayUse


def iso_datetime(value):
    return timezone.localtime(value).isoformat() if value else ""


def money(value):
    return f"{value or 0:.2f}"


class DayUseSerializer:
    @staticmethod
    def serialize(item):
        item.refresh_financials(save=False)
        remaining_seconds = None
        if item.end_datetime and item.status == DayUse.Status.IN_PROGRESS:
            remaining_seconds = int((item.end_datetime - timezone.now()).total_seconds())
        return {
            "id": item.id,
            "reference": item.reference,
            "client_id": item.guest_id,
            "client_name": item.guest.full_name,
            "client_phone": item.guest.phone or "-",
            "room_id": item.room_id,
            "room": item.room.number,
            "room_type": item.room.room_type.name,
            "status": item.status,
            "status_label": item.get_status_display(),
            "payment_status": item.payment_status,
            "payment_status_label": item.get_payment_status_display(),
            "start_datetime": iso_datetime(item.start_datetime or item.planned_entry_at),
            "end_datetime": iso_datetime(item.end_datetime),
            "expected_duration_hours": item.expected_duration_hours,
            "actual_duration_hours": str(item.actual_duration_hours),
            "hourly_rate": money(item.hourly_rate),
            "subtotal_amount": money(item.subtotal_amount),
            "discount_amount": money(item.discount_amount),
            "overtime_amount": money(item.overtime_amount),
            "extension_amount": money(item.extension_amount),
            "final_amount": money(item.final_amount or item.total_amount),
            "amount_paid": money(item.amount_paid),
            "remaining_amount": money(item.remaining_amount),
            "checked_in_at": iso_datetime(item.checked_in_at or item.check_in_at),
            "checked_out_at": iso_datetime(item.checked_out_at or item.check_out_at),
            "extension_count": item.extension_count,
            "converted_to_night": item.converted_to_night,
            "converted_reservation_id": item.converted_reservation_id,
            "cancellation_reason": item.cancellation_reason,
            "no_show_reason": item.no_show_reason,
            "notes": item.notes or "",
            "remaining_seconds": remaining_seconds,
            "alerts": build_day_use_alerts(item, remaining_seconds),
            "can_check_in": item.status in {DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY},
            "can_check_out": item.status in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME},
            "can_extend": item.status in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME},
            "can_cancel": item.status not in {DayUse.Status.COMPLETED, DayUse.Status.CANCELLED, DayUse.Status.NO_SHOW, DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME},
            "can_no_show": item.status in {DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY} and not item.check_in_at,
        }


class DayUseDetailSerializer:
    @staticmethod
    def serialize(item):
        payload = DayUseSerializer.serialize(item)
        payments = [
            DayUsePaymentSerializer.serialize(payment)
            for payment in item.payments.select_related("recorded_by").order_by("-paid_at", "-id")
        ]

        room = getattr(item, "room", None)
        guest = getattr(item, "guest", None)
        total_amount = item.final_amount or item.total_amount or item.package_price or 0
        amount_paid = item.amount_paid or 0

        status_step_map = {
            DayUse.Status.DRAFT: 0,
            DayUse.Status.PENDING_PAYMENT: 1,
            DayUse.Status.READY: 1,
            DayUse.Status.IN_PROGRESS: 2,
            DayUse.Status.OVERTIME: 2,
            DayUse.Status.COMPLETED: 5,
            DayUse.Status.CANCELLED: -1,
            DayUse.Status.NO_SHOW: -1,
        }

        payload.update(
            {
                "client_email": getattr(guest, "email", "") if guest else "",
                "client_nationalite": getattr(guest, "nationality", "") or getattr(guest, "nationalite", "") if guest else "",
                "chambre_numero": getattr(room, "number", "") if room else "",
                "chambre_type": getattr(getattr(room, "room_type", None), "name", "") if room else "",
                "chambre_statut": room.get_status_display() if room else "",
                "chambre_etage": getattr(room, "floor", "") if room else "",
                "montant_total": money(total_amount),
                "montant_encaisse": money(amount_paid),
                "solde_restant": money((total_amount or 0) - (amount_paid or 0)),
                "encaissements": payments,
                "payments": payments,
                "stepper_step": status_step_map.get(item.status, 1),
                "entree_prevue_formatted": iso_datetime(item.planned_entry_at or item.start_datetime),
                "formule": money(item.package_price or item.final_amount or item.total_amount),
                "supplement": money(item.overtime_fee or item.overtime_amount),
                "depassement": item.overtime_choice or "",
                "entree_prevue": iso_datetime(item.planned_entry_at or item.start_datetime),
                "entree_reelle": iso_datetime(item.checked_in_at or item.check_in_at),
                "sortie_reelle": iso_datetime(item.checked_out_at or item.check_out_at),
                "notes_internes": item.notes or "",
                "statut": item.status,
                "statut_display": item.get_status_display(),
                "hotel_name": item.hotel.name if item.hotel_id else "",
            }
        )
        return payload


def build_day_use_alerts(item, remaining_seconds):
    alerts = []
    if item.payment_status != DayUse.PaymentStatus.PAID:
        alerts.append({"type": "payment", "level": "warning", "message": "Paiement incomplet."})
    if remaining_seconds is not None:
        if remaining_seconds < 0:
            alerts.append({"type": "overtime", "level": "danger", "message": "Temps day use depasse."})
        elif remaining_seconds <= 5 * 60:
            alerts.append({"type": "ending", "level": "danger", "message": "Fin dans moins de 5 minutes."})
        elif remaining_seconds <= 15 * 60:
            alerts.append({"type": "ending", "level": "warning", "message": "Fin dans moins de 15 minutes."})
    return alerts


class DayUsePaymentSerializer:
    @staticmethod
    def serialize(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "amount": money(item.amount),
            "status": item.status,
            "status_label": item.get_status_display(),
            "method": item.method,
            "method_label": item.get_method_display(),
            "paid_at": iso_datetime(item.paid_at),
            "recorded_by": item.recorded_by.get_full_name() or item.recorded_by.username if item.recorded_by_id else "-",
        }


def serialize_history_entry(item):
    actor = item.actor.get_full_name() or item.actor.username if item.actor_id else "Systeme"
    return {
        "id": item.id,
        "action": item.action_type,
        "action_label": item.get_action_type_display(),
        "description": item.description,
        "actor": actor,
        "created_at": iso_datetime(item.created_at),
        "metadata": item.metadata or {},
    }


def serialize_availability_room(room):
    return {
        "id": room.id,
        "number": room.number,
        "room_type": room.room_type.name,
        "floor": room.floor,
        "hourly_rate": money(room.effective_price_day_use),
        "status": room.status,
        "status_label": room.get_status_display(),
    }
