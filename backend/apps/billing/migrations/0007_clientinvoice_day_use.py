from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0006_alter_payment_payment_type"),
        ("bookings", "0004_booking_no_active_room_overlap"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientinvoice",
            name="day_use",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="invoices",
                to="bookings.dayuse",
                verbose_name="Day use",
            ),
        ),
        migrations.AddIndex(
            model_name="clientinvoice",
            index=models.Index(fields=["day_use", "issued_at"], name="invoice_dayuse_issued_idx"),
        ),
    ]
