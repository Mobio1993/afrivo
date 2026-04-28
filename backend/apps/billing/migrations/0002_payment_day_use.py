import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0002_dayuse"),
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="day_use",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="payments",
                to="bookings.dayuse",
                verbose_name="Day use",
            ),
        ),
    ]
