from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from apps.rooms.models import Room, RoomHousekeepingTask, RoomMaintenanceIncident, RoomRateRule, RoomType
from apps.users.models import User


class AdminOnlyInventoryMixin:
    def _is_inventory_admin(self, request):
        return request.user.is_superuser or getattr(request.user, "role", None) in {User.Role.ADMIN, User.Role.MANAGER}

    def has_module_permission(self, request):
        return self._is_inventory_admin(request)

    def has_view_permission(self, request, obj=None):
        return self._is_inventory_admin(request)

    def has_add_permission(self, request):
        return self._is_inventory_admin(request)

    def has_change_permission(self, request, obj=None):
        return self._is_inventory_admin(request)

    def has_delete_permission(self, request, obj=None):
        return self._is_inventory_admin(request)


@admin.action(description="Marquer le nettoyage comme termine")
def complete_cleaning_action(modeladmin, request, queryset):
    completed = 0
    for room in queryset:
        try:
            room.complete_cleaning()
            completed += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Chambre {room.number}: {exc}",
                level=messages.ERROR,
            )

    if completed:
        modeladmin.message_user(
            request,
            f"{completed} chambre(s) remises disponibles avec succes.",
            level=messages.SUCCESS,
        )


@admin.register(RoomType)
class RoomTypeAdmin(AdminOnlyInventoryMixin, admin.ModelAdmin):
    list_display = (
        "hotel",
        "name",
        "code",
        "capacity",
        "base_price_per_night",
        "base_price_day_use",
        "is_day_use_available",
        "is_active",
    )
    list_filter = ("hotel", "is_active", "is_day_use_available")
    search_fields = ("name", "code", "hotel__name", "hotel__code")
    ordering = ("name",)
    readonly_fields = ("created_at", "updated_at")
    save_on_top = True
    fieldsets = (
        ("Definition", {"fields": ("hotel", "name", "code", "description")}),
        ("Capacite", {"fields": ("capacity", "max_adults", "max_children")}),
        ("Tarification", {"fields": ("base_price_per_night", "base_price_day_use", "pricing_policy_notes", "is_day_use_available")}),
        ("Experience", {"fields": ("amenities", "image_urls")}),
        ("Suivi", {"fields": ("is_active", "created_at", "updated_at")}),
    )


@admin.register(Room)
class RoomAdmin(AdminOnlyInventoryMixin, admin.ModelAdmin):
    list_display = (
        "hotel",
        "number",
        "room_code",
        "room_type",
        "floor",
        "status",
        "is_vip_preferred",
        "is_active",
    )
    list_filter = ("hotel", "status", "is_active", "room_type", "is_vip_preferred")
    search_fields = ("number", "room_code", "room_type__name", "room_type__code", "hotel__name", "hotel__code")
    ordering = ("number",)
    readonly_fields = ("created_at", "updated_at", "room_code", "last_cleaned_at", "last_inspected_at")
    autocomplete_fields = ("hotel", "room_type")
    actions = (complete_cleaning_action,)
    save_on_top = True
    fieldsets = (
        ("Chambre", {"fields": ("hotel", "number", "room_code", "room_type", "floor")}),
        (
            "Exploitation",
            {
                "fields": (
                    "status",
                    "custom_price_per_night",
                    "custom_price_day_use",
                    "is_vip_preferred",
                    "is_active",
                    "notes",
                ),
            },
        ),
        ("Suivi", {"fields": ("last_cleaned_at", "last_inspected_at", "created_at", "updated_at")}),
    )


@admin.register(RoomRateRule)
class RoomRateRuleAdmin(AdminOnlyInventoryMixin, admin.ModelAdmin):
    list_display = ("hotel", "name", "room_type", "rule_type", "applies_to", "adjustment_mode", "adjustment_value", "priority", "is_active")
    list_filter = ("hotel", "rule_type", "applies_to", "is_active")
    search_fields = ("name", "room_type__name", "room_type__code")
    autocomplete_fields = ("hotel", "room_type")


@admin.register(RoomHousekeepingTask)
class RoomHousekeepingTaskAdmin(AdminOnlyInventoryMixin, admin.ModelAdmin):
    list_display = ("hotel", "room", "task_type", "status", "priority", "assigned_to", "requested_at")
    list_filter = ("hotel", "task_type", "status", "priority")
    search_fields = ("room__number", "notes", "issue_reported")
    autocomplete_fields = ("hotel", "room", "assigned_to")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RoomMaintenanceIncident)
class RoomMaintenanceIncidentAdmin(AdminOnlyInventoryMixin, admin.ModelAdmin):
    list_display = ("hotel", "room", "title", "severity", "status", "marks_room_out_of_service", "reported_at")
    list_filter = ("hotel", "severity", "status", "marks_room_out_of_service")
    search_fields = ("room__number", "title", "description", "resolution_notes")
    autocomplete_fields = ("hotel", "room", "reported_by", "assigned_to")
    readonly_fields = ("created_at", "updated_at")
