from django.db import migrations, models


def backfill_history_hotel(apps, schema_editor):
    HistoryEntry = apps.get_model("history", "HistoryEntry")
    Guest = apps.get_model("guests", "Guest")
    Stay = apps.get_model("stays", "Stay")
    Booking = apps.get_model("bookings", "Booking")
    DayUse = apps.get_model("bookings", "DayUse")
    ClientInvoice = apps.get_model("billing", "ClientInvoice")
    Payment = apps.get_model("billing", "Payment")
    ClientConsumption = apps.get_model("consumptions", "ClientConsumption")
    Hotel = apps.get_model("tenancy", "Hotel")

    default_hotel = Hotel.objects.order_by("id").first()

    guest_hotels = dict(Guest.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    stay_hotels = dict(Stay.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    booking_hotels = dict(Booking.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    day_use_hotels = dict(DayUse.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    invoice_hotels = dict(ClientInvoice.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    payment_hotels = dict(Payment.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    consumption_hotels = dict(ClientConsumption.objects.exclude(hotel_id__isnull=True).values_list("id", "hotel_id"))
    for entry in HistoryEntry.objects.filter(hotel_id__isnull=True).select_related("actor").iterator():
        resolved_hotel_id = None
        if entry.actor_id and getattr(entry.actor, "hotel_id", None):
            resolved_hotel_id = entry.actor.hotel_id

        metadata = entry.metadata or {}
        if resolved_hotel_id is None:
            guest_id = metadata.get("guest_id") or metadata.get("client_id")
            stay_id = metadata.get("stay_id")
            booking_id = metadata.get("booking_id")
            day_use_id = metadata.get("day_use_id")
            invoice_id = metadata.get("invoice_id")
            payment_id = metadata.get("payment_id")
            consumption_id = metadata.get("consumption_id")
            resolved_hotel_id = (
                stay_hotels.get(stay_id)
                or booking_hotels.get(booking_id)
                or day_use_hotels.get(day_use_id)
                or invoice_hotels.get(invoice_id)
                or payment_hotels.get(payment_id)
                or consumption_hotels.get(consumption_id)
                or guest_hotels.get(guest_id)
            )

        if resolved_hotel_id is None and default_hotel is not None:
            resolved_hotel_id = default_hotel.id

        if resolved_hotel_id is not None:
            HistoryEntry.objects.filter(pk=entry.pk).update(hotel_id=resolved_hotel_id)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
        ("users", "0002_user_organization_user_hotel"),
        ("guests", "0005_guest_hotel"),
        ("rooms", "0002_roomtype_hotel_room_hotel"),
        ("bookings", "0003_booking_hotel_dayuse_hotel"),
        ("stays", "0004_stay_hotel"),
        ("consumptions", "0003_clientconsumption_hotel"),
        ("billing", "0005_clientinvoice_hotel_payment_hotel"),
        ("history", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="historyentry",
            name="hotel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="history_entries",
                to="tenancy.hotel",
                verbose_name="Hotel",
            ),
        ),
        migrations.AddIndex(
            model_name="historyentry",
            index=models.Index(fields=["hotel", "created_at"], name="history_hotel_created_idx"),
        ),
        migrations.AddIndex(
            model_name="historyentry",
            index=models.Index(fields=["hotel", "module"], name="history_hotel_module_idx"),
        ),
        migrations.RunPython(backfill_history_hotel, migrations.RunPython.noop),
    ]
