from apps.platform_admin.models import SubscriptionPlan


class PlanService:
    """Business facade for subscription plans.

    The model still lives in platform_admin during this migration phase, but
    the licensing rules and query helpers belong here.
    """

    @staticmethod
    def queryset():
        return SubscriptionPlan.objects.all()

    @staticmethod
    def active_queryset():
        return PlanService.queryset().filter(is_active=True)

    @staticmethod
    def get_by_id(plan_id):
        if not plan_id:
            return None
        return PlanService.queryset().filter(pk=plan_id).first()

    @staticmethod
    def get_by_code(code):
        value = (code or "").strip()
        if not value:
            return None
        return PlanService.queryset().filter(code__iexact=value).first()

    @staticmethod
    def user_quota(plan):
        return getattr(plan, "max_users", None)

    @staticmethod
    def hotel_quota(plan):
        return getattr(plan, "max_hotels", None)

    @staticmethod
    def is_user_quota_unlimited(plan):
        quota = PlanService.user_quota(plan)
        return quota in (None, 0)

    @staticmethod
    def is_hotel_quota_unlimited(plan):
        quota = PlanService.hotel_quota(plan)
        return quota in (None, 0)


get_plan = PlanService.get_by_id
get_active_plans = PlanService.active_queryset
