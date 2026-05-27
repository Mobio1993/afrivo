from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_blacklistedtoken_hash_jti"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="platform_role",
            field=models.CharField(
                choices=[
                    ("none", "Aucun"),
                    ("super_admin_platform", "Super Admin Plateforme"),
                    ("platform_admin", "Admin Plateforme"),
                ],
                default="none",
                max_length=30,
                verbose_name="Role plateforme",
            ),
        ),
    ]
