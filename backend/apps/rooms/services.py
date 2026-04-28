from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.bookings.models import Booking, DayUse
from apps.guests.models import Guest
from apps.stays.models import Stay


def _has_assigned_booking(room, *, at_date=None):
    at_date = at_date or timezone.localdate()
    return Booking.objects.filter(
        room=room,
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        check_in_date__gte=at_date,
    ).exists()


def _has_open_housekeeping(room):
    return room.housekeeping_tasks.filter(
        status__in=[
            room.housekeeping_tasks.model.Status.PENDING,
            room.housekeeping_tasks.model.Status.IN_PROGRESS,
        ]
    ).exists()


def _has_blocking_incident(room):
    return room.maintenance_incidents.filter(
        status__in=[
            room.maintenance_incidents.model.Status.OPEN,
            room.maintenance_incidents.model.Status.IN_PROGRESS,
        ],
        marks_room_out_of_service=True,
    ).exists()


def resolve_room_operational_status(room):
    has_active_stay = room.stays.filter(status=Stay.Status.IN_PROGRESS).exists()
    has_active_day_use = room.day_uses.filter(status=DayUse.Status.IN_PROGRESS).exists()

    if has_active_stay or has_active_day_use:
        return room.Status.OCCUPIED

    if _has_blocking_incident(room):
        return room.Status.OUT_OF_SERVICE

    if _has_open_housekeeping(room):
        return room.Status.CLEANING

    if _has_assigned_booking(room):
        return room.Status.RESERVED

    return room.Status.AVAILABLE


def sync_room_operational_status(room):
    target_status = resolve_room_operational_status(room)
    if room.status != target_status:
        type(room).objects.filter(pk=room.pk).update(status=target_status, updated_at=timezone.now())
        room.status = target_status
    return room


def get_room_type_effective_rates(room_type, *, occupancy_rate=0, target_date=None):
    target_date = target_date or timezone.localdate()
    night_price = room_type.base_price_per_night
    day_use_price = room_type.base_price_day_use

    rules = room_type.rate_rules.filter(is_active=True).order_by("priority", "id")
    for rule in rules:
        if rule.start_date and target_date < rule.start_date:
            continue
        if rule.end_date and target_date > rule.end_date:
            continue
        if rule.rule_type == rule.RuleType.WEEKEND and target_date.weekday() < 4:
            continue
        if rule.rule_type == rule.RuleType.OCCUPANCY and (rule.min_occupancy_rate or 0) > occupancy_rate:
            continue

        targets = []
        if rule.applies_to in {rule.AppliesTo.NIGHT, rule.AppliesTo.BOTH}:
            targets.append("night")
        if rule.applies_to in {rule.AppliesTo.DAY_USE, rule.AppliesTo.BOTH}:
            targets.append("day_use")

        for target in targets:
            current_value = night_price if target == "night" else day_use_price
            if rule.adjustment_mode == rule.AdjustmentMode.PERCENT:
                current_value = current_value + (current_value * Decimal(rule.adjustment_value) / Decimal("100"))
            else:
                current_value = current_value + Decimal(rule.adjustment_value)
            if target == "night":
                night_price = max(current_value, Decimal("0"))
            else:
                day_use_price = max(current_value, Decimal("0"))

    return {
        "night": night_price,
        "day_use": day_use_price,
    }


def suggest_rooms(*, hotel, room_type=None, guest=None, check_in_date=None, check_out_date=None, limit=5):
    queryset = hotel.rooms.select_related("room_type").filter(is_active=True)
    if room_type is not None:
        queryset = queryset.filter(room_type=room_type)

    blocked_ids = set(
        Stay.objects.filter(status=Stay.Status.IN_PROGRESS, hotel=hotel).values_list("room_id", flat=True)
    )
    blocked_ids.update(
        DayUse.objects.filter(status=DayUse.Status.IN_PROGRESS, hotel=hotel).values_list("room_id", flat=True)
    )
    blocked_ids.update(
        hotel.room_maintenance_incidents.filter(
            status__in=[
                hotel.room_maintenance_incidents.model.Status.OPEN,
                hotel.room_maintenance_incidents.model.Status.IN_PROGRESS,
            ],
            marks_room_out_of_service=True,
        ).values_list("room_id", flat=True)
    )

    if check_in_date and check_out_date:
        overlapping_bookings = Booking.objects.filter(
            hotel=hotel,
            room_id__isnull=False,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            check_in_date__lt=check_out_date,
            check_out_date__gt=check_in_date,
        )
        blocked_ids.update(overlapping_bookings.values_list("room_id", flat=True))

    guest_is_vip = guest is not None and guest.client_type == Guest.ClientType.VIP

    suggestions = []
    for room in queryset.exclude(id__in=blocked_ids):
        sync_room_operational_status(room)
        if room.status not in {room.Status.AVAILABLE, room.Status.RESERVED}:
            continue

        score = 100
        if room.status == room.Status.RESERVED:
            score -= 30
        if guest_is_vip and room.is_vip_preferred:
            score += 25
        if room.floor:
            score += max(0, 5 - room.floor)
        if room.custom_price_per_night:
            score += 4

        suggestions.append(
            {
                "id": room.id,
                "number": room.number,
                "room_code": room.room_code,
                "status": room.status,
                "status_label": room.get_status_display(),
                "room_type": room.room_type.name,
                "floor": room.floor,
                "score": score,
                "is_vip_preferred": room.is_vip_preferred,
                "effective_price_per_night": str(room.effective_price_per_night),
                "effective_price_day_use": str(room.effective_price_day_use),
            }
        )

    return sorted(suggestions, key=lambda item: (-item["score"], item["number"]))[:limit]


def build_rooms_dashboard(hotel):
    active_rooms = hotel.rooms.select_related("room_type").filter(is_active=True).order_by("floor", "number")
    room_ids = list(active_rooms.values_list("id", flat=True))

    current_stays = {
        item["room_id"]: item
        for item in Stay.objects.filter(hotel=hotel, status=Stay.Status.IN_PROGRESS)
        .select_related("guest", "room__room_type")
        .values("room_id", "reference", "guest__first_name", "guest__last_name")
    }
    current_day_uses = {
        item["room_id"]: item
        for item in DayUse.objects.filter(hotel=hotel, status=DayUse.Status.IN_PROGRESS)
        .select_related("guest")
        .values("room_id", "reference", "guest__first_name", "guest__last_name")
    }

    occupancy_rate = 0
    room_count = len(room_ids)
    occupied_count = active_rooms.filter(status=active_rooms.model.Status.OCCUPIED).count()
    if room_count:
        occupancy_rate = round((occupied_count / room_count) * 100, 1)

    revenues = (
        hotel.rooms.filter(id__in=room_ids)
        .annotate(
            stays_revenue=Sum("stays__payments__amount", filter=Q(stays__payments__status="paid")),
            day_use_revenue=Sum("day_uses__payments__amount", filter=Q(day_uses__payments__status="paid")),
        )
        .values("id", "stays_revenue", "day_use_revenue")
    )
    revenue_map = {
        item["id"]: (item["stays_revenue"] or Decimal("0")) + (item["day_use_revenue"] or Decimal("0")) for item in revenues
    }

    incident_counts = {
        item["room_id"]: item["count"]
        for item in hotel.room_maintenance_incidents.filter(
            status__in=["open", "in_progress"]
        ).values("room_id").annotate(count=Count("id"))
    }
    housekeeping_counts = {
        item["room_id"]: item["count"]
        for item in hotel.housekeeping_tasks.filter(
            status__in=["pending", "in_progress"]
        ).values("room_id").annotate(count=Count("id"))
    }

    room_grid = []
    for room in active_rooms:
        sync_room_operational_status(room)
        stay_payload = current_stays.get(room.id)
        day_use_payload = current_day_uses.get(room.id)
        occupant = "-"
        current_reference = ""
        if stay_payload:
            occupant = f"{stay_payload['guest__first_name']} {stay_payload['guest__last_name']}".strip()
            current_reference = stay_payload["reference"]
        elif day_use_payload:
            occupant = f"{day_use_payload['guest__first_name']} {day_use_payload['guest__last_name']}".strip()
            current_reference = day_use_payload["reference"]

        room_grid.append(
            {
                "id": room.id,
                "number": room.number,
                "room_code": room.room_code,
                "room_type": room.room_type.name,
                "room_type_id": room.room_type_id,
                "floor": room.floor or "-",
                "status": room.status,
                "status_label": room.get_status_display(),
                "occupant": occupant or "-",
                "current_reference": current_reference or "-",
                "housekeeping_open": housekeeping_counts.get(room.id, 0),
                "incidents_open": incident_counts.get(room.id, 0),
                "revenue_total": f"{revenue_map.get(room.id, Decimal('0')):.2f}",
                "effective_price_per_night": f"{room.effective_price_per_night:.2f}",
                "effective_price_day_use": f"{room.effective_price_day_use:.2f}",
                "is_vip_preferred": room.is_vip_preferred,
            }
        )

    summary = {
        "room_count": room_count,
        "available_count": active_rooms.filter(status=active_rooms.model.Status.AVAILABLE).count(),
        "occupied_count": occupied_count,
        "reserved_count": active_rooms.filter(status=active_rooms.model.Status.RESERVED).count(),
        "cleaning_count": active_rooms.filter(status=active_rooms.model.Status.CLEANING).count(),
        "out_of_service_count": active_rooms.filter(status=active_rooms.model.Status.OUT_OF_SERVICE).count(),
        "occupancy_rate": occupancy_rate,
        "open_incident_count": hotel.room_maintenance_incidents.filter(status__in=["open", "in_progress"]).count(),
        "open_housekeeping_count": hotel.housekeeping_tasks.filter(status__in=["pending", "in_progress"]).count(),
    }

    return {
        "summary": summary,
        "room_grid": room_grid,
        "housekeeping_queue": [
            {
                "id": task.id,
                "room": task.room.number,
                "task_type": task.get_task_type_display(),
                "status": task.status,
                "status_label": task.get_status_display(),
                "priority": task.priority,
                "priority_label": task.get_priority_display(),
                "assigned_to": task.assigned_to.get_full_name().strip() or task.assigned_to.username if task.assigned_to else "-",
                "estimated_minutes": task.estimated_minutes,
                "requested_at": task.requested_at.isoformat(),
            }
            for task in hotel.housekeeping_tasks.select_related("room", "assigned_to").filter(
                status__in=["pending", "in_progress"]
            )[:20]
        ],
        "maintenance_alerts": [
            {
                "id": incident.id,
                "room": incident.room.number,
                "title": incident.title,
                "severity": incident.severity,
                "severity_label": incident.get_severity_display(),
                "status": incident.status,
                "status_label": incident.get_status_display(),
                "reported_at": incident.reported_at.isoformat(),
                "marks_room_out_of_service": incident.marks_room_out_of_service,
            }
            for incident in hotel.room_maintenance_incidents.select_related("room").filter(
                status__in=["open", "in_progress"]
            )[:20]
        ],
    }


def build_rooms_realtime_states(hotel):
    rooms = list(
        hotel.rooms.select_related("room_type")
        .filter(is_active=True)
        .order_by("floor", "number")
    )

    active_stay_room_ids = set(
        Stay.objects.filter(hotel=hotel, status=Stay.Status.IN_PROGRESS).values_list("room_id", flat=True)
    )
    active_day_use_room_ids = set(
        DayUse.objects.filter(hotel=hotel, status=DayUse.Status.IN_PROGRESS).values_list("room_id", flat=True)
    )
    active_housekeeping_room_ids = set(
        hotel.housekeeping_tasks.filter(status__in=["pending", "in_progress"]).values_list("room_id", flat=True)
    )
    active_incident_room_ids = set(
        hotel.room_maintenance_incidents.filter(status__in=["open", "in_progress"]).values_list("room_id", flat=True)
    )

    results = []
    now = timezone.now()

    for room in rooms:
        sync_room_operational_status(room)

        number_value = int(room.number) if str(room.number).isdigit() else sum(ord(char) for char in str(room.number))
        hotel_status = room.status
        if hotel_status == room.Status.OUT_OF_SERVICE:
            hotel_status = "maintenance"

        has_presence = room.id in active_stay_room_ids or room.id in active_day_use_room_ids or room.id in active_housekeeping_room_ids
        presence_status = "detected" if has_presence else "none"

        if room.id in active_housekeeping_room_ids:
            door_status = "open"
        elif room.id in active_incident_room_ids and hotel_status == "maintenance":
            door_status = "closed"
        elif number_value % 5 == 0:
            door_status = "open_long"
        elif number_value % 3 == 0:
            door_status = "open"
        else:
            door_status = "closed"

        ac_status = "on" if hotel_status in {room.Status.OCCUPIED, "reserved"} or number_value % 2 == 0 else "off"
        light_status = "on" if presence_status == "detected" and door_status != "closed" else "off"
        temperature = 22 + (number_value % 7)
        humidity = 58 + (number_value % 15)

        if door_status == "open_long" or (hotel_status == "available" and presence_status == "detected"):
            alert_level = "critical"
        elif door_status == "open" or hotel_status in {"cleaning", "maintenance"}:
            alert_level = "warning"
        else:
            alert_level = "none"

        if hotel_status == "available" and presence_status == "detected":
            alert_message = "Presence detectee dans une chambre disponible"
        elif door_status == "open_long":
            alert_message = "Porte ouverte depuis trop longtemps"
        elif door_status == "open":
            alert_message = "Porte ouverte depuis quelques minutes"
        elif hotel_status == "cleaning":
            alert_message = "Nettoyage en cours"
        elif hotel_status == "maintenance":
            alert_message = "Incident technique signale"
        else:
            alert_message = "Aucune alerte"

        sensor_status = "offline" if number_value % 11 == 0 else "online"

        last_reference = room.last_cleaned_at or room.last_inspected_at or room.updated_at
        delta_minutes = max(int((now - last_reference).total_seconds() // 60), 0)
        if delta_minutes < 1:
            last_activity = "il y a moins d'une minute"
        elif delta_minutes == 1:
            last_activity = "il y a 1 minute"
        elif delta_minutes < 60:
            last_activity = f"il y a {delta_minutes} minutes"
        else:
            hours = max(delta_minutes // 60, 1)
            last_activity = f"il y a {hours} heure{'s' if hours > 1 else ''}"

        floor_label = f"{room.floor}e etage" if room.floor else "Etage non renseigne"

        results.append(
            {
                "id": room.id,
                "roomNumber": room.number,
                "roomType": room.room_type.name,
                "floor": floor_label,
                "hotelStatus": hotel_status,
                "presenceStatus": presence_status,
                "doorStatus": door_status,
                "acStatus": ac_status,
                "lightStatus": light_status,
                "temperature": temperature,
                "humidity": humidity,
                "lastActivity": last_activity,
                "alertLevel": alert_level,
                "alertMessage": alert_message,
                "sensorStatus": sensor_status,
            }
        )

    return {"results": results, "source": "simulated_backend"}
