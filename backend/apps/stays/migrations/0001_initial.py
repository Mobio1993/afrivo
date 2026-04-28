import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("bookings", "0001_initial"),
        ("guests", "0002_remove_guest_unique_guest_identity_document_and_more"),
        ("rooms", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Stay",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("reference", models.CharField(max_length=20, unique=True, verbose_name="Reference")),
                (
                    "status",
                    models.CharField(
                        choices=[("in_progress", "En cours"), ("completed", "Termine")],
                        default="in_progress",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "check_in_at",
                    models.DateTimeField(default=django.utils.timezone.now, verbose_name="Check-in effectue le"),
                ),
                (
                    "expected_check_out_date",
                    models.DateField(blank=True, null=True, verbose_name="Date de depart prevue"),
                ),
                ("adults", models.PositiveIntegerField(default=1, verbose_name="Adultes")),
                ("children", models.PositiveIntegerField(default=0, verbose_name="Enfants")),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "booking",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="stay",
                        to="bookings.booking",
                        verbose_name="Reservation",
                    ),
                ),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="stays",
                        to="guests.guest",
                        verbose_name="Client",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="stays",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Sejour",
                "verbose_name_plural": "Sejours",
                "ordering": ["-check_in_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="stay",
            constraint=models.CheckConstraint(
                condition=models.Q(("adults__gte", 1)),
                name="stay_at_least_one_adult",
            ),
        ),
    ]
