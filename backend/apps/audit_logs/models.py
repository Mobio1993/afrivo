"""Compatibility exports for audit models."""

from apps.history.models import ActivityLog, HistoryEntry
from apps.platform_admin.models import PlatformAuditEvent

__all__ = ["ActivityLog", "HistoryEntry", "PlatformAuditEvent"]

