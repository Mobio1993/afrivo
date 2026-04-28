from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"


def attach_hotels_to_billing(apps, schema_editor):
    Organization = apps.get_model("tenancy", "Organization")
    Hotel = apps.get_model("tenancy", "Hotel")
    HotelSettings = apps.get_model("tenancy", "HotelSettings")
    ClientInvoice = apps.get_model("billing", "ClientInvoice")
    Payment = apps.get_model("billing", "Payment")

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

    for invoice in ClientInvoice.objects.select_related("stay", "reservation", "client").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if invoice.stay_id and getattr(invoice.stay, "hotel_id", None):
            resolved_hotel_id = invoice.stay.hotel_id
        elif invoice.reservation_id and getattr(invoice.reservation, "hotel_id", None):
            resolved_hotel_id = invoice.reservation.hotel_id
        elif invoice.client_id and getattr(invoice.client, "hotel_id", None):
            resolved_hotel_id = invoice.client.hotel_id
        ClientInvoice.objects.filter(pk=invoice.pk).update(hotel_id=resolved_hotel_id or hotel.id)

    for payment in Payment.objects.select_related("stay", "booking", "day_use", "invoice", "client").filter(hotel__isnull=True):
        resolved_hotel_id = None
        if payment.stay_id and getattr(payment.stay, "hotel_id", None):
            resolved_hotel_id = payment.stay.hotel_id
        elif payment.booking_id and getattr(payment.booking, "hotel_id", None):
            resolved_hotel_id = payment.booking.hotel_id
        elif payment.day_use_id and getattr(payment.day_use, "hotel_id", None):
            resolved_hotel_id = payment.day_use.hotel_id
        elif payment.invoice_id and getattr(payment.invoice, "hotel_id", None):
            resolved_hotel_id = payment.invoice.hotel_id
        elif payment.client_id and getattr(payment.client, "hotel_id", None):
            resolved_hotel_id = payment.client.hotel_id
        Payment.objects.filter(pk=payment.pk).update(hotel_id=resolved_hotel_id or hotel.id)


def detach_hotels_from_billing(apps, schema_editor):
    ClientInvoice = apps.get_model("billing", "ClientInvoice")
    Payment = apps.get_model("billing", "Payment")
    ClientInvoice.objects.update(hotel=None)
    Payment.objects.update(hotel=None)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("guests", "0005_guest_hotel"),
        ("bookings", "0003_booking_hotel_dayuse_hotel"),
        ("stays", "0004_stay_hotel"),
        ("consumptions", "0003_clientconsumption_hotel"),
        ("billing", "0004_payment_client_payment_currency_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientinvoice",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="invoices",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payments",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.RunPython(attach_hotels_to_billing, detach_hotels_from_billing),
        migrations.AddIndex(
            model_name="clientinvoice",
            index=models.Index(fields=["hotel", "issued_at"], name="invoice_hotel_issued_idx"),
        ),
        migrations.AddIndex(
            model_name="clientinvoice",
            index=models.Index(fields=["hotel", "status"], name="invoice_hotel_status_idx"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["hotel", "paid_at"], name="payment_hotel_paid_idx"),
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(fields=["hotel", "status"], name="payment_hotel_status_idx"),
        ),
    ]
