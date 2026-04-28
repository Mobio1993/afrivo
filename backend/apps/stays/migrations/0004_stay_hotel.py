from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_hotels_to_stays(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    Stay = apps.get_model("stays", "Stay")

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

    for stay in Stay.objects.select_related("room", "guest", "booking").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if stay.room_id and getattr(stay.room, "hotel_id", None):
            resolved_hotel_id = stay.room.hotel_id
        elif stay.guest_id and getattr(stay.guest, "hotel_id", None):
            resolved_hotel_id = stay.guest.hotel_id
        elif stay.booking_id and getattr(stay.booking, "hotel_id", None):
            resolved_hotel_id = stay.booking.hotel_id
        Stay.objects.filter(pk=stay.pk).update(hotel_id=resolved_hotel_id or hotel.id)


def detach_hotels_from_stays(apps, schema_editor):
    Stay = apps.get_model("stays", "Stay")
    Stay.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("rooms", "0002_roomtype_hotel_room_hotel"),
        ("guests", "0005_guest_hotel"),
        ("bookings", "0003_booking_hotel_dayuse_hotel"),
        ("stays", "0003_stay_actual_check_in_stay_actual_check_out_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="stay",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="stays",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_hotels_to_stays, detach_hotels_from_stays),
        migrations.AddIndex(
            model_name="stay",
            index=models.Index(fields=["hotel", "status"], name="stay_hotel_status_idx"),
        ),
        migrations.AddIndex(
            model_name="stay",
            index=models.Index(fields=["hotel", "check_in_at"], name="stay_hotel_checkin_idx"),
        ),
    ]
