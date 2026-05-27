from apps.day_use.services import DayUsePricingService


def validate_day_use_duration(hours):
    return DayUsePricingService.validate_duration(hours)

