import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


def populate_user_public_ids(apps, schema_editor):
    User = apps.get_model("users", "User")
    for user in User.objects.filter(public_id__isnull=True):
        user.public_id = uuid.uuid4()
        user.save(update_fields=["public_id"])


def seed_iam_roles_and_permissions(apps, schema_editor):
    IAMRole = apps.get_model("users", "IAMRole")
    IAMPermission = apps.get_model("users", "IAMPermission")
    IAMRolePermission = apps.get_model("users", "IAMRolePermission")

    role_labels = {
        "SUPER_ROOT": "Super Root",
        "SUPER_ADMIN_PLATFORM": "Super Admin Plateforme",
        "PLATFORM_ADMIN": "Admin Plateforme",
        "ORGANIZATION_OWNER": "Proprietaire Organisation",
        "ORGANIZATION_ADMIN": "Admin Organisation",
        "HOTEL_ADMIN": "Admin Hotel",
        "RECEPTIONIST": "Receptionniste",
        "ACCOUNTANT": "Comptable",
        "HOUSEKEEPING": "Housekeeping",
        "CLIENT": "Client",
    }
    for code, name in role_labels.items():
        IAMRole.objects.get_or_create(code=code, defaults={"name": name, "is_system": True})

    permission_codes = [
        "users.create",
        "users.read",
        "users.update",
        "users.delete",
        "hotels.create",
        "hotels.read",
        "hotels.update",
        "modules.activate",
        "modules.read",
        "licenses.manage",
        "dayuse.create",
        "dayuse.read",
        "reservations.manage",
        "settings.manage",
        "audit.read",
    ]
    permissions = {}
    for code in permission_codes:
        module_code, action = code.split(".", 1)
        permissions[code], _ = IAMPermission.objects.get_or_create(
            code=code,
            defaults={"module_code": module_code, "action": action},
        )

    for role_code in ("SUPER_ROOT", "SUPER_ADMIN_PLATFORM"):
        role = IAMRole.objects.get(code=role_code)
        for permission in permissions.values():
            IAMRolePermission.objects.get_or_create(role=role, permission=permission)


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0006_organization_status"),
        ("users", "0010_user_platform_role_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="public_id",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified",
            field=models.BooleanField(default=False, verbose_name="Email verifie"),
        ),
        migrations.AddField(
            model_name="user",
            name="phone_verified",
            field=models.BooleanField(default=False, verbose_name="Telephone verifie"),
        ),
        migrations.AddField(
            model_name="user",
            name="failed_login_attempts",
            field=models.PositiveSmallIntegerField(default=0, verbose_name="Tentatives echouees"),
        ),
        migrations.AddField(
            model_name="user",
            name="locked_until",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Verrouille jusqu'au"),
        ),
        migrations.RunPython(populate_user_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="uniq_user_email_ci_nonblank",
            ),
        ),
        migrations.CreateModel(
            name="IAMPermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=120, unique=True, verbose_name="Code")),
                ("module_code", models.CharField(blank=True, max_length=80, verbose_name="Module")),
                ("action", models.CharField(blank=True, max_length=40, verbose_name="Action")),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                ("is_active", models.BooleanField(default=True, verbose_name="Active")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Creee le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mise a jour le")),
            ],
            options={
                "verbose_name": "Permission IAM",
                "verbose_name_plural": "Permissions IAM",
                "ordering": ["code"],
            },
        ),
        migrations.CreateModel(
            name="IAMRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=80, unique=True, verbose_name="Code")),
                ("name", models.CharField(max_length=120, verbose_name="Nom")),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                ("is_system", models.BooleanField(default=True, verbose_name="Role systeme")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
            ],
            options={
                "verbose_name": "Role IAM",
                "verbose_name_plural": "Roles IAM",
                "ordering": ["code"],
            },
        ),
        migrations.CreateModel(
            name="UserSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("refresh_token_jti", models.CharField(max_length=80, unique=True, verbose_name="JTI refresh")),
                ("device_name", models.CharField(blank=True, max_length=120, verbose_name="Appareil")),
                ("browser", models.CharField(blank=True, max_length=120, verbose_name="Navigateur")),
                ("os", models.CharField(blank=True, max_length=120, verbose_name="Systeme")),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True, verbose_name="Adresse IP")),
                ("user_agent", models.TextField(blank=True, verbose_name="User-Agent")),
                ("last_activity", models.DateTimeField(default=timezone.now, verbose_name="Derniere activite")),
                ("is_active", models.BooleanField(default=True, verbose_name="Active")),
                ("revoked_at", models.DateTimeField(blank=True, null=True, verbose_name="Revoquee le")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Creee le")),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sessions", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "verbose_name": "Session utilisateur",
                "verbose_name_plural": "Sessions utilisateurs",
                "ordering": ["-last_activity", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="IAMRolePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "permission",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_permissions", to="users.iampermission"),
                ),
                ("role", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_permissions", to="users.iamrole")),
            ],
            options={
                "verbose_name": "Permission de role IAM",
                "verbose_name_plural": "Permissions de roles IAM",
            },
        ),
        migrations.CreateModel(
            name="UserHotelRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role_code",
                    models.CharField(
                        choices=[
                            ("SUPER_ROOT", "Super Root"),
                            ("SUPER_ADMIN_PLATFORM", "Super Admin Plateforme"),
                            ("PLATFORM_ADMIN", "Admin Plateforme"),
                            ("ORGANIZATION_OWNER", "Proprietaire Organisation"),
                            ("ORGANIZATION_ADMIN", "Admin Organisation"),
                            ("HOTEL_ADMIN", "Admin Hotel"),
                            ("RECEPTIONIST", "Receptionniste"),
                            ("ACCOUNTANT", "Comptable"),
                            ("HOUSEKEEPING", "Housekeeping"),
                            ("CLIENT", "Client"),
                        ],
                        max_length=40,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "hotel",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_roles", to="tenancy.hotel"),
                ),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hotel_roles", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Role utilisateur hotel",
                "verbose_name_plural": "Roles utilisateurs hotels",
            },
        ),
        migrations.CreateModel(
            name="UserOrganizationRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role_code",
                    models.CharField(
                        choices=[
                            ("SUPER_ROOT", "Super Root"),
                            ("SUPER_ADMIN_PLATFORM", "Super Admin Plateforme"),
                            ("PLATFORM_ADMIN", "Admin Plateforme"),
                            ("ORGANIZATION_OWNER", "Proprietaire Organisation"),
                            ("ORGANIZATION_ADMIN", "Admin Organisation"),
                            ("HOTEL_ADMIN", "Admin Hotel"),
                            ("RECEPTIONIST", "Receptionniste"),
                            ("ACCOUNTANT", "Comptable"),
                            ("HOUSEKEEPING", "Housekeeping"),
                            ("CLIENT", "Client"),
                        ],
                        max_length=40,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_roles", to="tenancy.organization"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="organization_roles", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "verbose_name": "Role utilisateur organisation",
                "verbose_name_plural": "Roles utilisateurs organisations",
            },
        ),
        migrations.CreateModel(
            name="UserPermissionOverride",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_allowed", models.BooleanField(default=True, verbose_name="Autorise")),
                ("reason", models.CharField(blank=True, max_length=255, verbose_name="Motif")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "permission",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_overrides", to="users.iampermission"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="iam_permission_overrides", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "verbose_name": "Override permission utilisateur",
                "verbose_name_plural": "Overrides permissions utilisateurs",
            },
        ),
        migrations.AddIndex(
            model_name="usersession",
            index=models.Index(fields=["user", "is_active"], name="user_session_active_idx"),
        ),
        migrations.AddIndex(
            model_name="usersession",
            index=models.Index(fields=["refresh_token_jti"], name="user_session_jti_idx"),
        ),
        migrations.AddConstraint(
            model_name="iamrolepermission",
            constraint=models.UniqueConstraint(fields=("role", "permission"), name="uniq_iam_role_permission"),
        ),
        migrations.AddConstraint(
            model_name="userhotelrole",
            constraint=models.UniqueConstraint(fields=("user", "hotel", "role_code"), name="uniq_user_hotel_role"),
        ),
        migrations.AddConstraint(
            model_name="userorganizationrole",
            constraint=models.UniqueConstraint(fields=("user", "organization", "role_code"), name="uniq_user_org_role"),
        ),
        migrations.AddConstraint(
            model_name="userpermissionoverride",
            constraint=models.UniqueConstraint(fields=("user", "permission"), name="uniq_user_permission_override"),
        ),
        migrations.RunPython(seed_iam_roles_and_permissions, migrations.RunPython.noop),
    ]
