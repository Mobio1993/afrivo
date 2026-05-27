from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.bookings.models import Booking, validate_room_not_overlapping
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.operations.models import RoomRelocation
from apps.rooms.models import Room, RoomHousekeepingTask
from apps.rooms.services import sync_room_operational_status
from apps.stays.models import Stay


def _normalize_reason(reason):
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Le motif du relogement est obligatoire."})
    return reason


def _validate_same_hotel(*, target, room):
    if target.hotel_id and room.hotel_id and target.hotel_id != room.hotel_id:
        raise ValidationError({"new_room_id": "La nouvelle chambre doit appartenir au meme hotel."})


def _validate_new_room_base(*, current_room, new_room):
    if not new_room.is_active:
        raise ValidationError({"new_room_id": "La nouvelle chambre est inactive."})
    if new_room.status == Room.Status.OUT_OF_SERVICE:
        raise ValidationError({"new_room_id": "La nouvelle chambre est hors service."})
    if current_room and current_room.id == new_room.id:
        raise ValidationError({"new_room_id": "La nouvelle chambre doit etre differente de l'ancienne."})


def _booking_amount(booking):
    return booking.estimated_amount or Decimal("0.00")


def _stay_amount(stay):
    if stay.booking_id:
        return _booking_amount(stay.booking)
    return Decimal("0.00")


def _create_housekeeping_after_stay_relocation(*, hotel, room, stay):
    room.status = Room.Status.CLEANING
    room.save(update_fields=["status", "updated_at"])

    if not RoomHousekeepingTask.objects.filter(
        hotel=hotel,
        room=room,
        status__in=[RoomHousekeepingTask.Status.PENDING, RoomHousekeepingTask.Status.IN_PROGRESS],
    ).exists():
        RoomHousekeepingTask.objects.create(
            hotel=hotel,
            room=room,
            task_type=RoomHousekeepingTask.TaskType.TURNOVER,
            status=RoomHousekeepingTask.Status.PENDING,
            priority=RoomHousekeepingTask.Priority.HIGH,
            notes=f"Nettoyage requis apres relogement du sejour {stay.reference}.",
        )


def serialize_relocation(relocation):
    return {
        "id": relocation.id,
        "hotel_id": relocation.hotel_id,
        "booking_id": relocation.booking_id,
        "stay_id": relocation.stay_id,
        "guest_id": relocation.guest_id,
        "old_room_id": relocation.old_room_id,
        "old_room_number": relocation.old_room.number,
        "new_room_id": relocation.new_room_id,
        "new_room_number": relocation.new_room.number,
        "old_room_type": relocation.old_room_type.name,
        "new_room_type": relocation.new_room_type.name,
        "reason": relocation.reason,
        "rate_impact_mode": relocation.rate_impact_mode,
        "old_amount": f"{relocation.old_amount:.2f}",
        "new_amount": f"{relocation.new_amount:.2f}",
        "created_by": relocation.created_by.get_full_name() or relocation.created_by.username if relocation.created_by_id else "",
        "created_at": timezone.localtime(relocation.created_at).isoformat(),
    }


def relocate_booking(*, booking, new_room, reason, actor=None, rate_impact_mode=RoomRelocation.RateImpactMode.KEEP_ORIGINAL, notes=""):
    reason = _normalize_reason(reason)

    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(pk=booking.pk)
        new_room = Room.objects.select_for_update().select_related("room_type").get(pk=new_room.pk)
        old_room = booking.room

        if booking.status not in {Booking.Status.PENDING, Booking.Status.CONFIRMED}:
            raise ValidationError({"status": "Seule une reservation en attente ou confirmee peut etre relogee avant check-in."})
        if hasattr(booking, "stay"):
            raise ValidationError({"booking": "Cette reservation a deja un sejour. Utilise le relogement du sejour."})
        if not old_room:
            raise ValidationError({"room": "La reservation doit avoir une chambre avant d'etre relogee."})

        _validate_same_hotel(target=booking, room=new_room)
        _validate_new_room_base(current_room=old_room, new_room=new_room)

        if new_room.room_type_id != booking.room_type_id:
            raise ValidationError({"new_room_id": "La nouvelle chambre doit correspondre au type de chambre reserve."})

        validate_room_not_overlapping(
            room=new_room,
            check_in_date=booking.check_in_date,
            check_out_date=booking.check_out_date,
            exclude_booking=booking,
            message="La nouvelle chambre est deja reservee sur cette periode.",
        )

        old_amount = _booking_amount(booking)
        new_amount = old_amount
        booking.room = new_room
        booking.save(update_fields=["room", "updated_at"])

        sync_room_operational_status(old_room)
        sync_room_operational_status(new_room)

        relocation = RoomRelocation.objects.create(
            hotel=booking.hotel,
            booking=booking,
            guest=booking.guest,
            old_room=old_room,
            new_room=new_room,
            old_room_type=old_room.room_type,
            new_room_type=new_room.room_type,
            reason=reason,
            rate_impact_mode=rate_impact_mode or RoomRelocation.RateImpactMode.KEEP_ORIGINAL,
            old_amount=old_amount,
            new_amount=new_amount,
            notes=notes or "",
            created_by=actor,
        )

    log_history(
        action_type=HistoryEntry.ActionType.STATUS_UPDATED,
        module="operations",
        entity_type="RoomRelocation",
        entity_reference=booking.reference,
        description=f"Reservation {booking.reference} relogee de la chambre {old_room.number} vers {new_room.number}.",
        actor=actor,
        hotel=booking.hotel,
        metadata={
            "booking_id": booking.id,
            "guest_id": booking.guest_id,
            "relocation_id": relocation.id,
            "old_room_id": old_room.id,
            "new_room_id": new_room.id,
            "reason": reason,
        },
    )
    return relocation


def relocate_stay(*, stay, new_room, reason, actor=None, rate_impact_mode=RoomRelocation.RateImpactMode.KEEP_ORIGINAL, notes=""):
    reason = _normalize_reason(reason)

    with transaction.atomic():
        stay = Stay.objects.select_for_update().get(pk=stay.pk)
        new_room = Room.objects.select_for_update().select_related("room_type").get(pk=new_room.pk)
        old_room = stay.room

        if stay.status != Stay.Status.IN_PROGRESS:
            raise ValidationError({"status": "Seul un sejour en cours peut etre reloge."})

        _validate_same_hotel(target=stay, room=new_room)
        _validate_new_room_base(current_room=old_room, new_room=new_room)
        sync_room_operational_status(new_room)

        if new_room.status != Room.Status.AVAILABLE:
            raise ValidationError({"new_room_id": "La nouvelle chambre doit etre disponible pour reloger un sejour."})

        if stay.booking_id and new_room.room_type_id != stay.booking.room_type_id:
            raise ValidationError({"new_room_id": "La nouvelle chambre doit correspondre au type de chambre reserve."})
        if stay.number_of_guests > new_room.room_type.capacity:
            raise ValidationError({"new_room_id": "La nouvelle chambre ne peut pas accueillir tous les occupants."})

        old_amount = _stay_amount(stay)
        new_amount = old_amount

        if stay.booking_id:
            stay.booking.room = new_room
            stay.booking.save(update_fields=["room", "updated_at"])

        stay.room = new_room
        stay.save(update_fields=["room", "updated_at"])

        _create_housekeeping_after_stay_relocation(hotel=stay.hotel, room=old_room, stay=stay)
        sync_room_operational_status(new_room)

        relocation = RoomRelocation.objects.create(
            hotel=stay.hotel,
            stay=stay,
            guest=stay.guest,
            old_room=old_room,
            new_room=new_room,
            old_room_type=old_room.room_type,
            new_room_type=new_room.room_type,
            reason=reason,
            rate_impact_mode=rate_impact_mode or RoomRelocation.RateImpactMode.KEEP_ORIGINAL,
            old_amount=old_amount,
            new_amount=new_amount,
            notes=notes or "",
            created_by=actor,
        )

    log_history(
        action_type=HistoryEntry.ActionType.STATUS_UPDATED,
        module="operations",
        entity_type="RoomRelocation",
        entity_reference=stay.reference,
        description=f"Sejour {stay.reference} reloge de la chambre {old_room.number} vers {new_room.number}.",
        actor=actor,
        hotel=stay.hotel,
        metadata={
            "stay_id": stay.id,
            "booking_id": stay.booking_id,
            "guest_id": stay.guest_id,
            "relocation_id": relocation.id,
            "old_room_id": old_room.id,
            "new_room_id": new_room.id,
            "reason": reason,
        },
    )
    return relocation
