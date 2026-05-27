from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.audit_logs.models import ActivityLog, PlatformAuditEvent
from apps.users.models import BlacklistedToken, User, UserSession


class SuperRootSecurityService:
    """Global security policies and sensitive account supervision."""

    @staticmethod
    def policy_snapshot():
        return {
            "auth_enforce_sensitive_2fa": bool(getattr(settings, "AUTH_ENFORCE_SENSITIVE_2FA", False)),
            "subscription_enforcement_enabled": bool(getattr(settings, "SUBSCRIPTION_ENFORCEMENT_ENABLED", False)),
            "tenancy_strict_modules": getattr(settings, "TENANCY_STRICT_MODULES", {}),
            "debug": bool(getattr(settings, "DEBUG", False)),
            "allowed_hosts_count": len(getattr(settings, "ALLOWED_HOSTS", [])),
        }

    @staticmethod
    def serialize_session(session):
        return {
            "id": session.id,
            "user_id": session.user_id,
            "username": session.user.username if session.user_id else "",
            "device_name": session.device_name,
            "browser": session.browser,
            "os": session.os,
            "ip_address": session.ip_address,
            "user_agent": session.user_agent,
            "last_activity": session.last_activity.isoformat() if session.last_activity else "",
            "created_at": session.created_at.isoformat() if session.created_at else "",
            "is_active": session.is_active,
        }

    @staticmethod
    def active_super_root_sessions():
        return (
            UserSession.objects.select_related("user")
            .filter(user__is_superuser=True, user__is_platform_admin=False, user__is_active=True, is_active=True)
            .order_by("-last_activity", "-created_at")
        )

    @staticmethod
    def revoke_super_root_session(session_id):
        session = SuperRootSecurityService.active_super_root_sessions().filter(pk=session_id).first()
        if session is None:
            return None
        session.is_active = False
        session.revoked_at = timezone.now()
        session.save(update_fields=["is_active", "revoked_at"])
        return session

    @staticmethod
    def review():
        now = timezone.now()
        sensitive_users = User.objects.filter(is_active=True).filter(
            is_superuser=True
        ) | User.objects.filter(is_active=True, is_platform_admin=True)
        sensitive_users = sensitive_users.distinct().order_by("username")

        without_2fa = sensitive_users.filter(two_factor_enabled=False)
        locked_users = User.objects.filter(locked_until__gt=now).order_by("locked_until")
        recent_danger_logs = ActivityLog.objects.filter(
            severity__in=[ActivityLog.Severity.WARNING, ActivityLog.Severity.DANGER],
            created_at__gte=now - timedelta(days=7),
        ).order_by("-created_at")[:20]
        recent_platform_events = PlatformAuditEvent.objects.select_related("actor").order_by("-created_at", "-id")[:20]

        return {
            "policy": SuperRootSecurityService.policy_snapshot(),
            "sensitive_users_total": sensitive_users.count(),
            "mfa_policy": {
                "super_root_required": True,
                "sensitive_2fa_enforced": bool(getattr(settings, "AUTH_ENFORCE_SENSITIVE_2FA", False)),
                "session_age_seconds": int(getattr(settings, "SUPER_ROOT_SESSION_AGE_SECONDS", 1800)),
            },
            "token_policy": {
                "blacklisted_tokens": BlacklistedToken.objects.count(),
                "active_sessions": UserSession.objects.filter(is_active=True).count(),
                "revoked_sessions": UserSession.objects.filter(is_active=False).count(),
            },
            "device_summary": list(
                UserSession.objects.filter(is_active=True)
                .values("browser", "os")
                .order_by("browser", "os")
                .annotate(count=models.Count("id"))[:20]
            ),
            "active_super_root_sessions": [
                SuperRootSecurityService.serialize_session(session)
                for session in SuperRootSecurityService.active_super_root_sessions()[:50]
            ],
            "sensitive_users_without_2fa": [
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_super_root": user.is_super_root,
                    "is_platform_admin": user.is_platform_admin,
                }
                for user in without_2fa[:50]
            ],
            "locked_users": [
                {
                    "id": user.id,
                    "username": user.username,
                    "locked_until": user.locked_until.isoformat() if user.locked_until else "",
                    "failed_login_attempts": user.failed_login_attempts,
                }
                for user in locked_users[:50]
            ],
            "recent_sensitive_activity": [
                {
                    "id": item.id,
                    "module": item.module,
                    "action": item.action,
                    "severity": item.severity,
                    "description": item.description,
                    "user": item.user.username if item.user_id else "",
                    "created_at": item.created_at.isoformat(),
                }
                for item in recent_danger_logs
            ],
            "recent_platform_events": [
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "actor": event.actor.username if event.actor_id else "system",
                    "target_label": event.target_label,
                    "created_at": event.created_at.isoformat(),
                }
                for event in recent_platform_events
            ],
        }
