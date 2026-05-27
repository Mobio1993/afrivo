from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from apps.stays.models import Stay


@admin.action(description="Effectuer le check-out des sejours selectionnes")
def perform_check_out(modeladmin, request, queryset):
    completed = 0
    for stay in queryset.select_related("room", "guest", "booking"):
        try:
            stay.complete_checkout(actor=request.user)
            completed += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Sejour {stay.reference}: {exc}",
                level=messages.ERROR,
            )

    if completed:
        modeladmin.message_user(
            request,
            f"{completed} sejour(s) cloture(s) avec succes.",
            level=messages.SUCCESS,
        )


@admin.register(Stay)
class StayAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "guest",
        "room",
        "source",
        "status",
        "planned_check_in",
        "check_in_at",
        "check_out_at",
        "expected_check_out_date",
    )
    list_filter = ("hotel", "status", "source", "check_in_at", "expected_check_out_date", "room__room_type")
    search_fields = (
        "reference",
        "hotel__name",
        "hotel__code",
        "guest__first_name",
        "guest__last_name",
        "room__number",
        "booking__reference",
    )
    autocomplete_fields = ("hotel", "booking", "guest", "room", "checked_in_by", "checked_out_by")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-check_in_at",)
    actions = (perform_check_out,)
    save_on_top = True
    fieldsets = (
        (
            "Sejour",
            {
                "fields": (
                    "hotel",
                    "reference",
                    "status",
                    "source",
                    "booking",
                ),
            },
        ),
        (
            "Client et chambre",
            {
                "fields": (
                    "guest",
                    "room",
                ),
            },
        ),
        (
            "Check-in",
            {
                "fields": (
                    "check_in_at",
                    "planned_check_in",
                    "actual_check_in",
                    "check_out_at",
                    "actual_check_out",
                    "expected_check_out_date",
                    "planned_check_out",
                    "number_of_guests",
                    "adults_count",
                    "children_count",
                    "purpose_of_stay",
                    "special_requests",
                    "checked_in_by",
                    "checked_out_by",
                ),
            },
        ),
        (
            "Suivi",
            {
                "fields": (
                    "notes",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )
