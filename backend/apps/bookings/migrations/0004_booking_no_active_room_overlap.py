import django.contrib.postgres.constraints
import django.contrib.postgres.fields.ranges
import django.contrib.postgres.operations
from django.db import migrations, models
from django.db.models import Func


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0003_booking_hotel_dayuse_hotel"),
    ]

    operations = [
        django.contrib.postgres.operations.BtreeGistExtension(),
        migrations.AddConstraint(
            model_name="booking",
            constraint=django.contrib.postgres.constraints.ExclusionConstraint(
                name="booking_no_active_room_overlap",
                expressions=[
                    (
                        Func(
                            "check_in_date",
                            "check_out_date",
                            function="DATERANGE",
                            output_field=django.contrib.postgres.fields.ranges.DateRangeField(),
                        ),
                        "&&",
                    ),
                    ("room", "="),
                ],
                condition=models.Q(
                    ("room__isnull", False),
                    ("status__in", ["pending", "confirmed", "checked_in"]),
                ),
            ),
        ),
    ]
