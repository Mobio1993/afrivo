from django.utils import timezone

from apps.bookings.models import DayUse
from apps.day_use.services import DayUseHistoryService
from apps.history.models import HistoryEntry


def detect_overtime_day_uses():
    now = timezone.now()
    queryset = DayUse.objects.filter(status=DayUse.Status.IN_PROGRESS, end_datetime__lt=now)
    updated = 0
    for day_use in queryset.select_related("hotel"):
        day_use.status = DayUse.Status.OVERTIME
        day_use.save(update_fields=["status", "updated_at"])
        DayUseHistoryService.write(
            day_use,
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            description=f"Day use {day_use.reference} passe automatiquement en depassement.",
            metadata={"detected_at": now.isoformat()},
        )
        updated += 1
    return updated

