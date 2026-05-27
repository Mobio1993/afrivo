from django.contrib import admin

from apps.tenancy.models import Hotel, HotelSettings, Organization


class HotelSettingsInline(admin.StackedInline):
    model = HotelSettings
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    ordering = ("name",)


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "slug", "currency", "timezone", "is_active")
    list_filter = ("organization", "is_active", "currency")
    search_fields = ("name", "code", "slug", "organization__name")
    ordering = ("organization__name", "name")
    inlines = [HotelSettingsInline]


@admin.register(HotelSettings)
class HotelSettingsAdmin(admin.ModelAdmin):
    list_display = ("hotel", "hotel_name_display", "currency", "timezone", "checkin_time", "checkout_time", "enable_activity_log")
    list_filter = ("currency", "no_show_policy", "cancellation_policy", "enable_activity_log", "satisfaction_enabled")
    search_fields = ("hotel__name", "hotel__code", "hotel__organization__name")
