from apps.history.models import ActivityLog
from apps.audit_logs.services import AuditLogService


class IamAuditLogger:
    """Audit facade for IAM events.

    ActivityLog remains the current storage engine. This wrapper gives Phase 2+
    a stable API before any storage consolidation.
    """

    @staticmethod
    def log(request=None, *, user=None, action=None, description="", target_user=None, metadata=None, severity=None):
        actor = user or getattr(request, "user", None)
        target = target_user or actor
        return AuditLogService.log_activity(
            request=request,
            user=actor,
            hotel=getattr(target, "hotel", None) if target is not None else None,
            action=action or ActivityLog.Action.OTHER,
            module="iam",
            object_type="User" if target is not None else "",
            object_id=getattr(target, "id", "") or "",
            object_reference=getattr(target, "username", "") or "",
            description=description,
            severity=severity or ActivityLog.Severity.INFO,
            metadata=metadata or {},
        )


iam_audit_logger = IamAuditLogger()
