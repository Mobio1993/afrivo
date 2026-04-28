from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_hotels_to_consumptions(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    ClientConsumption = apps.get_model("consumptions", "ClientConsumption")

    org_slug = slugify(DEFAULT_ORG_NAME) or "afrivo-default-organization"
    hotel_slug = slugify(DEFAULT_HOTEL_NAME) or "afrivo-default-hotel"

    organization, _ = Organization.objects.get_or_create(
        slug=org_slug,
        defaults={"name": DEFAULT_ORG_NAME, "is_active": True},
    )
    hotel, _ = Hotel.objects.get_or_create(
        organization=organization,
        code=DEFAULT_HOTEL_CODE,
        defaults={
            "name": DEFAULT_HOTEL_NAME,
            "slug": hotel_slug,
            "timezone": "Atlantic/Reykjavik",
            "currency": "XOF",
            "is_active": True,
        },
    )
    HotelSettings.objects.get_or_create(hotel=hotel)

    for consumption in ClientConsumption.objects.select_related("stay", "reservation", "room", "client").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if consumption.stay_id and getattr(consumption.stay, "hotel_id", None):
            resolved_hotel_id = consumption.stay.hotel_id
        elif consumption.reservation_id and getattr(consumption.reservation, "hotel_id", None):
            resolved_hotel_id = consumption.reservation.hotel_id
        elif consumption.room_id and getattr(consumption.room, "hotel_id", None):
            resolved_hotel_id = consumption.room.hotel_id
        elif consumption.client_id and getattr(consumption.client, "hotel_id", None):
            resolved_hotel_id = consumption.client.hotel_id
        ClientConsumption.objects.filter(pk=consumption.pk).update(hotel_id=resolved_hotel_id or hotel.id)


def detach_hotels_from_consumptions(apps, schema_editor):
    ClientConsumption = apps.get_model("consumptions", "ClientConsumption")
    ClientConsumption.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("guests", "0005_guest_hotel"),
        ("rooms", "0002_roomtype_hotel_room_hotel"),
        ("bookings", "0003_booking_hotel_dayuse_hotel"),
        ("stays", "0004_stay_hotel"),
        ("consumptions", "0002_clientconsumption_reservation_clientconsumption_room_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientconsumption",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="consumptions",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_hotels_to_consumptions, detach_hotels_from_consumptions),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["hotel", "service_date"], name="cons_hotel_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["hotel", "status"], name="cons_hotel_status_idx"),
        ),
    ]
