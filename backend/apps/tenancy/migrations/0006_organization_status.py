from django.db import migrations, models


def sync_existing_statuses(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Organization.objects.filter(is_active=True).update(status="active")
    Organization.objects.filter(is_active=False).update(status="inactive")


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0005_hotelsettings_validation_constraints"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("suspended", "Suspendue"),
                    ("inactive", "Inactive"),
                ],
                default="active",
                max_length=20,
                verbose_name="Statut",
            ),
        ),
        migrations.AddIndex(
            model_name="organization",
            index=models.Index(fields=["status"], name="org_status_idx"),
        ),
        migrations.RunPython(sync_existing_statuses, migrations.RunPython.noop),
    ]
