from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_default_hotel_to_guests(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    Guest = apps.get_model("guests", "Guest")

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

    Guest.objects.filter(hotel__isnull=True).update(hotel=hotel)


def detach_default_hotel_from_guests(apps, schema_editor):
    Guest = apps.get_model("guests", "Guest")
    Guest.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("guests", "0004_guest_client_type_guest_document_expiry_date_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="guests",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_default_hotel_to_guests, detach_default_hotel_from_guests),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(fields=["hotel", "last_name", "first_name"], name="guest_hotel_name_idx"),
        ),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(fields=["hotel", "phone"], name="guest_hotel_phone_idx"),
        ),
    ]
