from django.contrib import admin

from apps.history.models import HistoryEntry


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
