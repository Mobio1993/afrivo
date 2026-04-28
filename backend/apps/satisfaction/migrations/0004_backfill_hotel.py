from django.db import migrations
from django.db.models import OuterRef, Subquery


def backfill_satisfaction_hotel(apps, schema_editor):
    ClientSatisfaction = apps.get_model("satisfaction", "ClientSatisfaction")
    Stay = apps.get_model("stays", "Stay")
    Guest = apps.get_model("guests", "Guest")

    # Pass 1: from stay.hotel (most precise)
    stay_hotel = Subquery(Stay.objects.filter(pk=OuterRef("stay_id")).values("hotel_id")[:1])
    ClientSatisfaction.objects.filter(hotel__isnull=True, stay__isnull=False).update(hotel_id=stay_hotel)

    # Pass 2: remaining nulls from client.hotel
    client_hotel = Subquery(Guest.objects.filter(pk=OuterRef("client_id")).values("hotel_id")[:1])
    ClientSatisfaction.objects.filter(hotel__isnull=True).update(hotel_id=client_hotel)


class Migration(migrations.Migration):
    dependencies = [
        ("satisfaction", "0003_add_hotel_fk"),
        ("stays", "0001_initial"),
        ("guests", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill_satisfaction_hotel, migrations.RunPython.noop),
    ]
