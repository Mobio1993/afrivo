from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_hotels_to_bookings_and_dayuses(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    Booking = apps.get_model("bookings", "Booking")
    DayUse = apps.get_model("bookings", "DayUse")

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

    for booking in Booking.objects.select_related("room", "guest", "room_type").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if booking.room_id and getattr(booking.room, "hotel_id", None):
            resolved_hotel_id = booking.room.hotel_id
        elif booking.guest_id and getattr(booking.guest, "hotel_id", None):
            resolved_hotel_id = booking.guest.hotel_id
        elif booking.room_type_id and getattr(booking.room_type, "hotel_id", None):
            resolved_hotel_id = booking.room_type.hotel_id
        Booking.objects.filter(pk=booking.pk).update(hotel_id=resolved_hotel_id or hotel.id)

    for day_use in DayUse.objects.select_related("room", "guest").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if day_use.room_id and getattr(day_use.room, "hotel_id", None):
            resolved_hotel_id = day_use.room.hotel_id
        elif day_use.guest_id and getattr(day_use.guest, "hotel_id", None):
            resolved_hotel_id = day_use.guest.hotel_id
        DayUse.objects.filter(pk=day_use.pk).update(hotel_id=resolved_hotel_id or hotel.id)


def detach_hotels_from_bookings_and_dayuses(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    DayUse = apps.get_model("bookings", "DayUse")
    Booking.objects.update(hotel=None)
    DayUse.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("rooms", "0002_roomtype_hotel_room_hotel"),
        ("guests", "0005_guest_hotel"),
        ("bookings", "0002_dayuse"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="bookings",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.AddField(
            model_name="dayuse",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="day_uses",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_hotels_to_bookings_and_dayuses, detach_hotels_from_bookings_and_dayuses),
        migrations.AddIndex(
            model_name="booking",
            index=models.Index(fields=["hotel", "check_in_date"], name="booking_hotel_checkin_idx"),
        ),
        migrations.AddIndex(
            model_name="booking",
            index=models.Index(fields=["hotel", "status"], name="booking_hotel_status_idx"),
        ),
        migrations.AddIndex(
            model_name="dayuse",
            index=models.Index(fields=["hotel", "planned_entry_at"], name="dayuse_hotel_entry_idx"),
        ),
        migrations.AddIndex(
            model_name="dayuse",
            index=models.Index(fields=["hotel", "status"], name="dayuse_hotel_status_idx"),
        ),
    ]
