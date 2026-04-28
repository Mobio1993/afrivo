from django.db import migrations, models


CLIENT_CODE_PREFIX = "AFR-CL"
CLIENT_CODE_SEQUENCE_WIDTH = 6


def build_client_code(client_id, year):
    return f"{CLIENT_CODE_PREFIX}-{year}-{int(client_id):0{CLIENT_CODE_SEQUENCE_WIDTH}d}"


def populate_guest_client_codes(apps, schema_editor):
    Guest = apps.get_model("guests", "Guest")

    for guest in Guest.objects.filter(client_code__isnull=True).only("id", "created_at").iterator():
        year = guest.created_at.year if guest.created_at else 2026
        Guest.objects.filter(pk=guest.pk, client_code__isnull=True).update(
            client_code=build_client_code(guest.pk, year)
        )


def reset_guest_client_codes(apps, schema_editor):
    Guest = apps.get_model("guests", "Guest")
    Guest.objects.update(client_code=None)


class Migration(migrations.Migration):
    dependencies = [
        ("guests", "0005_guest_hotel"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="client_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                editable=False,
                max_length=32,
                null=True,
                unique=True,
                verbose_name="Code client",
            ),
        ),
        migrations.RunPython(populate_guest_client_codes, reset_guest_client_codes),
    ]
