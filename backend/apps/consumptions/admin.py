from django.contrib import admin

from apps.consumptions.models import ClientConsumption, ClientConsumptionItem, ServiceDepartment


class ClientConsumptionItemInline(admin.TabularInline):
    model = ClientConsumptionItem
    extra = 0
    fields = ("label", "quantity", "unit_price", "total_amount", "sort_order", "notes")
    readonly_fields = ("total_amount",)


@admin.register(ServiceDepartment)
class ServiceDepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "department_type", "is_active", "updated_at")
    list_filter = ("department_type", "is_active")
    search_fields = ("name", "code", "description")


@admin.register(ClientConsumption)
class ClientConsumptionAdmin(admin.ModelAdmin):
    list_display = (
        "hotel",
        "reference",
        "client",
        "service_department",
        "status",
        "payment_status",
        "total_amount",
        "service_date",
    )
    list_filter = ("hotel", "status", "payment_status", "service_department", "source")
    search_fields = (
        "reference",
        "label",
        "hotel__name",
        "hotel__code",
        "client__first_name",
        "client__last_name",
        "stay__reference",
        "reservation__reference",
        "room__number",
    )
    autocomplete_fields = ("hotel", "client", "stay", "reservation", "room", "service_department", "created_by")
    readonly_fields = ("reference", "total_amount", "billed_at", "created_at", "updated_at")
    inlines = [ClientConsumptionItemInline]
