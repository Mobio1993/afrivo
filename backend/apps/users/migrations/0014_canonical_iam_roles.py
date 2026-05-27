from django.db import migrations, models


IAM_ROLE_CHOICES = [
    ("SUPER_ROOT", "Super Root"),
    ("SUPER_ADMIN_PLATFORM", "Super Admin Plateforme"),
    ("PLATFORM_ADMIN", "Admin Plateforme"),
    ("ORGANIZATION_OWNER", "Proprietaire Organisation"),
    ("ORGANIZATION_ADMIN", "Admin Organisation"),
    ("HOTEL_ADMIN", "Admin Hotel"),
    ("HOTEL_MANAGER", "Manager Hotel"),
    ("RECEPTIONIST", "Receptionniste"),
    ("ACCOUNTANT", "Comptable"),
    ("STAFF", "Personnel"),
    ("HOUSEKEEPING", "Housekeeping"),
    ("CLIENT", "Client"),
]

ROLE_LABELS = dict(IAM_ROLE_CHOICES)

ROLE_PERMISSION_CODES = {
    "SUPER_ROOT": ("*.*",),
    "SUPER_ADMIN_PLATFORM": ("*.*",),
    "PLATFORM_ADMIN": (
        "platform_organizations.read",
        "platform_organizations.create",
        "platform_organizations.update",
        "platform_hotels.read",
        "platform_hotels.create",
        "platform_hotels.update",
        "platform_modules.read",
        "platform_licenses.read",
        "platform_subscriptions.read",
        "platform_subscriptions.create",
        "platform_subscriptions.update",
        "platform_users.read",
        "platform_security.read",
    ),
    "ORGANIZATION_ADMIN": (
        "dashboard.read",
        "clients.read",
        "rooms.read",
        "operations.read",
        "billing.read",
        "payments.read",
        "reports.read",
        "users.read",
        "users.create",
        "users.update",
        "settings.read",
        "settings.update",
    ),
    "HOTEL_ADMIN": (
        "dashboard.read",
        "clients.manage",
        "rooms.manage",
        "operations.manage",
        "billing.manage",
        "payments.manage",
        "reports.manage",
        "history.manage",
        "users.manage",
        "settings.manage",
        "satisfaction.manage",
    ),
    "HOTEL_MANAGER": (
        "dashboard.read",
        "clients.read",
        "clients.create",
        "clients.update",
        "rooms.manage",
        "operations.manage",
        "billing.read",
        "payments.read",
        "reports.read",
        "satisfaction.read",
    ),
    "RECEPTIONIST": (
        "dashboard.read",
        "clients.read",
        "clients.create",
        "clients.update",
        "rooms.read",
        "operations.read",
        "operations.create",
        "operations.update",
        "payments.read",
        "payments.create",
        "payments.update",
        "reports.read",
        "satisfaction.read",
    ),
    "ACCOUNTANT": (
        "dashboard.read",
        "clients.read",
        "rooms.read",
        "operations.read",
        "billing.read",
        "billing.create",
        "billing.update",
        "payments.read",
        "payments.create",
        "payments.update",
        "reports.read",
    ),
    "STAFF": (
        "dashboard.read",
        "rooms.read",
        "rooms.update",
        "operations.read",
    ),
    "HOUSEKEEPING": (
        "dashboard.read",
        "rooms.read",
        "rooms.update",
        "operations.read",
    ),
}


def seed_canonical_iam_roles(apps, schema_editor):
    IAMRole = apps.get_model("users", "IAMRole")
    IAMPermission = apps.get_model("users", "IAMPermission")
    IAMRolePermission = apps.get_model("users", "IAMRolePermission")

    for code, name in ROLE_LABELS.items():
        IAMRole.objects.update_or_create(
            code=code,
            defaults={"name": name, "is_system": True, "is_active": True},
        )

    permission_codes = sorted({code for codes in ROLE_PERMISSION_CODES.values() for code in codes})
    permissions = {}
    for code in permission_codes:
        module_code, action = code.split(".", 1)
        permissions[code], _ = IAMPermission.objects.update_or_create(
            code=code,
            defaults={"module_code": module_code, "action": action, "is_active": True},
        )

    for role_code, codes in ROLE_PERMISSION_CODES.items():
        role = IAMRole.objects.get(code=role_code)
        for code in codes:
            IAMRolePermission.objects.get_or_create(role=role, permission=permissions[code])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0013_platform_admin_role_choice"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userhotelrole",
            name="role_code",
            field=models.CharField(choices=IAM_ROLE_CHOICES, max_length=40),
        ),
        migrations.AlterField(
            model_name="userorganizationrole",
            name="role_code",
            field=models.CharField(choices=IAM_ROLE_CHOICES, max_length=40),
        ),
        migrations.RunPython(seed_canonical_iam_roles, migrations.RunPython.noop),
    ]
