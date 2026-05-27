import django.contrib.postgres.constraints
import django.contrib.postgres.fields.ranges
from django.db import migrations, models
from django.db.models import Func


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0005_dayuse_actual_duration_hours_dayuse_amount_paid_and_more"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="dayuse",
            constraint=django.contrib.postgres.constraints.ExclusionConstraint(
                name="dayuse_no_active_room_overlap",
                expressions=[
                    (
                        Func(
                            "start_datetime",
                            "end_datetime",
                            function="TSTZRANGE",
                            output_field=django.contrib.postgres.fields.ranges.DateTimeRangeField(),
                        ),
                        "&&",
                    ),
                    ("room", "="),
                ],
                condition=models.Q(
                    ("end_datetime__isnull", False),
                    ("room__isnull", False),
                    ("start_datetime__isnull", False),
                    ("status__in", ["pending_payment", "ready", "in_progress", "overtime"]),
                ),
            ),
        ),
    ]
