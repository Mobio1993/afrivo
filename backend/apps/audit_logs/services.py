import logging

from django.utils import timezone

from apps.history.models import ActivityLog, HistoryEntry
from apps.history.services import log_activity, log_history
from apps.platform_admin.models import PlatformAuditEvent


pos_logger = logging.getLogger("pos_audit")


def _platform_target_metadata(target=None, *, target_type="", target_id=None, target_label=""):
    resolved_target_type = target_type or (target.__class__.__name__ if target is not None else "")
    resolved_target_id = target_id if target_id is not None else getattr(target, "pk", None)
    resolved_target_label = target_label or str(target or resolved_target_type or "")
    return resolved_target_type, resolved_target_id, resolved_target_label


class AuditLogService:
    """Unified audit facade.

    Storage remains split by domain for compatibility:
    - hotel/business activity -> ActivityLog
    - platform actions -> PlatformAuditEvent
    - POS actions -> structured logger plus optional ActivityLog bridge
    """

    @staticmethod
    def log_activity(
        *,
        request=None,
        action=ActivityLog.Action.OTHER,
        module,
        object_type="",
        object_id="",
        object_reference="",
        description,
        old_values=None,
        new_values=None,
        severity=ActivityLog.Severity.INFO,
        user=None,
        hotel=None,
        metadata=None,
    ):
        return log_activity(
            request=request,
            user=user,
            hotel=hotel,
            action=action,
            module=module,
            object_type=object_type,
            object_id=object_id,
            object_reference=object_reference,
            description=description,
            old_values=old_values,
            new_values=new_values,
            severity=severity,
            metadata=metadata,
        )

    @staticmethod
    def log_history(
        *,
        action_type,
        module,
        entity_type,
        entity_reference,
        description,
        actor=None,
        metadata=None,
        hotel=None,
        request=None,
    ):
        return log_history(
            action_type=action_type,
            module=module,
            entity_type=entity_type,
            entity_reference=entity_reference,
            description=description,
            actor=actor,
            metadata=metadata,
            hotel=hotel,
            request=request,
        )

    @staticmethod
    def log_platform_event(
        *,
        event_type,
        actor=None,
        target=None,
        target_type="",
        target_id=None,
        target_label="",
        metadata=None,
    ):
        resolved_target_type, resolved_target_id, resolved_target_label = _platform_target_metadata(
            target,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label,
        )
        return PlatformAuditEvent.objects.create(
            actor=actor,
            event_type=event_type,
            target_type=resolved_target_type,
            target_id=resolved_target_id,
            target_label=resolved_target_label,
            metadata=metadata or {},
        )

    @staticmethod
    def log(actor=None, action=None, target=None, metadata=None, severity="info", *, request=None, module="audit", description=""):
        """Generic sensitive-event entry point for new code."""
        metadata = metadata or {}
        action_value = str(action or "event")
        target_type = target.__class__.__name__ if target is not None else ""
        target_id = getattr(target, "pk", None) if target is not None else None
        target_label = str(target or "")

        if module.startswith("platform"):
            return AuditLogService.log_platform_event(
                event_type=action_value,
                actor=actor,
                target=target,
                target_type=target_type,
                target_id=target_id,
                target_label=target_label,
                metadata=metadata,
            )

        if module == "pos_restaurant":
            return AuditLogService.log_pos_event(actor, action_value, metadata, request=request)

        severity_value = getattr(ActivityLog.Severity, str(severity or "INFO").upper(), ActivityLog.Severity.INFO)
        return AuditLogService.log_activity(
            request=request,
            user=actor,
            hotel=getattr(target, "hotel", None) or getattr(actor, "hotel", None),
            action=action_value if action_value in ActivityLog.Action.values else ActivityLog.Action.OTHER,
            module=module,
            object_type=target_type,
            object_id=target_id,
            object_reference=target_label,
            description=description or f"{module}: {action_value}",
            severity=severity_value,
            metadata=metadata,
        )

    @staticmethod
    def log_pos_event(user, action, data=None, *, request=None, hotel=None, restaurant=None):
        payload = {
            "user": user.username if user else "system",
            "action": action,
            "data": data or {},
            "ts": timezone.now().isoformat(),
        }
        pos_logger.info(payload)

        resolved_hotel = hotel or getattr(restaurant, "hotel", None) or getattr(user, "hotel", None)
        if not user and request is None:
            return None

        try:
            return log_activity(
                request=request,
                user=user,
                hotel=resolved_hotel,
                action=ActivityLog.Action.OTHER,
                module="pos_restaurant",
                object_type="PosAuditEvent",
                object_reference=str(action or ""),
                description=f"POS Restaurant: {action}",
                severity=ActivityLog.Severity.INFO,
                metadata=payload,
            )
        except Exception:
            pos_logger.exception("Unable to bridge POS audit event to ActivityLog.")
            return None

    @staticmethod
    def verify_activity_integrity(limit=None):
        queryset = ActivityLog.objects.order_by("created_at", "id")
        if limit:
            queryset = queryset[:limit]
        invalid_ids = []
        previous_hash = ""
        checked = 0
        for log in queryset:
            checked += 1
            if not log.integrity_hash or not log.verify_integrity() or log.previous_integrity_hash != previous_hash:
                invalid_ids.append(log.id)
            previous_hash = log.integrity_hash
        return {
            "checked": checked,
            "invalid_count": len(invalid_ids),
            "invalid_ids": invalid_ids,
            "latest_hash": previous_hash,
        }


class HotelAuditService:
    log = staticmethod(AuditLogService.log_activity)
    log_history = staticmethod(AuditLogService.log_history)
    verify_integrity = staticmethod(AuditLogService.verify_activity_integrity)


class PlatformAuditService:
    log = staticmethod(AuditLogService.log_platform_event)


class PosAuditService:
    log = staticmethod(AuditLogService.log_pos_event)


class AuditService:
    log = staticmethod(AuditLogService.log)
    log_activity = staticmethod(AuditLogService.log_activity)
    log_history = staticmethod(AuditLogService.log_history)
    log_platform_event = staticmethod(AuditLogService.log_platform_event)
    log_pos_event = staticmethod(AuditLogService.log_pos_event)


__all__ = [
    "ActivityLog",
    "AuditService",
    "AuditLogService",
    "HistoryEntry",
    "HotelAuditService",
    "PlatformAuditEvent",
    "PlatformAuditService",
    "PosAuditService",
]
