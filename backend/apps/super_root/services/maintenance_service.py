from django.core.cache import cache
from django.db import connection
from django.utils import timezone

from apps.audit_logs.services import AuditService
from apps.licensing.services.subscription_service import SubscriptionService
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User


class SuperRootMaintenanceService:
    """Maintenance and operational checks reserved for Super Root."""

    @staticmethod
    def status():
        database_ok = True
        database_error = ""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            database_ok = False
            database_error = str(exc)

        cache_ok = True
        cache_error = ""
        try:
            cache.set("super_root_healthcheck", "ok", 10)
            cache_ok = cache.get("super_root_healthcheck") == "ok"
        except Exception as exc:
            cache_ok = False
            cache_error = str(exc)

        return {
            "checked_at": timezone.now().isoformat(),
            "database": {"ok": database_ok, "error": database_error},
            "cache": {"ok": cache_ok, "error": cache_error},
            "tables": {
                "organizations": Organization.objects.count(),
                "hotels": Hotel.objects.count(),
                "users": User.objects.count(),
            },
        }

    @staticmethod
    def readiness():
        hotels_without_subscription = Hotel.objects.filter(subscription__isnull=True).count()
        users_without_scope = User.objects.filter(is_platform_admin=False, organization__isnull=True, hotel__isnull=True).count()
        inactive_organizations_with_active_hotels = Organization.objects.filter(is_active=False, hotels__is_active=True).distinct().count()
        return {
            "hotels_without_subscription": hotels_without_subscription,
            "users_without_scope": users_without_scope,
            "inactive_organizations_with_active_hotels": inactive_organizations_with_active_hotels,
            "ready": not any(
                [
                    hotels_without_subscription,
                    users_without_scope,
                    inactive_organizations_with_active_hotels,
                ]
            ),
        }

    @staticmethod
    def run_action(action, *, actor=None, dry_run=True):
        if action == "subscription_lifecycle":
            if dry_run:
                result = {"dry_run": True, "action": action, "message": "Lifecycle abonnement pret a etre execute."}
            else:
                result = SubscriptionService.process_lifecycle()
                result["dry_run"] = False
        elif action == "healthcheck":
            result = {"dry_run": dry_run, "action": action, "status": SuperRootMaintenanceService.status()}
        else:
            raise ValueError("Action de maintenance inconnue.")

        AuditService.log(
            actor=actor,
            action=f"maintenance.{action}",
            module="platform_maintenance",
            metadata={"dry_run": dry_run, "result": result},
            severity="warning" if not dry_run else "info",
            description=f"Maintenance Super Root: {action}",
        )
        return result
