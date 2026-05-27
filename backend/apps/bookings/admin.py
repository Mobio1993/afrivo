from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from apps.bookings.models import Booking, DayUse
from apps.stays.models import Stay


@admin.action(description="Effectuer le check-in des reservations selectionnees")
def perform_check_in(modeladmin, request, queryset):
    created = 0
    for booking in queryset.select_related("guest", "room", "room_type"):
        try:
            Stay.create_from_booking(booking)
            created += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Reservation {booking.reference}: {exc}",
                level=messages.ERROR,
            )

    if created:
        modeladmin.message_user(
            request,
            f"{created} sejour(s) cree(s) avec succes.",
            level=messages.SUCCESS,
        )


@admin.action(description="Marquer no-show les reservations selectionnees")
def mark_no_show(modeladmin, request, queryset):
    updated = 0
    for booking in queryset.select_related("guest", "room", "room_type"):
        try:
            booking.mark_no_show(actor=request.user)
            updated += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Reservation {booking.reference}: {exc}",
                level=messages.ERROR,
            )

    if updated:
        modeladmin.message_user(
            request,
            f"{updated} reservation(s) marquee(s) no-show avec succes.",
            level=messages.SUCCESS,
        )


@admin.action(description="Effectuer l'entree day use des elements selectionnes")
def perform_day_use_check_in(modeladmin, request, queryset):
    updated = 0
    for day_use in queryset.select_related("guest", "room"):
        try:
            day_use.perform_check_in()
            updated += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Day use {day_use.reference}: {exc}",
                level=messages.ERROR,
            )

    if updated:
        modeladmin.message_user(
            request,
            f"{updated} day use(s) passes en entree avec succes.",
            level=messages.SUCCESS,
        )


@admin.action(description="Effectuer la sortie day use des elements selectionnes")
def perform_day_use_check_out(modeladmin, request, queryset):
    updated = 0
    for day_use in queryset.select_related("guest", "room"):
        try:
            day_use.perform_check_out()
            updated += 1
        except ValidationError as exc:
            modeladmin.message_user(
                request,
                f"Day use {day_use.reference}: {exc}",
                level=messages.ERROR,
            )

    if updated:
        modeladmin.message_user(
            request,
            f"{updated} day use(s) clotures avec succes.",
            level=messages.SUCCESS,
        )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "guest",
        "room_type",
        "room",
        "status",
        "check_in_date",
        "check_out_date",
        "estimated_amount",
    )
    list_filter = ("hotel", "status", "source", "room_type", "check_in_date", "check_out_date")
    search_fields = (
        "reference",
        "hotel__name",
        "hotel__code",
        "guest__first_name",
        "guest__last_name",
        "guest__phone",
        "room__number",
    )
    autocomplete_fields = ("hotel", "guest", "room_type", "room")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    actions = (perform_check_in, mark_no_show)
    save_on_top = True
    fieldsets = (
        (
            "Reservation",
            {
                "fields": (
                    "hotel",
                    "reference",
                    "status",
                    "source",
                ),
            },
        ),
        (
            "Client et hebergement",
            {
                "fields": (
                    "guest",
                    "room_type",
                    "room",
                ),
            },
        ),
        (
            "Sejour prevu",
            {
                "fields": (
                    "check_in_date",
                    "check_out_date",
                    "adults",
                    "children",
                    "estimated_amount",
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

    def get_changeform_initial_data(self, request):
        return {"reference": Booking.generate_reference()}


@admin.register(DayUse)
class DayUseAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "guest",
        "room",
        "status",
        "planned_entry_at",
        "check_in_at",
        "check_out_at",
        "total_amount",
        "paid_amount_display",
    )
    list_filter = ("hotel", "status", "overtime_choice", "planned_entry_at", "room__room_type")
    search_fields = (
        "reference",
        "hotel__name",
        "hotel__code",
        "guest__first_name",
        "guest__last_name",
        "guest__phone",
        "room__number",
    )
    autocomplete_fields = ("hotel", "guest", "room")
    readonly_fields = ("total_amount", "created_at", "updated_at")
    ordering = ("-created_at",)
    actions = (perform_day_use_check_in, perform_day_use_check_out)
    save_on_top = True
    fieldsets = (
        (
            "Day use",
            {
                "fields": (
                    "hotel",
                    "reference",
                    "status",
                    "guest",
                    "room",
                ),
            },
        ),
        (
            "Tarification",
            {
                "fields": (
                    "package_price",
                    "overtime_choice",
                    "overtime_fee",
                    "total_amount",
                ),
            },
        ),
        (
            "Exploitation",
            {
                "fields": (
                    "planned_entry_at",
                    "check_in_at",
                    "check_out_at",
                    "notes",
                ),
            },
        ),
        (
            "Suivi",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def get_changeform_initial_data(self, request):
        return {"reference": DayUse.generate_reference()}

    @admin.display(description="Montant paye")
    def paid_amount_display(self, obj):
        return obj.paid_amount
