from dataclasses import dataclass
import time

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.audit_logs.services import AuditService
from apps.users.models import User
from apps.super_root.services.super_root_guard import allow_super_root_mutation


@dataclass(frozen=True)
class CriticalAction:
    code: str
    label: str
    required_phrase: str = "CONFIRMER"
    severity: str = "warning"


class SuperRootSecurityPolicyService:
    """Security policy facade for the Super Root console.

    This service centralizes Super Root rules without moving existing auth or
    user models. Endpoints can call it before performing sensitive operations.
    """

    DEFAULT_SESSION_AGE_SECONDS = 30 * 60
    SUPER_ROOT_BOOTSTRAP_SETTING = "ALLOW_SUPER_ROOT_BOOTSTRAP"
    SESSION_AGE_SETTING = "SUPER_ROOT_SESSION_AGE_SECONDS"
    RECENT_MFA_GRACE_SECONDS = 5 * 60

    ACTION_MAINTENANCE = "maintenance.system"
    ACTION_BACKUP_RESTORE = "backup.restore"
    ACTION_SUPER_ROOT_CREATE = "super_root.create"
    ACTION_SUPER_ROOT_ELEVATE = "super_root.elevate"
    ACTION_ROLES_PERMISSIONS_UPDATE = "iam.roles_permissions.update"
    ACTION_PLATFORM_SUSPEND = "platform.suspend"
    ACTION_HOTEL_SUSPEND = "hotel.suspend"
    ACTION_GLOBAL_LICENSE_CHANGE = "license.global_change"
    ACTION_MFA_DISABLE = "mfa.disable"
    ACTION_SESSION_REVOKE = "security.session_revoke"

    CRITICAL_ACTIONS = {
        ACTION_MAINTENANCE: CriticalAction(
            code=ACTION_MAINTENANCE,
            label="Maintenance systeme",
        ),
        ACTION_BACKUP_RESTORE: CriticalAction(
            code=ACTION_BACKUP_RESTORE,
            label="Backup / restauration",
            required_phrase="RESTAURER",
            severity="critical",
        ),
        ACTION_SUPER_ROOT_CREATE: CriticalAction(
            code=ACTION_SUPER_ROOT_CREATE,
            label="Creation Super Root",
            required_phrase="SUPER ROOT",
            severity="critical",
        ),
        ACTION_SUPER_ROOT_ELEVATE: CriticalAction(
            code=ACTION_SUPER_ROOT_ELEVATE,
            label="Elevation Super Root",
            required_phrase="SUPER ROOT",
            severity="critical",
        ),
        ACTION_ROLES_PERMISSIONS_UPDATE: CriticalAction(
            code=ACTION_ROLES_PERMISSIONS_UPDATE,
            label="Modification roles / permissions",
        ),
        ACTION_PLATFORM_SUSPEND: CriticalAction(
            code=ACTION_PLATFORM_SUSPEND,
            label="Suspension plateforme",
        ),
        ACTION_HOTEL_SUSPEND: CriticalAction(
            code=ACTION_HOTEL_SUSPEND,
            label="Suspension hotel",
        ),
        ACTION_GLOBAL_LICENSE_CHANGE: CriticalAction(
            code=ACTION_GLOBAL_LICENSE_CHANGE,
            label="Changement licence globale",
        ),
        ACTION_MFA_DISABLE: CriticalAction(
            code=ACTION_MFA_DISABLE,
            label="Desactivation MFA",
            required_phrase="DESACTIVER MFA",
            severity="critical",
        ),
        ACTION_SESSION_REVOKE: CriticalAction(
            code=ACTION_SESSION_REVOKE,
            label="Revocation session Super Root",
        ),
    }

    @classmethod
    def is_super_root(cls, user):
        return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "is_super_root", False))

    @classmethod
    def require_super_root(cls, user):
        if not cls.is_super_root(user):
            raise PermissionDenied("Seul le Super Root technique peut effectuer cette action.")
        return True

    @classmethod
    def mfa_required(cls, user):
        """Super Root always requires MFA, even if the user flag is disabled."""
        return cls.is_super_root(user)

    @classmethod
    def session_age_seconds(cls):
        return int(getattr(settings, cls.SESSION_AGE_SETTING, cls.DEFAULT_SESSION_AGE_SECONDS))

    @classmethod
    def apply_short_session(cls, request):
        """Apply the Super Root session TTL to Django sessions when present."""
        if hasattr(request, "session"):
            request.session.set_expiry(cls.session_age_seconds())

    @classmethod
    def is_critical_action(cls, action):
        return action in cls.CRITICAL_ACTIONS

    @classmethod
    def get_critical_action(cls, action):
        return cls.CRITICAL_ACTIONS.get(action)

    @classmethod
    def active_super_root_count(cls, *, exclude_user=None):
        queryset = User.objects.filter(is_superuser=True, is_platform_admin=False, is_active=True)
        if exclude_user is not None and getattr(exclude_user, "pk", None):
            queryset = queryset.exclude(pk=exclude_user.pk)
        return queryset.count()

    @classmethod
    def values_would_be_super_root(cls, target_user=None, values=None):
        values = values or {}
        is_superuser = values.get("is_superuser", getattr(target_user, "is_superuser", False))
        is_platform_admin = values.get("is_platform_admin", getattr(target_user, "is_platform_admin", False))
        is_active = values.get("is_active", getattr(target_user, "is_active", True))
        return bool(is_superuser and not is_platform_admin and is_active)

    @classmethod
    def request_has_recent_super_root_mfa(cls, request=None):
        if request is None:
            return False

        payload = getattr(request, "jwt_payload", None)
        now = int(time.time())
        if payload:
            if payload.get("mfa") != "super_root":
                return False
            issued_at = int(payload.get("mfa_at") or payload.get("iat") or 0)
            return bool(issued_at and now - issued_at <= cls.session_age_seconds())

        session = getattr(request, "session", None)
        if session is not None:
            issued_at = int(session.get("super_root_mfa_at") or 0)
            return bool(issued_at and now - issued_at <= cls.session_age_seconds())
        return False

    @classmethod
    def list_critical_actions(cls):
        return [
            {
                "code": action.code,
                "label": action.label,
                "required_phrase": action.required_phrase,
                "severity": action.severity,
            }
            for action in cls.CRITICAL_ACTIONS.values()
        ]

    @classmethod
    def validate_confirmation(cls, action, confirmation=None):
        policy = cls.get_critical_action(action)
        if not policy:
            return True

        confirmation = confirmation or {}
        if not confirmation.get("confirmed"):
            raise ValidationError("Confirmation obligatoire pour cette action critique.")

        phrase = str(confirmation.get("phrase") or "").strip()
        if phrase != policy.required_phrase:
            raise ValidationError(f"Saisissez '{policy.required_phrase}' pour confirmer cette action.")
        return True

    @classmethod
    def require_confirmation(cls, action, confirmation=None, *, actor=None, request=None, target=None):
        try:
            cls.validate_confirmation(action, confirmation)
        except ValidationError as exc:
            cls.audit_policy_event(
                actor=actor,
                request=request,
                action=f"critical_confirmation.failed.{action}",
                target=target,
                metadata={"errors": exc.messages},
                severity="warning",
            )
            raise
        return True

    @classmethod
    def can_create_or_elevate_super_root(cls, actor, *, target_user=None, confirmation=None, request=None):
        cls.require_super_root(actor)

        existing_count = User.objects.filter(is_superuser=True, is_platform_admin=False, is_active=True).count()
        target_is_existing_super_root = bool(target_user and getattr(target_user, "is_super_root", False))

        if existing_count == 0 or target_is_existing_super_root:
            return True

        bootstrap_allowed = bool(getattr(settings, cls.SUPER_ROOT_BOOTSTRAP_SETTING, False))
        if not bootstrap_allowed:
            cls.audit_policy_event(
                actor=actor,
                request=request,
                action="super_root.create_or_elevate.denied",
                target=target_user,
                metadata={"active_super_roots": existing_count, "bootstrap_allowed": False},
                severity="critical",
            )
            return False

        action = cls.ACTION_SUPER_ROOT_CREATE if target_user is None else cls.ACTION_SUPER_ROOT_ELEVATE
        cls.require_confirmation(action, confirmation, actor=actor, request=request, target=target_user)
        return True

    @classmethod
    def validate_super_root_creation_or_elevation(cls, actor, *, target_user=None, confirmation=None, request=None):
        if not cls.can_create_or_elevate_super_root(
            actor,
            target_user=target_user,
            confirmation=confirmation,
            request=request,
        ):
            raise PermissionDenied("Creation ou elevation Super Root refusee par la politique de securite.")
        return True

    @classmethod
    def validate_user_super_root_mutation(cls, actor, *, target_user=None, values=None, confirmation=None, request=None):
        if not cls.values_would_be_super_root(target_user=target_user, values=values):
            return False

        cls.require_super_root(actor)

        if not cls.request_has_recent_super_root_mfa(request):
            cls.audit_policy_event(
                actor=actor,
                request=request,
                action="super_root.mutation.denied",
                target=target_user,
                metadata={"reason": "recent_mfa_required"},
                severity="critical",
            )
            raise PermissionDenied("MFA Super Root recente requise pour cette mutation.")

        existing_count = cls.active_super_root_count(exclude_user=target_user)
        if existing_count > 0 and not bool(getattr(settings, cls.SUPER_ROOT_BOOTSTRAP_SETTING, False)):
            cls.audit_policy_event(
                actor=actor,
                request=request,
                action="super_root.mutation.denied",
                target=target_user,
                metadata={"reason": "multiple_super_roots_blocked", "active_super_roots": existing_count},
                severity="critical",
            )
            raise PermissionDenied(
                "Un Super Root actif existe deja. Activez temporairement ALLOW_SUPER_ROOT_BOOTSTRAP pour valider cette mutation."
            )

        cls.require_confirmation(
            cls.ACTION_SUPER_ROOT_ELEVATE if target_user is not None else cls.ACTION_SUPER_ROOT_CREATE,
            confirmation,
            actor=actor,
            request=request,
            target=target_user,
        )
        cls.audit_policy_event(
            actor=actor,
            request=request,
            action="super_root.mutation.validated",
            target=target_user,
            metadata={"active_super_roots": existing_count},
            severity="critical",
        )
        return True

    @classmethod
    def allow_validated_super_root_mutation(cls, *, reason="validated_super_root_mutation"):
        return allow_super_root_mutation(reason=reason)

    @classmethod
    def request_metadata(cls, request=None):
        if request is None:
            return {}
        meta = getattr(request, "META", {})
        forwarded_for = meta.get("HTTP_X_FORWARDED_FOR", "")
        ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else meta.get("REMOTE_ADDR", "")
        return {
            "ip_address": ip_address,
            "user_agent": meta.get("HTTP_USER_AGENT", ""),
            "path": getattr(request, "path", ""),
            "method": getattr(request, "method", ""),
            "ts": timezone.now().isoformat(),
        }

    @classmethod
    def audit_policy_event(
        cls,
        *,
        actor=None,
        request=None,
        action,
        target=None,
        metadata=None,
        severity="info",
        description="",
    ):
        payload = {
            **cls.request_metadata(request),
            **(metadata or {}),
        }
        return AuditService.log(
            actor=actor,
            action=action,
            target=target,
            metadata=payload,
            severity=severity,
            module="super_root_security",
            description=description or f"Politique Super Root: {action}",
            request=request,
        )


is_super_root = SuperRootSecurityPolicyService.is_super_root
require_super_root = SuperRootSecurityPolicyService.require_super_root
