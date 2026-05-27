from django.contrib import admin

from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, PlatformLicense, PlatformModule, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "monthly_price", "yearly_price", "max_hotels", "max_users", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    ordering = ("name", "code")


@admin.register(HotelSubscription)
class HotelSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("hotel", "organization", "plan", "status", "billing_cycle", "starts_at", "ends_at")
    list_filter = ("status", "billing_cycle", "plan")
    search_fields = ("hotel__name", "hotel__code", "organization__name", "plan__name")
    autocomplete_fields = ("organization", "hotel", "plan")
    ordering = ("-updated_at", "-id")


@admin.register(PlatformModule)
class PlatformModuleAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "monthly_license_price", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "description")
    ordering = ("name", "code")


@admin.register(PlatformLicense)
class PlatformLicenseAdmin(admin.ModelAdmin):
    list_display = ("module", "organization", "hotel", "status", "starts_at", "ends_at", "monthly_price")
    list_filter = ("status", "module")
    search_fields = ("module__name", "module__code", "organization__name", "hotel__name", "notes")
    autocomplete_fields = ("module", "organization", "hotel")
    ordering = ("-updated_at", "-id")


@admin.register(PlatformAuditEvent)
class PlatformAuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event_type", "target_type", "target_label", "actor")
    list_filter = ("event_type", "target_type")
    search_fields = ("target_label", "target_type", "actor__username", "actor__first_name", "actor__last_name")
    autocomplete_fields = ("actor",)
    ordering = ("-created_at", "-id")
