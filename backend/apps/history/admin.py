from django.contrib import admin

from apps.history.models import ActivityLog, HistoryEntry


@admin.register(HistoryEntry)
class HistoryEntryAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "hotel",
        "action_type",
        "module",
        "entity_type",
        "entity_reference",
        "actor",
    )
    list_filter = ("hotel", "action_type", "module", "created_at")
    search_fields = (
        "entity_reference",
        "entity_type",
        "description",
        "actor__username",
        "actor__first_name",
        "actor__last_name",
    )
    readonly_fields = (
        "actor",
        "hotel",
        "action_type",
        "module",
        "entity_type",
        "entity_reference",
        "description",
        "metadata",
        "created_at",
    )
    ordering = ("-created_at",)
    save_on_top = True


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "hotel",
        "user",
        "user_role",
        "module",
        "action",
        "severity",
        "integrity_hash",
        "object_type",
        "object_reference",
    )
    list_filter = ("hotel", "module", "action", "severity", "user_role", "created_at")
    search_fields = (
        "description",
        "object_type",
        "object_id",
        "object_reference",
        "user__username",
        "user__first_name",
        "user__last_name",
        "hotel__name",
        "ip_address",
    )
    readonly_fields = (
        "hotel",
        "user",
        "user_role",
        "action",
        "module",
        "object_type",
        "object_id",
        "object_reference",
        "description",
        "old_values",
        "new_values",
        "metadata",
        "ip_address",
        "user_agent",
        "severity",
        "session_key",
        "previous_integrity_hash",
        "integrity_hash",
        "created_at",
    )
    ordering = ("-created_at",)
    save_on_top = True
