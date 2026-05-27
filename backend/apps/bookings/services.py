from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.bookings.models import Booking
from apps.tenancy.models import HotelSettings


def _booking_no_show_deadline(booking):
    try:
        settings = booking.hotel.settings if booking.hotel_id else None
    except Exception:
        settings = None

    if not settings:
        checkin_time = datetime.min.time().replace(hour=14, minute=0)
        grace_minutes = 0
        hotel_timezone = timezone.get_current_timezone()
    else:
        if settings.no_show_policy != HotelSettings.NoShowPolicy.AUTO_AFTER_GRACE:
            return None
        checkin_time = settings.checkin_time
        grace_minutes = settings.grace_period_minutes or 0
        try:
            hotel_timezone = ZoneInfo(settings.timezone)
        except ZoneInfoNotFoundError:
            hotel_timezone = timezone.get_current_timezone()

    naive_deadline = datetime.combine(booking.check_in_date, checkin_time) + timedelta(minutes=grace_minutes)
    return timezone.make_aware(naive_deadline, hotel_timezone)


def mark_overdue_confirmed_bookings_no_show(*, reference_date=None, dry_run=False):
    reference_date = reference_date or timezone.localdate()
    now = timezone.now()
    queryset = (
        Booking.objects.select_related("guest", "room", "hotel", "hotel__settings")
        .filter(
            status=Booking.Status.CONFIRMED,
            check_in_date__lte=reference_date,
            stay__isnull=True,
        )
        .order_by("check_in_date", "id")
    )

    result = {
        "reference_date": reference_date,
        "processed_count": 0,
        "skipped_count": 0,
        "errors": [],
        "references": [],
    }

    for booking in queryset:
        deadline = _booking_no_show_deadline(booking)
        if deadline is None or deadline > now:
            result["skipped_count"] += 1
            continue

        if dry_run:
            result["processed_count"] += 1
            result["references"].append(booking.reference)
            continue

        try:
            booking.mark_no_show(actor=None)
            result["processed_count"] += 1
            result["references"].append(booking.reference)
        except ValidationError as error:
            result["skipped_count"] += 1
            result["errors"].append({"booking_id": booking.id, "reference": booking.reference, "error": str(error)})

    return result
