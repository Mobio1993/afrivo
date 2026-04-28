from django.contrib import admin

from apps.billing.models import ClientInvoice, ClientInvoiceItem, Payment


class ClientInvoiceItemInline(admin.TabularInline):
    model = ClientInvoiceItem
    extra = 0
    fields = (
        "consumption",
        "service_department",
        "room",
        "label",
        "quantity",
        "unit_price",
        "line_total",
        "service_date",
        "notes",
    )
    readonly_fields = ("line_total",)
    autocomplete_fields = ("consumption", "service_department", "room")


@admin.register(ClientInvoice)
class ClientInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "client",
        "stay",
        "status",
        "issued_at",
        "total_amount",
        "amount_paid",
        "balance_due",
    )
    list_filter = ("hotel", "status", "currency", "source")
    search_fields = (
        "reference",
        "hotel__name",
        "hotel__code",
        "client__first_name",
        "client__last_name",
        "stay__reference",
        "reservation__reference",
    )
    autocomplete_fields = ("hotel", "client", "stay", "reservation", "issued_by")
    readonly_fields = (
        "reference",
        "subtotal_amount",
        "total_amount",
        "amount_paid",
        "balance_due",
        "created_at",
        "updated_at",
    )
    inlines = [ClientInvoiceItemInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "client",
        "booking",
        "stay",
        "day_use",
        "invoice",
        "payment_type",
        "status",
        "method",
        "amount",
        "paid_at",
    )
    list_filter = ("hotel", "status", "payment_type", "method", "currency", "paid_at")
    search_fields = (
        "reference",
        "hotel__name",
        "hotel__code",
        "client__first_name",
        "client__last_name",
        "booking__reference",
        "stay__reference",
        "day_use__reference",
        "invoice__reference",
        "external_reference",
        "booking__guest__first_name",
        "booking__guest__last_name",
        "stay__guest__first_name",
        "stay__guest__last_name",
        "day_use__guest__first_name",
        "day_use__guest__last_name",
        "invoice__client__first_name",
        "invoice__client__last_name",
    )
    autocomplete_fields = ("hotel", "client", "booking", "stay", "day_use", "invoice", "recorded_by")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-paid_at",)
    save_on_top = True
    fieldsets = (
        (
            "Paiement",
            {
                "fields": (
                    "hotel",
                    "reference",
                    "client",
                    "payment_type",
                    "status",
                    "method",
                    "amount",
                    "paid_at",
                    "currency",
                    "external_reference",
                ),
            },
        ),
        (
            "Rattachement",
            {
                "fields": (
                    "booking",
                    "stay",
                    "day_use",
                    "invoice",
                    "recorded_by",
                    "source",
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
        return {"reference": Payment.generate_reference()}
