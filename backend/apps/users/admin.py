from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html

from apps.tenancy.services import assign_default_hotel_to_users
from apps.users.models import User, UserModulePermission


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
        "first_name",
        "last_name",
        "email",
        "organization",
        "hotel",
        "tenancy_status",
        "role",
        "is_platform_admin",
        "is_active",
        "is_staff",
    )
    list_filter = ("organization", "hotel", HotelAssignmentFilter, "role", "is_platform_admin", "is_active", "is_staff", "is_superuser")
    ordering = ("username",)
    save_on_top = True
    search_fields = DjangoUserAdmin.search_fields + ("organization__name", "hotel__name")
    inlines = (UserModulePermissionInline,)
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Informations hotelieres",
            {
                "fields": ("organization", "hotel", "tenancy_status", "role", "is_platform_admin", "phone"),
            },
        ),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "Informations hotelieres",
            {
                "fields": ("organization", "hotel", "role", "is_platform_admin", "phone", "first_name", "last_name", "email"),
            },
        ),
    )
    readonly_fields = ("tenancy_status",)
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
