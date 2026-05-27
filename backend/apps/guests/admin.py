from django.contrib import admin

from apps.guests.models import Guest


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "client_code",
        "last_name",
        "first_name",
        "client_type",
        "phone",
        "secondary_phone",
        "email",
        "identity_document_type",
        "identity_document_number",
        "is_blacklisted",
        "is_active",
    )
    list_filter = (
        "client_type",
        "hotel",
        "identity_document_type",
        "gender",
        "marital_status",
        "is_blacklisted",
        "is_active",
        "nationality",
    )
    search_fields = (
        "first_name",
        "last_name",
        "hotel__name",
        "hotel__code",
        "client_code",
        "phone",
        "secondary_phone",
        "email",
        "identity_document_number",
        "place_of_birth",
        "document_issue_place",
    )
    readonly_fields = ("client_code", "created_at", "updated_at")
    ordering = ("last_name", "first_name")
    save_on_top = True
    fieldsets = (
        (
            "Identite",
            {
                "fields": (
                    "hotel",
                    "client_code",
                    ("client_type", "gender"),
                    ("first_name", "last_name"),
                    ("date_of_birth", "place_of_birth"),
                    "nationality",
                    ("marital_status", "profession"),
                ),
            },
        ),
        (
            "Contact",
            {
                "fields": (
                    ("phone", "secondary_phone"),
                    "email",
                    ("address", "city"),
                ),
            },
        ),
        (
            "Piece d'identite",
            {
                "fields": (
                    ("identity_document_type", "identity_document_number"),
                    ("document_issue_date", "document_expiry_date"),
                    "document_issue_place",
                ),
            },
        ),
        (
            "Urgence",
            {
                "fields": (
                    "emergency_contact_name",
                    ("emergency_contact_phone", "emergency_contact_relationship"),
                ),
            },
        ),
        (
            "Suivi",
            {
                "fields": (
                    "notes",
                    ("is_blacklisted", "is_active"),
                    ("created_at", "updated_at"),
                ),
            },
        ),
    )
