from django.contrib import admin

from apps.satisfaction.models import ClientSatisfaction


@admin.register(ClientSatisfaction)
class ClientSatisfactionAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "client",
        "stay",
        "overall_rating",
        "satisfaction_level",
        "recommendation_score",
        "would_recommend",
        "status",
        "submitted_at",
    )
    list_filter = ("satisfaction_level", "status", "source", "would_recommend", "submitted_at")
    search_fields = ("reference", "client__first_name", "client__last_name", "stay__reference", "positive_points", "negative_points")
    autocomplete_fields = ("client", "stay", "consumption", "recorded_by")
    readonly_fields = (
        "reference",
        "client",
        "stay",
        "consumption",
        "recorded_by",
        "overall_rating",
        "satisfaction_level",
        "recommendation_score",
        "would_recommend",
        "reception_rating",
        "room_rating",
        "cleanliness_rating",
        "restaurant_rating",
        "bar_rating",
        "pool_rating",
        "spa_rating",
        "laundry_rating",
        "positive_points",
        "negative_points",
        "suggestions",
        "notes",
        "submitted_at",
        "status",
        "source",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
