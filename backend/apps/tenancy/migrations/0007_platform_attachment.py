from django.db import migrations, models
import django.db.models.deletion


def ensure_default_platform(apps, schema_editor):
    SuperRootPlatform = apps.get_model("super_root", "SuperRootPlatform")
    SuperRootPlatform.objects.get_or_create(
        slug="afrivo-default",
        defaults={
            "name": "AFRIVO Default",
            "code": "AF",
            "status": "active",
            "environment": "production",
            "is_primary": True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("super_root", "0001_initial"),
        ("tenancy", "0006_organization_status"),
    ]

    operations = [
        migrations.RunPython(ensure_default_platform, migrations.RunPython.noop),
        migrations.AddField(
            model_name="organization",
            name="platform",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="organizations", to="super_root.superrootplatform", verbose_name="Plateforme Super Root"),
        ),
        migrations.AddField(
            model_name="hotel",
            name="platform",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="hotels", to="super_root.superrootplatform", verbose_name="Plateforme Super Root"),
        ),
        migrations.AddIndex(
            model_name="organization",
            index=models.Index(fields=["platform"], name="org_platform_idx"),
        ),
        migrations.AddIndex(
            model_name="hotel",
            index=models.Index(fields=["platform"], name="hotel_platform_idx"),
        ),
    ]
