from datetime import date, timedelta

from django.db.models import Q, Sum
from django.utils import timezone

from apps.billing.models import Payment
from apps.bookings.models import Booking
from apps.rooms.models import Room
from apps.stays.models import Stay
from apps.tenants.services.tenant_service import TenantService

scope_queryset_to_hotel = TenantService.scope_queryset_to_hotel


class PlanningDateError(ValueError):
    pass


def _hotel_scoped(queryset, request, field_name="hotel"):
    return scope_queryset_to_hotel(queryset, request, field_name=field_name)


def _parse_planning_dates(request, today):
    start_str = (request.GET.get("start_date") or "").strip()
    end_str = (request.GET.get("end_date") or "").strip()

    try:
        start_date = date.fromisoformat(start_str) if start_str else today
        end_date = date.fromisoformat(end_str) if end_str else today + timedelta(days=13)
    except ValueError as exc:
        raise PlanningDateError("Dates invalides.") from exc

    if end_date < start_date:
        raise PlanningDateError("La date de fin doit etre posterieure a la date de debut.")

    return start_date, end_date


def build_operations_planning_payload(request):
    today = timezone.localdate()
    start_date, end_date = _parse_planning_dates(request, today)
    floor_filter = (request.GET.get("floor") or "").strip()
    room_status_filter = (request.GET.get("room_status") or "").strip()
    search = (request.GET.get("search") or "").strip()

    rooms_qs = _hotel_scoped(
        Room.objects.select_related("room_type").filter(is_active=True).order_by("floor", "number"),
        request,
    )
    if floor_filter.isdigit():
        rooms_qs = rooms_qs.filter(floor=int(floor_filter))
    if room_status_filter:
        rooms_qs = rooms_qs.filter(status=room_status_filter)
    if search:
        rooms_qs = rooms_qs.filter(Q(number__icontains=search) | Q(room_type__name__icontains=search))

    rooms = list(rooms_qs)
    room_id_set = {room.id for room in rooms}

    bookings_qs = _hotel_scoped(
        Booking.objects.select_related("guest", "room", "room_type").filter(
            status__in=[
                Booking.Status.PENDING,
                Booking.Status.CONFIRMED,
                Booking.Status.CHECKED_IN,
            ],
            check_in_date__lte=end_date,
            check_out_date__gt=start_date,
        ),
        request,
    )
    stays_qs = _hotel_scoped(
        Stay.objects.select_related("guest", "room")
        .filter(status=Stay.Status.IN_PROGRESS, check_in_at__date__lte=end_date)
        .filter(Q(expected_check_out_date__gte=start_date) | Q(expected_check_out_date__isnull=True)),
        request,
    )

    alerts = []
    room_bookings_map = {}
    for booking in bookings_qs:
        if booking.room_id:
            room_bookings_map.setdefault(booking.room_id, []).append(booking)

    for room_id, bookings in room_bookings_map.items():
        if len(bookings) < 2:
            continue
        sorted_bookings = sorted(bookings, key=lambda item: item.check_in_date)
        for index in range(len(sorted_bookings) - 1):
            first = sorted_bookings[index]
            second = sorted_bookings[index + 1]
            if first.check_out_date > second.check_in_date:
                alerts.append(
                    {
                        "type": "overlap",
                        "severity": "high",
                        "room_id": room_id,
                        "booking_id": first.id,
                        "target_type": "booking",
                        "target_id": first.id,
                        "message": f"Conflit de reservation : {first.reference} et {second.reference} se chevauchent.",
                    }
                )

    out_of_service_ids = {room.id for room in rooms if room.status == Room.Status.OUT_OF_SERVICE}
    for booking in bookings_qs:
        if booking.room_id and booking.room_id in out_of_service_ids:
            alerts.append(
                {
                    "type": "maintenance_conflict",
                    "severity": "high",
                    "room_id": booking.room_id,
                    "booking_id": booking.id,
                    "target_type": "booking",
                    "target_id": booking.id,
                    "message": f"Chambre hors service avec reservation active : {booking.reference}.",
                }
            )

    for booking in bookings_qs:
        if booking.check_in_date == today and booking.status == Booking.Status.CONFIRMED:
            alerts.append(
                {
                    "type": "arrival_pending",
                    "severity": "medium",
                    "room_id": booking.room_id,
                    "booking_id": booking.id,
                    "target_type": "booking",
                    "target_id": booking.id,
                    "message": f"Arrivee non traitee : {booking.reference} - {booking.guest.full_name}.",
                }
            )

    for stay in stays_qs:
        if stay.expected_check_out_date == today:
            alerts.append(
                {
                    "type": "departure_pending",
                    "severity": "medium",
                    "room_id": stay.room_id,
                    "stay_id": stay.id,
                    "target_type": "stay",
                    "target_id": stay.id,
                    "message": f"Depart non traite : {stay.reference} - {stay.guest.full_name}.",
                }
            )

    all_rooms_qs = _hotel_scoped(Room.objects.filter(is_active=True), request)
    total_rooms = all_rooms_qs.count()
    free_rooms = all_rooms_qs.filter(status=Room.Status.AVAILABLE).count()
    in_stay_count = _hotel_scoped(Stay.objects.filter(status=Stay.Status.IN_PROGRESS), request).count()
    arrivals_count = _hotel_scoped(
        Booking.objects.filter(
            check_in_date=today,
            status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
        ),
        request,
    ).count()
    departures_count = _hotel_scoped(
        Stay.objects.filter(expected_check_out_date=today, status=Stay.Status.IN_PROGRESS),
        request,
    ).count()
    revenue_today = float(
        _hotel_scoped(Payment.objects.filter(status=Payment.Status.PAID, paid_at__date=today), request).aggregate(
            total=Sum("amount")
        )["total"]
        or 0
    )
    pending_payments_count = _hotel_scoped(Payment.objects.filter(status=Payment.Status.PENDING), request).count()

    return {
        "rooms": [
            {
                "id": room.id,
                "number": room.number,
                "type": room.room_type.name,
                "type_code": room.room_type.code,
                "floor": room.floor,
                "floor_label": f"Etage {room.floor}" if room.floor is not None else "Rez-de-chaussee",
                "status": room.status,
                "status_label": room.get_status_display(),
            }
            for room in rooms
        ],
        "reservations": [
            {
                "id": booking.id,
                "reference": booking.reference,
                "room_id": booking.room_id,
                "room_number": booking.room.number if booking.room else None,
                "room_type": booking.room_type.name,
                "client_name": booking.guest.full_name,
                "client_phone": booking.guest.phone or "",
                "client_id": booking.guest_id,
                "arrival_date": booking.check_in_date.isoformat(),
                "departure_date": booking.check_out_date.isoformat(),
                "status": booking.status,
                "status_label": booking.get_status_display(),
                "source": booking.get_source_display(),
                "total_amount": float(booking.estimated_amount),
                "adults": booking.adults,
                "children": booking.children,
                "notes": booking.notes or "",
                "entity_type": "booking",
            }
            for booking in bookings_qs
            if not booking.room_id or booking.room_id in room_id_set
        ],
        "stays": [
            {
                "id": stay.id,
                "reference": stay.reference,
                "room_id": stay.room_id,
                "room_number": stay.room.number,
                "client_name": stay.guest.full_name,
                "client_phone": getattr(stay.guest, "phone", "") or "",
                "client_id": stay.guest_id,
                "arrival_date": stay.check_in_at.date().isoformat() if stay.check_in_at else None,
                "departure_date": stay.expected_check_out_date.isoformat() if stay.expected_check_out_date else None,
                "status": stay.status,
                "status_label": stay.get_status_display(),
                "adults": stay.adults_count,
                "children": stay.children_count,
                "entity_type": "stay",
            }
            for stay in stays_qs
            if stay.room_id in room_id_set
        ],
        "alerts": alerts,
        "daily_summary": {
            "arrivals": arrivals_count,
            "departures": departures_count,
            "in_stay": in_stay_count,
            "free_rooms": free_rooms,
            "total_rooms": total_rooms,
            "occupancy_rate": round(in_stay_count / total_rooms * 100) if total_rooms > 0 else 0,
            "revenue_today": revenue_today,
            "pending_payments": pending_payments_count,
            "alerts_count": len(alerts),
        },
    }
