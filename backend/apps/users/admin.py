from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html

from apps.tenancy.services import assign_default_hotel_to_users
from apps.users.models import (
    IAMPermission,
    IAMRole,
    IAMRolePermission,
    User,
    UserHotelRole,
    UserModulePermission,
    UserOrganizationRole,
    UserPermissionOverride,
    UserSession,
)


class HotelAssignmentFilter(admin.SimpleListFilter):
    title = "Affectation hotel"
    parameter_name = "hotel_assignment"

    def lookups(self, request, model_admin):
        return (
            ("assigned", "Avec hotel"),
            ("missing", "Sans hotel"),
            ("org_only", "Organisation sans hotel"),
        )

    def queryset(self, request, queryset):
        value = self.value()
        if value == "assigned":
            return queryset.filter(hotel__isnull=False)
        if value == "missing":
            return queryset.filter(hotel__isnull=True)
        if value == "org_only":
            return queryset.filter(organization__isnull=False, hotel__isnull=True)
        return queryset


class UserModulePermissionInline(admin.TabularInline):
    model = UserModulePermission
    extra = 0


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "username",
        "public_id",
        "first_name",
        "last_name",
        "email",
        "organization",
        "hotel",
        "tenancy_status",
        "role",
        "is_platform_admin",
        "platform_role",
        "email_verified",
        "phone_verified",
        "failed_login_attempts",
        "locked_until",
        "is_active",
        "is_staff",
    )
    list_filter = (
        "organization",
        "hotel",
        HotelAssignmentFilter,
        "role",
        "is_platform_admin",
        "platform_role",
        "email_verified",
        "phone_verified",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    ordering = ("username",)
    save_on_top = True
    search_fields = DjangoUserAdmin.search_fields + ("organization__name", "hotel__name")
    inlines = (UserModulePermissionInline,)
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Informations hotelieres",
            {
                "fields": (
                    "public_id",
                    "organization",
                    "hotel",
                    "tenancy_status",
                    "role",
                    "is_platform_admin",
                    "platform_role",
                    "phone",
                    "email_verified",
                    "phone_verified",
                    "failed_login_attempts",
                    "locked_until",
                ),
            },
        ),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "Informations hotelieres",
            {
                "fields": ("organization", "hotel", "role", "is_platform_admin", "platform_role", "phone", "first_name", "last_name", "email"),
            },
        ),
    )
    readonly_fields = ("public_id", "tenancy_status")
    actions = ("assign_default_hotel_action",)

    @admin.display(description="Statut tenancy")
    def tenancy_status(self, obj):
        if obj.hotel_id:
            return format_html('<span style="color:#166534;font-weight:700;">Rattache a {}</span>', obj.hotel.name)
        if obj.organization_id:
            return format_html('<span style="color:#b45309;font-weight:700;">Organisation sans hotel</span>')
        return format_html('<span style="color:#b91c1c;font-weight:700;">Sans organisation ni hotel</span>')

    @admin.action(description="Rattacher les utilisateurs selectionnes a l'hotel par defaut")
    def assign_default_hotel_action(self, request, queryset):
        target_queryset = queryset.filter(hotel__isnull=True)
        result = assign_default_hotel_to_users(target_queryset)

        if result["assigned"]:
            self.message_user(
                request,
                (
                    f"{result['assigned']} utilisateur(s) rattache(s) a l'hotel par defaut "
                    f"{result['hotel'].name}."
                ),
                level=messages.SUCCESS,
            )
        if result["skipped"]:
            self.message_user(
                request,
                f"{result['skipped']} utilisateur(s) deja rattache(s) ont ete ignores.",
                level=messages.WARNING,
            )
        if not result["assigned"] and not result["skipped"]:
            self.message_user(
                request,
                "Aucun utilisateur sans hotel n'a ete selectionne.",
                level=messages.INFO,
            )


@admin.register(IAMRole)
class IAMRoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_system", "is_active", "created_at")
    list_filter = ("is_system", "is_active")
    search_fields = ("code", "name")


@admin.register(IAMPermission)
class IAMPermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "module_code", "action", "is_active", "created_at")
    list_filter = ("module_code", "action", "is_active")
    search_fields = ("code", "description")


@admin.register(IAMRolePermission)
class IAMRolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "created_at")
    list_filter = ("role", "permission__module_code")
    search_fields = ("role__code", "permission__code")


@admin.register(UserPermissionOverride)
class UserPermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "is_allowed", "reason", "created_at")
    list_filter = ("is_allowed", "permission__module_code")
    search_fields = ("user__username", "permission__code", "reason")


@admin.register(UserOrganizationRole)
class UserOrganizationRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role_code", "is_active", "created_at")
    list_filter = ("role_code", "is_active", "organization")
    search_fields = ("user__username", "organization__name")


@admin.register(UserHotelRole)
class UserHotelRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "hotel", "role_code", "is_active", "created_at")
    list_filter = ("role_code", "is_active", "hotel")
    search_fields = ("user__username", "hotel__name")


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "device_name", "ip_address", "is_active", "last_activity", "created_at")
    list_filter = ("is_active", "created_at", "last_activity")
    search_fields = ("user__username", "refresh_token_jti", "ip_address", "user_agent")
    readonly_fields = ("refresh_token_jti", "created_at", "last_activity")
