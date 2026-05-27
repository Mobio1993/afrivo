from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import ActivityLog, PlatformAuditEvent
from apps.licensing.services.subscription_service import SubscriptionService
from apps.platform_admin.models import HotelSubscription, PlatformLicense, PlatformModule
from apps.super_root.services.monitoring_service import SuperRootMonitoringService
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User, UserSession


class SuperRootDashboardService:
    """Global system dashboard reserved for Super Root."""

    HEALTH_CACHE_KEY = "super_root:dashboard:health_timeline"

    @staticmethod
    def build():
        now = timezone.now()
        today = timezone.localdate()
        subscriptions = HotelSubscription.objects.select_related("hotel", "organization", "plan")
        licenses = PlatformLicense.objects.select_related("module", "organization", "hotel")
        hotels = Hotel.objects.select_related("organization")
        users = User.objects.select_related("organization", "hotel")

        quota_risks = []
        for hotel in hotels.filter(is_active=True, subscription__isnull=False).select_related("subscription__plan")[:500]:
            usage = SubscriptionService.user_quota_usage(hotel)
            if usage["status"] in {"attention", "critique"}:
                quota_risks.append(
                    {
                        "hotel_id": hotel.id,
                        "hotel_name": hotel.name,
                        "organization_name": hotel.organization.name if hotel.organization_id else "",
                        **usage,
                    }
                )

        expiring_licenses = licenses.filter(
            status=PlatformLicense.Status.ACTIVE,
            ends_at__isnull=False,
            ends_at__lte=now + timedelta(days=14),
        ).order_by("ends_at")[:10]

        recent_platform_events = PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")[:10]
        active_license_revenue = licenses.filter(status=PlatformLicense.Status.ACTIVE).aggregate(
            total=Sum("monthly_price")
        )["total"] or 0
        active_subscription_revenue = subscriptions.filter(status=HotelSubscription.Status.ACTIVE).aggregate(
            total=Sum("plan__monthly_price")
        )["total"] or 0
        security_incidents = ActivityLog.objects.filter(
            severity__in=[ActivityLog.Severity.WARNING, ActivityLog.Severity.DANGER, ActivityLog.Severity.CRITICAL],
            created_at__gte=now - timedelta(days=7),
        ).count()
        platform_incidents = PlatformAuditEvent.objects.filter(
            event_type__in=[
                PlatformAuditEvent.EventType.HOTEL_SUSPENDED,
                PlatformAuditEvent.EventType.LICENSE_SUSPENDED,
                PlatformAuditEvent.EventType.SECURITY_REVIEW,
            ],
            created_at__gte=now - timedelta(days=7),
        ).count()

        monitoring = SuperRootMonitoringService.snapshot()
        risk_center = SuperRootDashboardService._risk_center(
            users=users,
            subscriptions=subscriptions,
            licenses=licenses,
            quota_risks=quota_risks,
        )
        critical_incidents = SuperRootDashboardService._critical_incidents(now=now)
        urgent_actions = SuperRootDashboardService._urgent_actions(
            hotels=hotels,
            users=users,
            subscriptions=subscriptions,
            licenses=licenses,
            quota_risks=quota_risks,
            critical_incidents=critical_incidents,
        )
        security_overview = SuperRootDashboardService._security_overview(users=users, now=now)
        revenue_overview = SuperRootDashboardService._revenue_overview(
            subscriptions=subscriptions,
            licenses=licenses,
            active_subscription_revenue=active_subscription_revenue,
            active_license_revenue=active_license_revenue,
            now=now,
        )
        latest_critical_actions = SuperRootDashboardService._latest_critical_actions()
        score = SuperRootDashboardService._health_score(
            monitoring=monitoring,
            urgent_actions=urgent_actions,
            critical_incidents=critical_incidents,
            risk_center=risk_center,
        )
        health_timeline = SuperRootDashboardService._health_timeline(score=score, urgent_actions=urgent_actions)

        return {
            "generated_at": now.isoformat(),
            "scope": "super_root",
            "health_score": score,
            "kpis": {
                "organizations_total": Organization.objects.count(),
                "organizations_active": Organization.objects.filter(is_active=True).count(),
                "hotels_total": hotels.count(),
                "hotels_active": hotels.filter(is_active=True).count(),
                "users_total": users.count(),
                "users_active": users.filter(is_active=True).count(),
                "platform_admins": users.filter(is_platform_admin=True, is_active=True).count(),
                "super_roots": users.filter(is_superuser=True, is_platform_admin=False, is_active=True).count(),
                "modules_active": PlatformModule.objects.filter(is_active=True).count(),
                "licenses_active": licenses.filter(status=PlatformLicense.Status.ACTIVE).count(),
                "subscriptions_active": subscriptions.filter(status=HotelSubscription.Status.ACTIVE).count(),
                "subscriptions_trial": subscriptions.filter(status=HotelSubscription.Status.TRIAL).count(),
                "subscriptions_suspended": subscriptions.filter(status=HotelSubscription.Status.SUSPENDED).count(),
                "subscriptions_expired": subscriptions.filter(status=HotelSubscription.Status.EXPIRED).count(),
                "activity_today": ActivityLog.objects.filter(created_at__date=today).count(),
                "monthly_revenue": float(active_license_revenue + active_subscription_revenue),
                "api_errors_5xx": monitoring.get("api", {}).get("errors", 0),
                "api_requests_sample": monitoring.get("api", {}).get("requests", 0),
                "security_incidents_7d": security_incidents,
                "platform_incidents_7d": platform_incidents,
                "incidents_total_7d": security_incidents + platform_incidents,
            },
            "service_health": SuperRootDashboardService._service_health(),
            "monitoring_summary": SuperRootDashboardService._monitoring_summary(monitoring),
            "urgent_actions": urgent_actions,
            "risk_center": risk_center,
            "critical_incidents": critical_incidents,
            "security_overview": security_overview,
            "revenue_overview": revenue_overview,
            "latest_critical_actions": latest_critical_actions,
            "health_timeline": health_timeline,
            "subscription_distribution": list(
                subscriptions.values("status").annotate(count=Count("id")).order_by("status")
            ),
            "license_distribution": list(licenses.values("status").annotate(count=Count("id")).order_by("status")),
            "quota_risks": quota_risks[:20],
            "expiring_licenses": [
                {
                    "id": item.id,
                    "module": item.module.code if item.module_id else "",
                    "organization": item.organization.name if item.organization_id else "",
                    "hotel": item.hotel.name if item.hotel_id else "",
                    "ends_at": item.ends_at.isoformat() if item.ends_at else "",
                }
                for item in expiring_licenses
            ],
            "recent_platform_events": [
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "actor": event.actor.username if event.actor_id else "system",
                    "target_type": event.target_type,
                    "target_label": event.target_label,
                    "created_at": event.created_at.isoformat(),
                }
                for event in recent_platform_events
            ],
            "alerts": SuperRootDashboardService._build_alerts(users=users, subscriptions=subscriptions, licenses=licenses),
        }

    @staticmethod
    def _monitoring_summary(monitoring):
        api = monitoring.get("api", {})
        database = monitoring.get("database", {})
        cache_status = monitoring.get("cache", {})
        queue = monitoring.get("queue", {})
        websocket = monitoring.get("websocket", {})
        items = [
            {
                "id": "api",
                "label": "API",
                "status": "ok" if api.get("ok") else "warning",
                "value": f"{api.get('latency_ms', '-')} ms",
                "latency_ms": api.get("latency_ms"),
            },
            {
                "id": "database",
                "label": "Base de donnees",
                "status": "ok" if database.get("ok") else "critical",
                "value": f"{database.get('latency_ms', '-')} ms",
                "latency_ms": database.get("latency_ms"),
            },
            {
                "id": "cache",
                "label": "Cache",
                "status": "ok" if cache_status.get("ok") else "warning",
                "value": f"{cache_status.get('latency_ms', '-')} ms",
                "latency_ms": cache_status.get("latency_ms"),
            },
            {
                "id": "queue",
                "label": "Queue",
                "status": "ok" if queue.get("ok") else "warning",
                "value": f"{queue.get('pending', 0)} pending",
                "pending": queue.get("pending", 0),
            },
            {
                "id": "websocket",
                "label": "WebSocket",
                "status": "ok" if websocket.get("ok") else "warning",
                "value": websocket.get("status") or ("OK" if websocket.get("ok") else "Non configure"),
            },
        ]
        system = monitoring.get("system", {})
        if system.get("cpu_pct") is not None:
            items.append({
                "id": "cpu",
                "label": "CPU",
                "status": "warning" if float(system.get("cpu_pct") or 0) >= 80 else "ok",
                "value": f"{system.get('cpu_pct')}%",
            })
        if system.get("ram_pct") is not None:
            items.append({
                "id": "ram",
                "label": "RAM",
                "status": "warning" if float(system.get("ram_pct") or 0) >= 80 else "ok",
                "value": f"{system.get('ram_pct')}%",
            })
        if system.get("disk_pct") is not None:
            items.append({
                "id": "disk",
                "label": "Disque",
                "status": "warning" if float(system.get("disk_pct") or 0) >= 85 else "ok",
                "value": f"{system.get('disk_pct')}%",
            })
        return {
            "checked_at": monitoring.get("checked_at"),
            "status": monitoring.get("status", "warning"),
            "issues": monitoring.get("issues", []),
            "items": items,
        }

    @staticmethod
    def _urgent_actions(*, hotels, users, subscriptions, licenses, quota_risks, critical_incidents):
        actions = []
        critical_quota_count = sum(1 for item in quota_risks if item.get("status") == "critique")
        attention_quota_count = sum(1 for item in quota_risks if item.get("status") == "attention")
        expired_subscriptions = subscriptions.filter(status=HotelSubscription.Status.EXPIRED).count()
        hotels_without_subscription = hotels.filter(is_active=True, subscription__isnull=True).count()
        hotels_without_admin = SuperRootDashboardService._hotels_without_admin_count(hotels=hotels, users=users)
        security_count = len(critical_incidents)

        if critical_quota_count:
            actions.append({
                "id": "quotas_critical",
                "label": "Quotas critiques",
                "description": f"{critical_quota_count} hotel(s) ont un quota utilisateur critique.",
                "severity": "critical",
                "count": critical_quota_count,
                "target": "/super-root/platforms",
            })
        if expired_subscriptions:
            actions.append({
                "id": "subscriptions_expired",
                "label": "Abonnements expires",
                "description": f"{expired_subscriptions} abonnement(s) expire(s) doivent etre traites.",
                "severity": "critical",
                "count": expired_subscriptions,
                "target": "/super-root/licenses",
            })
        if hotels_without_subscription:
            actions.append({
                "id": "hotels_without_subscription",
                "label": "Hotels sans abonnement",
                "description": f"{hotels_without_subscription} hotel(s) actif(s) n'ont pas d'abonnement.",
                "severity": "warning",
                "count": hotels_without_subscription,
                "target": "/super-root/hotels",
            })
        if hotels_without_admin:
            actions.append({
                "id": "missing_admins",
                "label": "Admins manquants",
                "description": f"{hotels_without_admin} hotel(s) actif(s) n'ont aucun admin hotel actif.",
                "severity": "warning",
                "count": hotels_without_admin,
                "target": "/super-root/users",
            })
        if security_count:
            actions.append({
                "id": "security_incidents",
                "label": "Incidents securite",
                "description": f"{security_count} incident(s) critique(s) recent(s) a analyser.",
                "severity": "critical",
                "count": security_count,
                "target": "/super-root/security",
            })
        if attention_quota_count and not critical_quota_count:
            actions.append({
                "id": "quotas_attention",
                "label": "Quotas en attention",
                "description": f"{attention_quota_count} hotel(s) approchent leur limite utilisateur.",
                "severity": "warning",
                "count": attention_quota_count,
                "target": "/super-root/platforms",
            })
        if not actions:
            actions.append({
                "id": "nominal",
                "label": "Aucune action urgente",
                "description": "Le parc AFRIVO ne presente aucune urgence critique.",
                "severity": "ok",
                "count": 0,
                "target": "/super-root/dashboard",
            })
        return actions[:8]

    @staticmethod
    def _risk_center(*, users, subscriptions, licenses, quota_risks):
        now = timezone.now()
        suspended_clients = Organization.objects.filter(is_active=False).count()
        expired_licenses = licenses.filter(status=PlatformLicense.Status.EXPIRED).count()
        suspended_licenses = licenses.filter(status=PlatformLicense.Status.SUSPENDED).count()
        locked_accounts = users.filter(locked_until__gt=now).count()
        critical_quotas = sum(1 for item in quota_risks if item.get("status") == "critique")
        expired_subscriptions = subscriptions.filter(status=HotelSubscription.Status.EXPIRED).count()
        risks = [
            {
                "id": "suspended_clients",
                "label": "Clients suspendus",
                "count": suspended_clients,
                "severity": "critical" if suspended_clients else "ok",
                "target": "/super-root/organizations",
            },
            {
                "id": "expired_licenses",
                "label": "Licences expirees",
                "count": expired_licenses,
                "severity": "critical" if expired_licenses else "ok",
                "target": "/super-root/licenses",
            },
            {
                "id": "suspended_licenses",
                "label": "Licences suspendues",
                "count": suspended_licenses,
                "severity": "warning" if suspended_licenses else "ok",
                "target": "/super-root/licenses",
            },
            {
                "id": "critical_quotas",
                "label": "Quotas critiques",
                "count": critical_quotas,
                "severity": "critical" if critical_quotas else "ok",
                "target": "/super-root/platforms",
            },
            {
                "id": "locked_accounts",
                "label": "Comptes verrouilles",
                "count": locked_accounts,
                "severity": "warning" if locked_accounts else "ok",
                "target": "/super-root/security",
            },
            {
                "id": "expired_subscriptions",
                "label": "Abonnements expires",
                "count": expired_subscriptions,
                "severity": "critical" if expired_subscriptions else "ok",
                "target": "/super-root/licenses",
            },
        ]
        return {
            "status": "critical" if any(item["severity"] == "critical" for item in risks) else "warning" if any(item["severity"] == "warning" for item in risks) else "ok",
            "items": risks,
        }

    @staticmethod
    def _critical_incidents(*, now):
        danger_logs = ActivityLog.objects.select_related("user", "hotel").filter(
            severity__in=[ActivityLog.Severity.DANGER, ActivityLog.Severity.CRITICAL],
            created_at__gte=now - timedelta(days=7),
        ).order_by("-created_at", "-id")[:10]
        platform_events = PlatformAuditEvent.objects.select_related("actor").filter(
            event_type__in=[
                PlatformAuditEvent.EventType.HOTEL_SUSPENDED,
                PlatformAuditEvent.EventType.LICENSE_SUSPENDED,
                PlatformAuditEvent.EventType.SECURITY_REVIEW,
                PlatformAuditEvent.EventType.ADMIN_ACCESS_RESET,
            ],
            created_at__gte=now - timedelta(days=7),
        ).order_by("-created_at", "-id")[:10]
        rows = [
            {
                "id": f"activity-{item.id}",
                "source": item.module or "activity",
                "severity": "critical" if item.severity == ActivityLog.Severity.CRITICAL else "danger",
                "title": item.action,
                "description": item.description,
                "actor": item.user.username if item.user_id else "system",
                "target": item.object_reference or (item.hotel.name if item.hotel_id else ""),
                "created_at": item.created_at.isoformat(),
                "link": "/super-root/audit-logs",
            }
            for item in danger_logs
        ]
        rows.extend(
            {
                "id": f"platform-{item.id}",
                "source": "platform",
                "severity": "warning" if item.event_type != PlatformAuditEvent.EventType.SECURITY_REVIEW else "critical",
                "title": item.event_type,
                "description": item.target_label,
                "actor": item.actor.username if item.actor_id else "system",
                "target": item.target_label,
                "created_at": item.created_at.isoformat(),
                "link": "/super-root/audit-logs",
            }
            for item in platform_events
        )
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return rows[:10]

    @staticmethod
    def _security_overview(*, users, now):
        sensitive_users = users.filter(is_active=True).filter(Q(is_superuser=True) | Q(is_platform_admin=True)).distinct()
        without_mfa = sensitive_users.filter(two_factor_enabled=False)
        locked_users = users.filter(locked_until__gt=now)
        failed_login_users = users.filter(failed_login_attempts__gt=0)
        recent_sensitive_activity = ActivityLog.objects.select_related("user").filter(
            Q(module__icontains="security")
            | Q(module__icontains="iam")
            | Q(description__icontains="Super Root")
            | Q(description__icontains="session_revoke")
            | Q(action__in=[ActivityLog.Action.PERMISSION_CHANGE, ActivityLog.Action.PASSWORD_CHANGE]),
            created_at__gte=now - timedelta(days=7),
        ).order_by("-created_at", "-id")[:8]
        return {
            "active_super_root_sessions": UserSession.objects.filter(
                user__is_superuser=True,
                user__is_platform_admin=False,
                user__is_active=True,
                is_active=True,
            ).count(),
            "active_sessions": UserSession.objects.filter(is_active=True).count(),
            "sensitive_users_total": sensitive_users.count(),
            "sensitive_users_without_mfa": without_mfa.count(),
            "failed_login_users": failed_login_users.count(),
            "failed_login_attempts": users.aggregate(total=Sum("failed_login_attempts"))["total"] or 0,
            "locked_users": locked_users.count(),
            "status": "critical" if locked_users.exists() else "warning" if without_mfa.exists() or failed_login_users.exists() else "ok",
            "recent_sensitive_activity": [
                {
                    "id": item.id,
                    "action": item.action,
                    "module": item.module,
                    "severity": item.severity,
                    "description": item.description,
                    "actor": item.user.username if item.user_id else "system",
                    "created_at": item.created_at.isoformat(),
                }
                for item in recent_sensitive_activity
            ],
        }

    @staticmethod
    def _revenue_overview(*, subscriptions, licenses, active_subscription_revenue, active_license_revenue, now):
        active_total = active_subscription_revenue + active_license_revenue
        previous_window_start = now - timedelta(days=60)
        current_window_start = now - timedelta(days=30)
        current_created = (
            subscriptions.filter(created_at__gte=current_window_start).count()
            + licenses.filter(created_at__gte=current_window_start).count()
        )
        previous_created = (
            subscriptions.filter(created_at__gte=previous_window_start, created_at__lt=current_window_start).count()
            + licenses.filter(created_at__gte=previous_window_start, created_at__lt=current_window_start).count()
        )
        if previous_created:
            trend_pct = round(((current_created - previous_created) / previous_created) * 100, 1)
        else:
            trend_pct = 100 if current_created else 0
        return {
            "monthly_revenue": float(active_total),
            "subscription_revenue": float(active_subscription_revenue),
            "license_revenue": float(active_license_revenue),
            "trend_pct": trend_pct,
            "subscriptions": {
                "active": subscriptions.filter(status=HotelSubscription.Status.ACTIVE).count(),
                "trial": subscriptions.filter(status=HotelSubscription.Status.TRIAL).count(),
                "expired": subscriptions.filter(status=HotelSubscription.Status.EXPIRED).count(),
                "suspended": subscriptions.filter(status=HotelSubscription.Status.SUSPENDED).count(),
                "cancelled": subscriptions.filter(status=HotelSubscription.Status.CANCELLED).count(),
            },
            "licenses": {
                "active": licenses.filter(status=PlatformLicense.Status.ACTIVE).count(),
                "expired": licenses.filter(status=PlatformLicense.Status.EXPIRED).count(),
                "suspended": licenses.filter(status=PlatformLicense.Status.SUSPENDED).count(),
                "cancelled": licenses.filter(status=PlatformLicense.Status.CANCELLED).count(),
            },
        }

    @staticmethod
    def _latest_critical_actions():
        critical_event_types = [
            PlatformAuditEvent.EventType.HOTEL_SUSPENDED,
            PlatformAuditEvent.EventType.HOTEL_REACTIVATED,
            PlatformAuditEvent.EventType.LICENSE_SUSPENDED,
            PlatformAuditEvent.EventType.ADMIN_CREATED,
            PlatformAuditEvent.EventType.ADMIN_UPDATED,
            PlatformAuditEvent.EventType.ADMIN_ACCESS_RESET,
            PlatformAuditEvent.EventType.SECURITY_REVIEW,
        ]
        platform_rows = [
            {
                "id": f"platform-{item.id}",
                "source": "platform",
                "action": item.event_type,
                "severity": "warning",
                "actor": item.actor.username if item.actor_id else "system",
                "target": item.target_label,
                "created_at": item.created_at.isoformat(),
                "link": "/super-root/audit-logs",
            }
            for item in PlatformAuditEvent.objects.select_related("actor")
            .filter(event_type__in=critical_event_types)
            .order_by("-created_at", "-id")[:10]
        ]
        activity_rows = [
            {
                "id": f"activity-{item.id}",
                "source": item.module,
                "action": item.action,
                "severity": item.severity,
                "actor": item.user.username if item.user_id else "system",
                "target": item.object_reference,
                "created_at": item.created_at.isoformat(),
                "link": "/super-root/audit-logs",
            }
            for item in ActivityLog.objects.select_related("user")
            .filter(
                Q(module__icontains="maintenance")
                | Q(module__icontains="security")
                | Q(module__icontains="iam")
                | Q(description__icontains="platform.")
                | Q(description__icontains="session_revoke")
                | Q(action__in=[ActivityLog.Action.PERMISSION_CHANGE, ActivityLog.Action.PASSWORD_CHANGE, ActivityLog.Action.EXPORT])
            )
            .order_by("-created_at", "-id")[:10]
        ]
        rows = platform_rows + activity_rows
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return rows[:10]

    @staticmethod
    def _health_score(*, monitoring, urgent_actions, critical_incidents, risk_center):
        score = 100
        if monitoring.get("status") != "ok":
            score -= min(20, len(monitoring.get("issues", [])) * 5)
        score -= min(25, sum(1 for item in urgent_actions if item.get("severity") == "critical") * 8)
        score -= min(15, sum(1 for item in urgent_actions if item.get("severity") == "warning") * 4)
        score -= min(20, len(critical_incidents) * 3)
        score -= min(15, sum(1 for item in risk_center.get("items", []) if item.get("severity") == "critical") * 5)
        return max(0, score)

    @staticmethod
    def _health_timeline(*, score, urgent_actions):
        now = timezone.now()
        history = cache.get(SuperRootDashboardService.HEALTH_CACHE_KEY) or []
        previous = history[-1]["score"] if history else score
        reason = next(
            (item["label"] for item in urgent_actions if item.get("severity") in {"critical", "warning"}),
            "Aucune degradation majeure",
        )
        point = {
            "score": score,
            "recorded_at": now.isoformat(),
            "reason": reason,
        }
        history.append(point)
        cutoff = now - timedelta(hours=24)
        compact_history = []
        for item in history[-48:]:
            try:
                recorded = timezone.datetime.fromisoformat(item["recorded_at"])
                if timezone.is_naive(recorded):
                    recorded = timezone.make_aware(recorded, timezone.get_current_timezone())
                if recorded >= cutoff:
                    compact_history.append(item)
            except Exception:
                compact_history.append(item)
        cache.set(SuperRootDashboardService.HEALTH_CACHE_KEY, compact_history, 60 * 60 * 24 * 7)
        delta = score - previous
        return {
            "current": score,
            "previous": previous,
            "delta": delta,
            "trend": "up" if delta > 0 else "down" if delta < 0 else "stable",
            "reason": reason,
            "points": compact_history[-24:],
        }

    @staticmethod
    def _hotels_without_admin_count(*, hotels, users):
        active_hotel_ids = list(hotels.filter(is_active=True).values_list("id", flat=True)[:1000])
        if not active_hotel_ids:
            return 0
        hotel_ids_with_admin = set(
            users.filter(
                is_active=True,
                is_platform_admin=False,
                hotel_id__in=active_hotel_ids,
                role=User.Role.ADMIN,
            ).values_list("hotel_id", flat=True)
        )
        return len([hotel_id for hotel_id in active_hotel_ids if hotel_id not in hotel_ids_with_admin])

    @staticmethod
    def _service_health():
        from apps.super_root.services.maintenance_service import SuperRootMaintenanceService
        from apps.super_root.services.security_service import SuperRootSecurityService

        status = SuperRootMaintenanceService.status()
        sessions = SuperRootSecurityService.active_super_root_sessions().count()
        db_ok = bool(status.get("database", {}).get("ok"))
        cache_ok = bool(status.get("cache", {}).get("ok"))
        issues = []
        if not db_ok:
            issues.append("database")
        if not cache_ok:
            issues.append("cache")
        if sessions > 3:
            issues.append("super_root_sessions")
        return {
            "database_ok": db_ok,
            "cache_ok": cache_ok,
            "active_super_root_sessions": sessions,
            "status": "warning" if issues else "ok",
            "issues": issues,
        }

    @staticmethod
    def _build_alerts(*, users, subscriptions, licenses):
        alerts = []
        locked_count = users.filter(locked_until__gt=timezone.now()).count()
        if locked_count:
            alerts.append({"type": "warning", "message": f"{locked_count} compte(s) verrouille(s)."})

        expired_count = subscriptions.filter(status=HotelSubscription.Status.EXPIRED).count()
        if expired_count:
            alerts.append({"type": "critical", "message": f"{expired_count} abonnement(s) expire(s)."})

        suspended_licenses = licenses.filter(status=PlatformLicense.Status.SUSPENDED).count()
        if suspended_licenses:
            alerts.append({"type": "warning", "message": f"{suspended_licenses} licence(s) suspendue(s)."})

        if not alerts:
            alerts.append({"type": "ok", "message": "Systeme stable - aucune alerte globale active."})
        return alerts
