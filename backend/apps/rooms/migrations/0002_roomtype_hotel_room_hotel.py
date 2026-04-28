from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_default_hotel_to_rooms(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    RoomType = apps.get_model("rooms", "RoomType")
    Room = apps.get_model("rooms", "Room")

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

    RoomType.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Room.objects.filter(hotel__isnull=True).update(hotel=hotel)


def detach_default_hotel_from_rooms(apps, schema_editor):
    RoomType = apps.get_model("rooms", "RoomType")
    Room = apps.get_model("rooms", "Room")
    RoomType.objects.update(hotel=None)
    Room.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("rooms", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="roomtype",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="room_types",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.AddField(
            model_name="room",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="rooms",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_default_hotel_to_rooms, detach_default_hotel_from_rooms),
        migrations.AddIndex(
            model_name="roomtype",
            index=models.Index(fields=["hotel", "name"], name="room_type_hotel_name_idx"),
        ),
        migrations.AddIndex(
            model_name="roomtype",
            index=models.Index(fields=["hotel", "code"], name="room_type_hotel_code_idx"),
        ),
        migrations.AddIndex(
            model_name="room",
            index=models.Index(fields=["hotel", "number"], name="room_hotel_number_idx"),
        ),
        migrations.AddIndex(
            model_name="room",
            index=models.Index(fields=["hotel", "status"], name="room_hotel_status_idx"),
        ),
    ]
