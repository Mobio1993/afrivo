"""Day Use domain facade.

The persisted DayUse table already lives in apps.bookings to preserve the
existing booking, billing and operations relationships. This module exposes the
professional Day Use boundary without duplicating data.
"""

from apps.bookings.models import DayUse as DayUseReservation
from apps.billing.models import Payment as DayUsePayment


__all__ = ["DayUseReservation", "DayUsePayment"]
