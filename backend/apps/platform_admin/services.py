from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone

from apps.audit_logs.services import PlatformAuditService
from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, PlatformLicense, PlatformModule
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User
from apps.users.services import create_hotel_admin_user


def create_platform_audit_event(
    *,
    event_type,
    actor=None,
    target=None,
    target_type="",
    target_id=None,
    target_label="",
    metadata=None,
):
    resolved_target_type = target_type or (target.__class__.__name__ if target is not None else "")
    resolved_target_id = target_id if target_id is not None else getattr(target, "pk", None)
    resolved_target_label = target_label or str(target or resolved_target_type or "")

    return PlatformAuditService.log(
        actor=actor,
        event_type=event_type,
        target=target,
        target_type=resolved_target_type,
        target_id=resolved_target_id,
        target_label=resolved_target_label,
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
        create_platform_audit_event(
            actor=None,
            event_type=(
                PlatformAuditEvent.EventType.HOTEL_REACTIVATED
                if active
                else PlatformAuditEvent.EventType.HOTEL_SUSPENDED
            ),
            target=hotel,
            metadata={
                "subscription_id": subscription.id,
                "source": "subscription_lifecycle",
            },
        )
    return hotel


def list_platform_organizations(*, search="", is_active=None):
    qs = Organization.objects.annotate(
        hotel_count=Count("hotels", distinct=True),
        active_hotel_count=Count("hotels", filter=Q(hotels__is_active=True), distinct=True),
        user_count=Count("users", distinct=True),
        hotel_admin_count=Count(
            "users",
            filter=Q(users__role=User.Role.ADMIN, users__is_platform_admin=False),
            distinct=True,
        ),
        active_subscription_count=Count(
            "hotels__subscription",
            filter=Q(hotels__subscription__status=HotelSubscription.Status.ACTIVE),
            distinct=True,
        ),
    )
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(slug__icontains=search))
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return qs.order_by("name", "-id")


def list_platform_hotels(*, organization_id=None, is_active=None, subscription_status=None, search=""):
    qs = Hotel.objects.select_related("organization", "subscription__plan").annotate(
        active_user_count=Count("users", filter=Q(users__is_active=True), distinct=True),
        hotel_admin_count=Count(
            "users",
            filter=Q(users__role=User.Role.ADMIN, users__is_platform_admin=False, users__is_active=True),
            distinct=True,
        ),
    )
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if subscription_status:
        qs = qs.filter(subscription__status=subscription_status)
    if search:
        qs = qs.filter(
            Q(name__icontains=search) | Q(code__icontains=search) | Q(city__icontains=search)
        )
    return qs.order_by("organization__name", "name", "-id")


def list_platform_subscriptions(*, organization_id=None, hotel_id=None, status=None, plan_id=None, search=""):
    from apps.licensing.services.subscription_service import SubscriptionService

    return SubscriptionService.list(
        organization_id=organization_id,
        hotel_id=hotel_id,
        status=status,
        plan_id=plan_id,
        search=search,
    )


def list_platform_admin_users(include_hotel_admins=True):
    filters = Q(is_platform_admin=True)
    if include_hotel_admins:
        filters |= Q(role=User.Role.ADMIN, is_platform_admin=False)
    return User.objects.select_related("organization", "hotel").filter(filters).order_by(
        "-is_platform_admin",
        "organization__name",
        "hotel__name",
        "username",
    )


def list_platform_audit_events(*, limit=20, event_type="", target_type="", search=""):
    queryset = PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")

    if event_type:
        queryset = queryset.filter(event_type=event_type)
    if target_type:
        queryset = queryset.filter(target_type__iexact=target_type)
    if search:
        queryset = queryset.filter(
            Q(target_label__icontains=search)
            | Q(target_type__icontains=search)
            | Q(actor__username__icontains=search)
            | Q(actor__first_name__icontains=search)
            | Q(actor__last_name__icontains=search)
        )

    return queryset[:limit]


def list_platform_modules(*, search="", is_active=None):
    from apps.licensing.services.module_license_service import ModuleLicenseService

    return ModuleLicenseService.list_modules(search=search, is_active=is_active)


def list_platform_licenses(*, module_id=None, organization_id=None, hotel_id=None, status="", search=""):
    from apps.licensing.services.module_license_service import ModuleLicenseService

    return ModuleLicenseService.list_licenses(
        module_id=module_id,
        organization_id=organization_id,
        hotel_id=hotel_id,
        status=status,
        search=search,
    )


def platform_module_access_allowed(*, module_code, organization_id=None, hotel_id=None, now=None):
    from apps.licensing.services.module_license_service import ModuleLicenseService

    return ModuleLicenseService.access_allowed(
        module_code=module_code,
        organization_id=organization_id,
        hotel_id=hotel_id,
        now=now,
    )


@transaction.atomic
def renew_platform_license(*, license_obj, ends_at, actor=None, note=""):
    from apps.licensing.services.module_license_service import ModuleLicenseService

    return ModuleLicenseService.renew(license_obj=license_obj, ends_at=ends_at, actor=actor, note=note)


@transaction.atomic
def suspend_platform_license(*, license_obj, actor=None, note=""):
    from apps.licensing.services.module_license_service import ModuleLicenseService

    return ModuleLicenseService.suspend(license_obj=license_obj, actor=actor, note=note)


@transaction.atomic
def process_subscription_lifecycle(*, now=None):
    from apps.licensing.services.subscription_service import SubscriptionService

    return SubscriptionService.process_lifecycle(now=now)


@transaction.atomic
def renew_platform_subscription(*, subscription, duration_days, actor=None, note=""):
    from apps.licensing.services.subscription_service import SubscriptionService

    return SubscriptionService.renew(
        subscription=subscription,
        duration_days=duration_days,
        actor=actor,
        note=note,
    )


@transaction.atomic
def change_platform_subscription_plan(*, subscription, new_plan, actor=None, note=""):
    from apps.licensing.services.subscription_service import SubscriptionService

    return SubscriptionService.change_plan(subscription=subscription, new_plan=new_plan, actor=actor, note=note)


@transaction.atomic
def onboard_platform_bundle(
    *,
    organization=None,
    organization_name="",
    organization_slug="",
    hotel_name,
    hotel_code,
    hotel_slug,
    country="",
    city="",
    timezone_name="Atlantic/Reykjavik",
    currency="XOF",
    admin_username,
    admin_password,
    admin_first_name="",
    admin_last_name="",
    admin_email="",
    admin_phone="",
    plan,
    subscription_status=HotelSubscription.Status.TRIAL,
    starts_at=None,
    ends_at=None,
    trial_ends_at=None,
    billing_cycle=HotelSubscription.BillingCycle.MONTHLY,
    subscription_notes="",
    actor=None,
):
    if organization is None:
        organization = Organization.objects.create(
            name=organization_name,
            slug=organization_slug,
            is_active=True,
        )
        create_platform_audit_event(
            actor=actor,
            event_type=PlatformAuditEvent.EventType.ORGANIZATION_CREATED,
            target=organization,
            metadata={"source": "onboarding_bundle"},
        )

    hotel = Hotel.objects.create(
        organization=organization,
        name=hotel_name,
        code=hotel_code,
        slug=hotel_slug,
        country=country,
        city=city,
        timezone=timezone_name,
        currency=currency,
        is_active=True,
    )
    create_platform_audit_event(
        actor=actor,
        event_type=PlatformAuditEvent.EventType.HOTEL_CREATED,
        target=hotel,
        metadata={"source": "onboarding_bundle"},
    )

    admin_user = create_hotel_admin_user(
        username=admin_username,
        password=admin_password,
        organization_id=organization.id,
        hotel_id=hotel.id,
        first_name=admin_first_name,
        last_name=admin_last_name,
        email=admin_email,
        phone=admin_phone,
    )
    create_platform_audit_event(
        actor=actor,
        event_type=PlatformAuditEvent.EventType.USER_LINKED,
        target=admin_user,
        target_label=admin_user.username,
        metadata={"hotel_id": hotel.id, "organization_id": organization.id, "source": "onboarding_bundle"},
    )

    subscription = HotelSubscription.objects.create(
        organization=organization,
        hotel=hotel,
        plan=plan,
        status=subscription_status,
        starts_at=starts_at or timezone.now(),
        ends_at=ends_at,
        trial_ends_at=trial_ends_at,
        billing_cycle=billing_cycle,
        notes=subscription_notes,
    )
    create_platform_audit_event(
        actor=actor,
        event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED,
        target=subscription,
        metadata={"hotel_id": hotel.id, "plan_id": plan.id, "source": "onboarding_bundle"},
    )

    active_statuses = {HotelSubscription.Status.ACTIVE, HotelSubscription.Status.TRIAL}
    _sync_hotel_with_subscription(subscription, active=subscription.status in active_statuses)

    return {
        "organization": organization,
        "hotel": hotel,
        "admin_user": admin_user,
        "subscription": subscription,
    }


def build_platform_dashboard_payload():
    organizations_queryset = Organization.objects.all()
    hotels_queryset = Hotel.objects.select_related("organization", "subscription")
    subscriptions_queryset = HotelSubscription.objects.select_related("organization", "hotel", "plan")
    users_queryset = User.objects.select_related("organization", "hotel")

    total_organizations = organizations_queryset.count()
    total_hotels = hotels_queryset.count()
    active_hotels = hotels_queryset.filter(is_active=True).count()
    inactive_hotels = total_hotels - active_hotels
    active_subscriptions = subscriptions_queryset.filter(status=HotelSubscription.Status.ACTIVE).count()
    trial_subscriptions = subscriptions_queryset.filter(status=HotelSubscription.Status.TRIAL).count()
    suspended_subscriptions = subscriptions_queryset.filter(status=HotelSubscription.Status.SUSPENDED).count()
    expired_subscriptions = subscriptions_queryset.filter(status=HotelSubscription.Status.EXPIRED).count()
    platform_admin_count = users_queryset.filter(is_platform_admin=True, is_active=True).count()
    hotel_admin_count = users_queryset.filter(role=User.Role.ADMIN, is_platform_admin=False, is_active=True).count()
    hotels_nearing_quota = list_platform_hotels().filter(
        subscription__plan__max_users__gt=0,
        active_user_count__gte=F("subscription__plan__max_users") * 0.8,
    ).count()
    hotels_over_quota = list_platform_hotels().filter(
        subscription__plan__max_users__gt=0,
        active_user_count__gt=F("subscription__plan__max_users"),
    ).count()
    expiring_trials = (
        list_platform_subscriptions()
        .filter(
            status=HotelSubscription.Status.TRIAL,
            trial_ends_at__isnull=False,
            trial_ends_at__lte=timezone.now() + timedelta(days=7),
        )[:5]
    )
    expiring_subscriptions = (
        list_platform_subscriptions()
        .filter(
            status=HotelSubscription.Status.ACTIVE,
            ends_at__isnull=False,
            ends_at__lte=timezone.now() + timedelta(days=14),
        )[:5]
    )

    return {
        "title": "Console plateforme AFRIVO",
        "subtitle": "Supervision globale des organisations, hotels, abonnements et administrateurs.",
        "summary_cards": [
            {
                "label": "Organisations",
                "value": total_organizations,
                "meta": "Clients SaaS rattaches a la plateforme",
            },
            {
                "label": "Hotels actifs",
                "value": active_hotels,
                "meta": "En activite",
            },
            {
                "label": "Hotels inactifs",
                "value": inactive_hotels,
                "meta": "Suspendus ou fermes",
            },
            {
                "label": "Abonnements actifs",
                "value": active_subscriptions,
                "meta": (
                    f"{trial_subscriptions} essai(s), "
                    f"{suspended_subscriptions} suspendu(s), "
                    f"{expired_subscriptions} expire(s)"
                ),
            },
            {
                "label": "Admins plateforme",
                "value": platform_admin_count,
                "meta": f"{hotel_admin_count} admin(s) hotel acti(fs)",
            },
        ],
        "subscription_status": [
            {"status": HotelSubscription.Status.ACTIVE, "label": HotelSubscription.Status.ACTIVE.label, "count": active_subscriptions},
            {"status": HotelSubscription.Status.TRIAL, "label": HotelSubscription.Status.TRIAL.label, "count": trial_subscriptions},
            {
                "status": HotelSubscription.Status.SUSPENDED,
                "label": HotelSubscription.Status.SUSPENDED.label,
                "count": suspended_subscriptions,
            },
            {
                "status": HotelSubscription.Status.EXPIRED,
                "label": HotelSubscription.Status.EXPIRED.label,
                "count": expired_subscriptions,
            },
        ],
        "quota_highlights": [
            {
                "label": "Hotels proches du quota",
                "value": hotels_nearing_quota,
                "meta": "Hotels a plus de 80% de leur quota utilisateurs.",
            },
            {
                "label": "Hotels hors quota",
                "value": hotels_over_quota,
                "meta": "Hotels dont les utilisateurs actifs depassent le plan courant.",
            },
        ],
        "expiring_trials": [
            {
                "id": item.id,
                "hotel_name": item.hotel.name,
                "organization_name": item.organization.name,
                "trial_ends_at": item.trial_ends_at.isoformat() if item.trial_ends_at else "",
            }
            for item in expiring_trials
        ],
        "expiring_subscriptions": [
            {
                "id": item.id,
                "hotel_name": item.hotel.name,
                "organization_name": item.organization.name,
                "ends_at": item.ends_at.isoformat() if item.ends_at else "",
            }
            for item in expiring_subscriptions
        ],
    }
