from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils.text import slugify
from django.utils import timezone

from apps.licensing.services.module_license_service import ModuleLicenseService
from apps.licensing.services.subscription_service import SubscriptionService
from apps.audit_logs.models import ActivityLog
from apps.audit_logs.services import AuditLogService
from apps.super_root.services.audit_service import SuperRootAuditService
from apps.super_root.services.maintenance_service import SuperRootMaintenanceService
from apps.super_root.services.monitoring_service import SuperRootMonitoringService
from apps.super_root.models import SuperRootPlatform
from apps.platform_admin.models import HotelSubscription, PlatformLicense, PlatformModule
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User


class SuperRootPlatformService:
    """Platform supervision beyond classic platform-admin screens."""

    PLATFORM_ID = "afrivo-default"
    PLATFORM_NAME = "AFRIVO Default"
    STATE_CACHE_KEY = "super_root:platform:afrivo-default:state"
    VALID_STATES = {"active", "suspended", "maintenance"}

    @staticmethod
    def _default_state():
        return {
            "status": "active",
            "reason": "",
            "updated_at": None,
            "updated_by": "",
        }

    @staticmethod
    def state():
        return {**SuperRootPlatformService._default_state(), **(cache.get(SuperRootPlatformService.STATE_CACHE_KEY) or {})}

    @staticmethod
    def _is_default_platform(platform_id):
        return not platform_id or platform_id == SuperRootPlatformService.PLATFORM_ID

    @staticmethod
    def platform_exists(platform_id):
        if SuperRootPlatformService._is_default_platform(platform_id):
            return True
        return SuperRootPlatform.objects.filter(slug=platform_id).exists()

    @staticmethod
    def create_platform(data, *, actor=None, request=None):
        name = (data.get("name") or "").strip()
        raw_slug = (data.get("slug") or name).strip()
        slug = slugify(raw_slug)[:180]
        if not slug:
            raise ValueError("Slug plateforme invalide.")
        if SuperRootPlatform.objects.filter(slug=slug).exists():
            raise ValueError("Une plateforme utilise deja ce slug.")
        code = (data.get("code") or "".join(part[:1] for part in name.split()) or name[:2]).strip().upper()[:12]
        platform = SuperRootPlatform.objects.create(
            name=name,
            slug=slug,
            code=code or "PF",
            domain_url=(data.get("domain_url") or "").strip(),
            environment=(data.get("environment") or "production").strip().lower(),
            region=(data.get("region") or "").strip(),
            owner_email=(data.get("owner_email") or "").strip(),
            notes=(data.get("notes") or "").strip(),
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
            updated_by=actor if getattr(actor, "is_authenticated", False) else None,
        )
        SuperRootAuditService.critical(
            actor=actor,
            request=request,
            action="platform.create",
            severity="warning",
            metadata={
                "platform_id": platform.slug,
                "name": platform.name,
                "environment": platform.environment,
                "domain_url": platform.domain_url,
            },
        )
        return SuperRootPlatformService.registered_platform_tile(platform)

    @staticmethod
    def registered_platform_tile(platform):
        if platform.slug == SuperRootPlatformService.PLATFORM_ID:
            org_filter = Q(platform=platform) | Q(platform__isnull=True)
            hotel_filter = Q(platform=platform) | Q(organization__platform=platform) | Q(platform__isnull=True, organization__platform__isnull=True)
            user_filter = (
                Q(organization__platform=platform)
                | Q(organization__platform__isnull=True)
                | Q(hotel__platform=platform)
                | Q(hotel__organization__platform=platform)
                | Q(hotel__platform__isnull=True, hotel__organization__platform__isnull=True)
            )
            license_filter = (
                Q(organization__platform=platform)
                | Q(organization__platform__isnull=True)
                | Q(hotel__platform=platform)
                | Q(hotel__organization__platform=platform)
                | Q(hotel__platform__isnull=True, hotel__organization__platform__isnull=True)
            )
        else:
            org_filter = Q(platform=platform)
            hotel_filter = Q(platform=platform) | Q(organization__platform=platform)
            user_filter = Q(organization__platform=platform) | Q(hotel__platform=platform) | Q(hotel__organization__platform=platform)
            license_filter = Q(organization__platform=platform) | Q(hotel__platform=platform) | Q(hotel__organization__platform=platform)
        orgs = Organization.objects.filter(org_filter).distinct()
        hotels = Hotel.objects.filter(hotel_filter).distinct()
        users = User.objects.filter(user_filter).distinct()
        licenses = PlatformLicense.objects.filter(license_filter).distinct()
        subscriptions = HotelSubscription.objects.filter(hotel__in=hotels).distinct()
        return {
            "id": platform.slug,
            "name": platform.name,
            "code": platform.code,
            "status": platform.status,
            "manual_status": platform.status,
            "reason": platform.notes,
            "domain_url": platform.domain_url,
            "environment": platform.environment,
            "region": platform.region,
            "owner_email": platform.owner_email,
            "updated_at": platform.updated_at.isoformat() if platform.updated_at else "",
            "updated_by": platform.updated_by.username if platform.updated_by_id else "",
            "business": {
                "organizations": orgs.distinct().count(),
                "organizations_active": orgs.filter(is_active=True, status=Organization.Status.ACTIVE).distinct().count(),
                "organizations_suspended": orgs.filter(status=Organization.Status.SUSPENDED).distinct().count(),
                "hotels": hotels.count(),
                "hotels_active": hotels.filter(is_active=True).count(),
                "users": users.filter(is_active=True).count(),
                "licenses": licenses.count(),
                "licenses_active": licenses.filter(status=PlatformLicense.Status.ACTIVE).count(),
                "subscriptions": subscriptions.count(),
                "subscriptions_active": subscriptions.filter(status=HotelSubscription.Status.ACTIVE).count(),
                "revenue_monthly": "0.00",
            },
            "technical": {
                "uptime_pct": 100 if platform.status == SuperRootPlatform.Status.ACTIVE else 0,
                "api": {"status": "ok" if platform.status == SuperRootPlatform.Status.ACTIVE else "warning", "latency_ms": None},
                "database": {"status": "ok", "latency_ms": None},
                "cache": {"status": "ok", "latency_ms": None},
                "queue": {"status": "ok", "pending": 0},
                "websocket": {"status": "warning"},
                "system": {},
                "issues": [] if platform.status == SuperRootPlatform.Status.ACTIVE else [platform.status],
            },
            "risks": {
                "organizations_suspended": orgs.filter(status=Organization.Status.SUSPENDED).distinct().count(),
                "hotels_without_subscription": hotels.filter(subscription__isnull=True).count(),
                "quota_attention": 0,
                "quota_critical": 0,
                "admins_missing": 0,
                "licenses_expired": 0,
                "incidents": 0,
            },
        }

    @staticmethod
    def set_state(status, *, actor=None, request=None, reason="", platform_id=None):
        if status not in SuperRootPlatformService.VALID_STATES:
            raise ValueError("Statut plateforme invalide.")
        if not SuperRootPlatformService._is_default_platform(platform_id):
            platform = SuperRootPlatform.objects.filter(slug=platform_id).first()
            if platform is None:
                raise ValueError("Plateforme introuvable.")
            platform.status = status
            platform.notes = reason or platform.notes
            platform.updated_by = actor if getattr(actor, "is_authenticated", False) else None
            platform.save(update_fields=["status", "notes", "updated_by", "updated_at"])
            SuperRootAuditService.critical(
                actor=actor,
                request=request,
                action=f"platform.{status}",
                severity="critical" if status == "suspended" else "warning",
                metadata={"platform_id": platform.slug, "status": status, "reason": reason or ""},
            )
            return SuperRootPlatformService.registered_platform_tile(platform)
        state = {
            "status": status,
            "reason": reason or "",
            "updated_at": timezone.now().isoformat(),
            "updated_by": getattr(actor, "username", "") or "",
        }
        cache.set(SuperRootPlatformService.STATE_CACHE_KEY, state, timeout=None)
        SuperRootAuditService.critical(
            actor=actor,
            request=request,
            action=f"platform.{status}",
            severity="critical" if status == "suspended" else "warning",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, **state},
        )
        return SuperRootPlatformService.platform_tile()

    @staticmethod
    def healthcheck(*, actor=None, request=None):
        monitoring = SuperRootMonitoringService.snapshot()
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.healthcheck",
            severity="warning" if monitoring.get("issues") else "info",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, "issues": monitoring.get("issues", [])},
        )
        return {
            "checked_at": monitoring["checked_at"],
            "status": monitoring["status"],
            "issues": monitoring["issues"],
            "technical": SuperRootPlatformService.technical_status(monitoring),
        }

    @staticmethod
    def registered_healthcheck(platform_id, *, actor=None, request=None):
        platform = SuperRootPlatform.objects.filter(slug=platform_id).first()
        if platform is None:
            raise ValueError("Plateforme introuvable.")
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.healthcheck",
            severity="warning" if platform.status != SuperRootPlatform.Status.ACTIVE else "info",
            metadata={"platform_id": platform.slug, "status": platform.status},
        )
        tile = SuperRootPlatformService.registered_platform_tile(platform)
        return {
            "checked_at": timezone.now().isoformat(),
            "status": "ok" if platform.status == SuperRootPlatform.Status.ACTIVE else "warning",
            "issues": [] if platform.status == SuperRootPlatform.Status.ACTIVE else [platform.status],
            "technical": tile["technical"],
        }

    @staticmethod
    def attach_tenants(platform_id, *, organization_id=None, hotel_ids=None, include_organization_hotels=True, actor=None, request=None):
        platform = SuperRootPlatform.objects.filter(slug=platform_id).first()
        if platform is None:
            raise ValueError("Plateforme introuvable.")
        organization = None
        hotels_qs = Hotel.objects.none()
        if organization_id:
            organization = Organization.objects.filter(pk=organization_id).first()
            if organization is None:
                raise ValueError("Organisation introuvable.")
            organization.platform = platform
            organization.save(update_fields=["platform", "updated_at"])
            if include_organization_hotels:
                hotels_qs = hotels_qs | Hotel.objects.filter(organization=organization)
        if hotel_ids:
            hotels_qs = hotels_qs | Hotel.objects.filter(pk__in=hotel_ids)
        hotel_ids_updated = list(hotels_qs.values_list("id", flat=True).distinct())
        if hotel_ids_updated:
            Hotel.objects.filter(pk__in=hotel_ids_updated).update(platform=platform, updated_at=timezone.now())
        SuperRootAuditService.critical(
            actor=actor,
            request=request,
            action="platform.attach_tenants",
            severity="warning",
            metadata={
                "platform_id": platform.slug,
                "organization_id": organization.id if organization else None,
                "hotel_ids": hotel_ids_updated,
            },
        )
        return {
            "platform": SuperRootPlatformService.registered_platform_tile(platform),
            "organization": {
                "id": organization.id,
                "name": organization.name,
                "platform_id": platform.slug,
            } if organization else None,
            "hotels_attached": len(hotel_ids_updated),
        }

    @staticmethod
    def monitoring_live(*, actor=None, request=None):
        snapshot = SuperRootMonitoringService.snapshot()
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.monitoring_live",
            severity="warning" if snapshot.get("issues") else "info",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, "issues": snapshot.get("issues", [])},
        )
        return snapshot

    @staticmethod
    def incidents(limit=50, *, actor=None, request=None):
        logs = ActivityLog.objects.select_related("user", "hotel").filter(
            severity__in=[
                ActivityLog.Severity.WARNING,
                ActivityLog.Severity.DANGER,
                ActivityLog.Severity.CRITICAL,
            ]
        ).order_by("-created_at", "-id")[:limit]
        rows = [
            {
                "id": log.id,
                "action": log.action,
                "severity": log.severity,
                "module": log.module,
                "description": log.description,
                "actor": log.user.username if log.user_id else "system",
                "hotel": log.hotel.name if log.hotel_id else "",
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
            for log in logs
        ]
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.incidents",
            severity="warning" if rows else "info",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, "count": len(rows)},
        )
        return {"count": len(rows), "incidents": rows}

    @staticmethod
    def platform_audit(limit=50, *, actor=None, request=None):
        events = PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")[:limit]
        rows = [
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor": event.actor.username if event.actor_id else "system",
                "target_type": event.target_type,
                "target_id": event.target_id,
                "target_label": event.target_label,
                "metadata": event.metadata,
                "created_at": event.created_at.isoformat() if event.created_at else "",
            }
            for event in events
        ]
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.audit",
            severity="warning",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, "count": len(rows)},
        )
        return {"count": len(rows), "audit_events": rows}

    @staticmethod
    def run_subscription_lifecycle(*, actor=None, request=None, dry_run=False):
        result = SuperRootMaintenanceService.run_action(
            "subscription_lifecycle",
            actor=actor,
            dry_run=dry_run,
        )
        SuperRootAuditService.critical(
            actor=actor,
            request=request,
            action="platform.subscription_lifecycle",
            severity="warning" if dry_run else "critical",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, "dry_run": dry_run, "result": result},
        )
        return result

    @staticmethod
    def integrity_check(limit=1000, *, actor=None, request=None):
        result = AuditLogService.verify_activity_integrity(limit=limit)
        result["status"] = "valid" if result.get("invalid_count") == 0 else "warning"
        SuperRootAuditService.access(
            actor=actor,
            request=request,
            action="platform.integrity_check",
            severity="warning" if result["status"] != "valid" else "info",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID, **result},
        )
        return result

    @staticmethod
    def critical_quotas(limit=100):
        rows = []
        hotels = Hotel.objects.select_related("organization", "subscription__plan").filter(subscription__isnull=False)
        for hotel in hotels.order_by("organization__name", "name"):
            usage = SubscriptionService.user_quota_usage(hotel)
            if usage["status"] != "critique":
                continue
            rows.append(
                {
                    "hotel_id": hotel.id,
                    "hotel_name": hotel.name,
                    "organization_id": hotel.organization_id,
                    "organization_name": hotel.organization.name if hotel.organization_id else "",
                    "subscription_status": hotel.subscription.status if hasattr(hotel, "subscription") else "",
                    **usage,
                }
            )
            if len(rows) >= limit:
                break
        return {"count": len(rows), "quotas": rows}

    @staticmethod
    def suspended_clients(limit=100):
        queryset = Organization.objects.filter(
            Q(status=Organization.Status.SUSPENDED) | Q(is_active=False)
        ).annotate(
            hotels_count=Count("hotels", distinct=True),
            active_hotels_count=Count("hotels", filter=Q(hotels__is_active=True), distinct=True),
            users_count=Count("users", distinct=True),
        ).order_by("name", "-id")
        rows = [
            {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "status": org.status,
                "is_active": org.is_active,
                "hotels_count": org.hotels_count,
                "active_hotels_count": org.active_hotels_count,
                "users_count": org.users_count,
                "updated_at": org.updated_at.isoformat() if org.updated_at else "",
            }
            for org in queryset[:limit]
        ]
        return {"count": queryset.count(), "organizations": rows}

    @staticmethod
    def export_snapshot_payload(*, actor=None, request=None):
        payload = {
            "exported_at": timezone.now().isoformat(),
            "platform": SuperRootPlatformService.platform_tile(),
            "command_center": SuperRootPlatformService.platform_command_center(),
            "monitoring": SuperRootMonitoringService.snapshot(),
            "risks": SuperRootPlatformService.risk_snapshot(),
            "critical_quotas": SuperRootPlatformService.critical_quotas(),
            "suspended_clients": SuperRootPlatformService.suspended_clients(),
            "integrity": SuperRootPlatformService.integrity_check(actor=actor, request=request),
        }
        SuperRootAuditService.critical(
            actor=actor,
            request=request,
            action="platform.snapshot_export",
            severity="warning",
            metadata={"platform_id": SuperRootPlatformService.PLATFORM_ID},
        )
        return payload

    @staticmethod
    def _monthly_revenue():
        total = Decimal("0.00")
        subscriptions = HotelSubscription.objects.select_related("plan").filter(
            status__in=[HotelSubscription.Status.ACTIVE, HotelSubscription.Status.TRIAL]
        )
        for subscription in subscriptions:
            plan = subscription.plan
            if not plan:
                continue
            if subscription.billing_cycle == HotelSubscription.BillingCycle.YEARLY:
                total += (plan.yearly_price or Decimal("0.00")) / Decimal("12")
            else:
                total += plan.monthly_price or Decimal("0.00")
        return round(total, 2)

    @staticmethod
    def business_metrics():
        active_subscriptions = HotelSubscription.objects.filter(status=HotelSubscription.Status.ACTIVE).count()
        return {
            "organizations": Organization.objects.count(),
            "organizations_active": Organization.objects.filter(is_active=True, status=Organization.Status.ACTIVE).count(),
            "organizations_suspended": Organization.objects.filter(status=Organization.Status.SUSPENDED).count(),
            "hotels": Hotel.objects.count(),
            "hotels_active": Hotel.objects.filter(is_active=True).count(),
            "users": User.objects.filter(is_active=True).count(),
            "licenses": PlatformLicense.objects.count(),
            "licenses_active": PlatformLicense.objects.filter(status=PlatformLicense.Status.ACTIVE).count(),
            "subscriptions": HotelSubscription.objects.count(),
            "subscriptions_active": active_subscriptions,
            "revenue_monthly": str(SuperRootPlatformService._monthly_revenue()),
        }

    @staticmethod
    def risk_snapshot():
        hotels_without_subscription = Hotel.objects.filter(subscription__isnull=True).count()
        quota_attention = 0
        quota_critical = 0
        for hotel in Hotel.objects.select_related("subscription__plan").filter(subscription__isnull=False):
            usage = SubscriptionService.user_quota_usage(hotel)
            quota_attention += 1 if usage["status"] == "attention" else 0
            quota_critical += 1 if usage["status"] == "critique" else 0

        admins_missing = Organization.objects.annotate(
            hotels_count=Count("hotels", distinct=True),
            admins_count=Count("users", filter=Q(users__is_platform_admin=False, users__hotel__isnull=True), distinct=True),
        ).filter(hotels_count__gt=0, admins_count=0).count()
        licenses_expired = PlatformLicense.objects.exclude(status=PlatformLicense.Status.ACTIVE).count()
        incidents = ActivityLog.objects.filter(severity__in=["warning", "danger", "critical"]).count()
        return {
            "organizations_suspended": Organization.objects.filter(status=Organization.Status.SUSPENDED).count(),
            "hotels_without_subscription": hotels_without_subscription,
            "quota_attention": quota_attention,
            "quota_critical": quota_critical,
            "admins_missing": admins_missing,
            "licenses_expired": licenses_expired,
            "incidents": incidents,
        }

    @staticmethod
    def technical_status(snapshot=None):
        snapshot = snapshot or SuperRootMonitoringService.snapshot()
        api = snapshot.get("api", {})
        database = snapshot.get("database", {})
        cache_status = snapshot.get("cache", {})
        queue = snapshot.get("queue", {})
        websocket = snapshot.get("websocket", {})
        system = snapshot.get("system", {})
        return {
            "uptime_pct": 99.8 if snapshot.get("status") == "ok" else 98.9,
            "api": {"status": "ok" if api.get("ok") else "warning", "latency_ms": api.get("latency_ms")},
            "database": {"status": "ok" if database.get("ok") else "critical", "latency_ms": database.get("latency_ms")},
            "cache": {"status": "ok" if cache_status.get("ok") else "warning", "latency_ms": cache_status.get("latency_ms")},
            "queue": {"status": "ok" if queue.get("ok") else "warning", "pending": queue.get("pending", 0)},
            "websocket": {"status": "ok" if websocket.get("ok") else "warning"},
            "system": system,
            "issues": snapshot.get("issues", []),
        }

    @staticmethod
    def platform_tile():
        default_platform = SuperRootPlatform.objects.filter(slug=SuperRootPlatformService.PLATFORM_ID).first()
        if default_platform is not None:
            tile = SuperRootPlatformService.registered_platform_tile(default_platform)
            manual_state = SuperRootPlatformService.state()
            monitoring = SuperRootMonitoringService.snapshot()
            technical = SuperRootPlatformService.technical_status(monitoring)
            status = manual_state["status"]
            if status == "active" and monitoring.get("issues"):
                status = "degraded"
            tile.update({
                "status": status,
                "manual_status": manual_state["status"],
                "reason": manual_state.get("reason", "") or tile.get("reason", ""),
                "updated_at": manual_state.get("updated_at") or tile.get("updated_at"),
                "updated_by": manual_state.get("updated_by", "") or tile.get("updated_by", ""),
                "business": SuperRootPlatformService.business_metrics(),
                "technical": technical,
                "risks": SuperRootPlatformService.risk_snapshot(),
            })
            return tile
        manual_state = SuperRootPlatformService.state()
        monitoring = SuperRootMonitoringService.snapshot()
        technical = SuperRootPlatformService.technical_status(monitoring)
        status = manual_state["status"]
        if status == "active" and monitoring.get("issues"):
            status = "degraded"
        business = SuperRootPlatformService.business_metrics()
        risks = SuperRootPlatformService.risk_snapshot()
        return {
            "id": SuperRootPlatformService.PLATFORM_ID,
            "name": SuperRootPlatformService.PLATFORM_NAME,
            "code": "AF",
            "status": status,
            "manual_status": manual_state["status"],
            "reason": manual_state.get("reason", ""),
            "updated_at": manual_state.get("updated_at"),
            "updated_by": manual_state.get("updated_by", ""),
            "business": business,
            "technical": technical,
            "risks": risks,
        }

    @staticmethod
    def platform_command_center():
        tile = SuperRootPlatformService.platform_tile()
        registered_tiles = [
            SuperRootPlatformService.registered_platform_tile(platform)
            for platform in SuperRootPlatform.objects.all()
            if platform.slug != SuperRootPlatformService.PLATFORM_ID
        ]
        business = tile["business"]
        risks = tile["risks"]
        technical = tile["technical"]
        return {
            "platforms": [tile, *registered_tiles],
            "summary": {
                **business,
                "quota_critical": risks["quota_critical"],
                "incidents": risks["incidents"],
                "uptime_pct": technical["uptime_pct"],
            },
            "risks": risks,
            "technical": technical,
            "quick_links": [
                {"label": "Organisations", "path": "/super-root/organizations"},
                {"label": "Hotels", "path": "/super-root/hotels"},
                {"label": "Licences", "path": "/super-root/licenses"},
                {"label": "Monitoring", "path": "/super-root/monitoring"},
                {"label": "Audit Logs", "path": "/super-root/audit-logs"},
                {"label": "Securite", "path": "/super-root/security"},
            ],
        }

    @staticmethod
    def overview():
        organizations = Organization.objects.annotate(
            hotels_count=Count("hotels", distinct=True),
            active_hotels_count=Count("hotels", filter=Q(hotels__is_active=True), distinct=True),
            users_count=Count("users", distinct=True),
        ).order_by("name")
        hotels = Hotel.objects.select_related("organization", "subscription__plan").annotate(
            active_users_count=Count("users", filter=Q(users__is_active=True), distinct=True),
        )

        command_center = SuperRootPlatformService.platform_command_center()
        return {
            "command_center": command_center,
            "platforms": command_center["platforms"],
            "summary": command_center["summary"],
            "risks": command_center["risks"],
            "technical": command_center["technical"],
            "quick_links": command_center["quick_links"],
            "organizations": [
                {
                    "id": org.id,
                    "name": org.name,
                    "slug": org.slug,
                    "is_active": org.is_active,
                    "hotels_count": org.hotels_count,
                    "active_hotels_count": org.active_hotels_count,
                    "users_count": org.users_count,
                }
                for org in organizations[:200]
            ],
            "hotels_by_state": {
                "active": hotels.filter(is_active=True).count(),
                "inactive": hotels.filter(is_active=False).count(),
                "without_subscription": hotels.filter(subscription__isnull=True).count(),
            },
            "users_by_scope": {
                "super_root": User.objects.filter(is_superuser=True, is_platform_admin=False).count(),
                "platform_admin": User.objects.filter(is_platform_admin=True).count(),
                "hotel_users": User.objects.filter(is_platform_admin=False, hotel__isnull=False).count(),
                "organization_users": User.objects.filter(is_platform_admin=False, organization__isnull=False, hotel__isnull=True).count(),
            },
            "modules": [
                {
                    "id": module.id,
                    "code": module.code,
                    "name": module.name,
                    "is_active": module.is_active,
                    "licenses_count": PlatformLicense.objects.filter(module=module).count(),
                }
                for module in ModuleLicenseService.list_modules()
            ],
            "subscription_health": {
                "active": HotelSubscription.objects.filter(status=HotelSubscription.Status.ACTIVE).count(),
                "trial": HotelSubscription.objects.filter(status=HotelSubscription.Status.TRIAL).count(),
                "suspended": HotelSubscription.objects.filter(status=HotelSubscription.Status.SUSPENDED).count(),
                "expired": HotelSubscription.objects.filter(status=HotelSubscription.Status.EXPIRED).count(),
            },
        }

    @staticmethod
    def hotel_quota_snapshot(limit=100):
        hotels = Hotel.objects.select_related("organization", "subscription__plan").filter(subscription__isnull=False)
        rows = []
        for hotel in hotels.order_by("organization__name", "name")[:limit]:
            rows.append(
                {
                    "hotel_id": hotel.id,
                    "hotel_name": hotel.name,
                    "organization_name": hotel.organization.name if hotel.organization_id else "",
                    "subscription_status": hotel.subscription.status if hasattr(hotel, "subscription") else "",
                    **SubscriptionService.user_quota_usage(hotel),
                }
            )
        return rows
