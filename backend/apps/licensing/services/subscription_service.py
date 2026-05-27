from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.audit_logs.services import PlatformAuditService
from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent
from apps.tenancy.models import Hotel


def _create_audit_event(*, event_type, actor=None, target=None, metadata=None):
    return PlatformAuditService.log(
        actor=actor,
        event_type=event_type,
        target=target,
        metadata=metadata or {},
    )


def _plan_reference_price(plan, billing_cycle):
    def to_decimal(value):
        if value in (None, ""):
            return Decimal("0.00")
        return Decimal(str(value))

    if billing_cycle == HotelSubscription.BillingCycle.YEARLY:
        return to_decimal(plan.yearly_price)
    return to_decimal(plan.monthly_price)


def _sync_hotel_with_subscription(subscription, *, active):
    hotel = subscription.hotel
    if hotel.is_active != active:
        hotel.is_active = active
        hotel.save(update_fields=["is_active", "updated_at"])
        _create_audit_event(
            actor=None,
            event_type=(
                PlatformAuditEvent.EventType.HOTEL_REACTIVATED
                if active
                else PlatformAuditEvent.EventType.HOTEL_SUSPENDED
            ),
            target=hotel,
            metadata={
                "subscription_id": subscription.id,
                "source": "licensing_subscription_lifecycle",
            },
        )
    return hotel


class SubscriptionService:
    """Business facade for hotel subscriptions."""

    active_statuses = {HotelSubscription.Status.ACTIVE, HotelSubscription.Status.TRIAL}

    @staticmethod
    def queryset():
        return HotelSubscription.objects.select_related("organization", "hotel", "plan")

    @staticmethod
    def list(*, organization_id=None, hotel_id=None, status=None, plan_id=None, search=""):
        queryset = SubscriptionService.queryset().annotate(
            active_user_count=Count("hotel__users", filter=Q(hotel__users__is_active=True), distinct=True),
        )
        if organization_id:
            queryset = queryset.filter(organization_id=organization_id)
        if hotel_id:
            queryset = queryset.filter(hotel_id=hotel_id)
        if status:
            queryset = queryset.filter(status=status)
        if plan_id:
            queryset = queryset.filter(plan_id=plan_id)
        if search:
            queryset = queryset.filter(
                Q(hotel__name__icontains=search)
                | Q(organization__name__icontains=search)
                | Q(plan__name__icontains=search)
            )
        return queryset.order_by("-updated_at", "-id")

    @staticmethod
    def get_by_id(subscription_id):
        if not subscription_id:
            return None
        return SubscriptionService.queryset().filter(pk=subscription_id).first()

    @staticmethod
    def get_for_hotel(hotel):
        if hotel is None:
            return None
        return getattr(hotel, "subscription", None)

    @staticmethod
    def is_active(subscription):
        return bool(subscription and subscription.status in SubscriptionService.active_statuses)

    @staticmethod
    def hotel_subscription_is_active(hotel):
        subscription = SubscriptionService.get_for_hotel(hotel)
        return SubscriptionService.is_active(subscription)

    @staticmethod
    def user_quota_for_hotel(hotel):
        subscription = SubscriptionService.get_for_hotel(hotel)
        plan = getattr(subscription, "plan", None)
        return getattr(plan, "max_users", None)

    @staticmethod
    def active_user_count(hotel):
        if hotel is None:
            return 0
        return hotel.users.filter(is_active=True).count()

    @staticmethod
    def user_quota_usage(hotel):
        quota = SubscriptionService.user_quota_for_hotel(hotel)
        used = SubscriptionService.active_user_count(hotel)
        if quota in (None, 0):
            return {"used": used, "quota": quota, "pct": 0, "status": "sans_limite"}
        pct = min(100, round((used / quota) * 100))
        status = "critique" if pct >= 90 else "attention" if pct >= 60 else "sain"
        return {"used": used, "quota": quota, "pct": pct, "status": status}

    @staticmethod
    def subscription_is_expired(subscription, *, now=None):
        if subscription is None:
            return True
        reference_time = now or timezone.now()
        if subscription.ends_at and subscription.ends_at <= reference_time:
            return True
        if subscription.status == HotelSubscription.Status.TRIAL and subscription.trial_ends_at:
            return subscription.trial_ends_at <= reference_time
        return subscription.status in {HotelSubscription.Status.EXPIRED, HotelSubscription.Status.SUSPENDED}

    @staticmethod
    @transaction.atomic
    def process_lifecycle(*, now=None):
        reference_time = now or timezone.now()
        suspended_ids = []
        expired_ids = []

        active_due = (
            SubscriptionService.queryset()
            .filter(status=HotelSubscription.Status.ACTIVE, ends_at__isnull=False, ends_at__lte=reference_time)
        )
        for subscription in active_due:
            subscription.status = HotelSubscription.Status.SUSPENDED
            subscription.save(update_fields=["status", "updated_at"])
            _sync_hotel_with_subscription(subscription, active=False)
            _create_audit_event(
                actor=None,
                event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
                target=subscription,
                metadata={
                    "action": "lifecycle_auto_suspended",
                    "hotel_id": subscription.hotel_id,
                    "effective_at": reference_time.isoformat(),
                },
            )
            suspended_ids.append(subscription.id)

        trial_due = (
            SubscriptionService.queryset()
            .filter(status=HotelSubscription.Status.TRIAL, trial_ends_at__isnull=False, trial_ends_at__lte=reference_time)
        )
        for subscription in trial_due:
            subscription.status = HotelSubscription.Status.EXPIRED
            subscription.save(update_fields=["status", "updated_at"])
            _sync_hotel_with_subscription(subscription, active=False)
            _create_audit_event(
                actor=None,
                event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
                target=subscription,
                metadata={
                    "action": "trial_expired",
                    "hotel_id": subscription.hotel_id,
                    "effective_at": reference_time.isoformat(),
                },
            )
            expired_ids.append(subscription.id)

        return {
            "processed_at": reference_time.isoformat(),
            "suspended_count": len(suspended_ids),
            "expired_count": len(expired_ids),
            "suspended_ids": suspended_ids,
            "expired_ids": expired_ids,
        }

    @staticmethod
    @transaction.atomic
    def renew(*, subscription, duration_days, actor=None, note=""):
        reference_time = timezone.now()
        base_time = subscription.ends_at if subscription.ends_at and subscription.ends_at > reference_time else reference_time
        subscription.starts_at = subscription.starts_at or reference_time
        subscription.ends_at = base_time + timedelta(days=duration_days)
        subscription.status = HotelSubscription.Status.ACTIVE
        subscription.trial_ends_at = None
        if note:
            subscription.notes = f"{subscription.notes}\n{note}".strip()
        subscription.save(update_fields=["starts_at", "ends_at", "status", "trial_ends_at", "notes", "updated_at"])
        _sync_hotel_with_subscription(subscription, active=True)
        _create_audit_event(
            actor=actor,
            event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
            target=subscription,
            metadata={
                "action": "renew",
                "duration_days": duration_days,
                "new_ends_at": subscription.ends_at.isoformat() if subscription.ends_at else "",
            },
        )
        return subscription

    @staticmethod
    @transaction.atomic
    def change_plan(*, subscription, new_plan, actor=None, note=""):
        current_price = _plan_reference_price(subscription.plan, subscription.billing_cycle)
        next_price = _plan_reference_price(new_plan, subscription.billing_cycle)
        if next_price > current_price:
            change_kind = "upgrade"
        elif next_price < current_price:
            change_kind = "downgrade"
        else:
            change_kind = "lateral"

        subscription.plan = new_plan
        if note:
            subscription.notes = f"{subscription.notes}\n{note}".strip()
        subscription.save(update_fields=["plan", "notes", "updated_at"])
        _create_audit_event(
            actor=actor,
            event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED,
            target=subscription,
            metadata={
                "action": "change_plan",
                "change_kind": change_kind,
                "previous_plan_price": str(current_price),
                "new_plan_price": str(next_price),
                "new_plan_id": new_plan.id,
            },
        )
        return subscription, change_kind


get_subscription = SubscriptionService.get_by_id
get_hotel_subscription = SubscriptionService.get_for_hotel
hotel_subscription_is_active = SubscriptionService.hotel_subscription_is_active
process_subscription_lifecycle = SubscriptionService.process_lifecycle
renew_platform_subscription = SubscriptionService.renew
change_platform_subscription_plan = SubscriptionService.change_plan
