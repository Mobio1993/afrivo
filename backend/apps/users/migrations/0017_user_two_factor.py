from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_phase2_full_business_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="two_factor_enabled",
            field=models.BooleanField(default=False, verbose_name="2FA active"),
        ),
        migrations.AddField(
            model_name="user",
            name="two_factor_enabled_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="2FA activee le"),
        ),
    ]
