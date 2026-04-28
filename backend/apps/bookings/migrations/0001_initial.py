import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("guests", "0002_remove_guest_unique_guest_identity_document_and_more"),
        ("rooms", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Booking",
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
                        choices=[
                            ("pending", "En attente"),
                            ("confirmed", "Confirmee"),
                            ("cancelled", "Annulee"),
                            ("no_show", "No-show"),
                            ("checked_in", "Convertie en check-in"),
                        ],
                        default="pending",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("walk_in", "Walk-in"),
                            ("phone", "Telephone"),
                            ("website", "Site web"),
                            ("ota", "OTA"),
                            ("other", "Autre"),
                        ],
                        default="walk_in",
                        max_length=20,
                        verbose_name="Source",
                    ),
                ),
                ("check_in_date", models.DateField(verbose_name="Date d'arrivee")),
                ("check_out_date", models.DateField(verbose_name="Date de depart")),
                ("adults", models.PositiveIntegerField(default=1, verbose_name="Adultes")),
                ("children", models.PositiveIntegerField(default=0, verbose_name="Enfants")),
                (
                    "estimated_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Montant estime"),
                ),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bookings",
                        to="guests.guest",
                        verbose_name="Client",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bookings",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
                (
                    "room_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bookings",
                        to="rooms.roomtype",
                        verbose_name="Type de chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Reservation",
                "verbose_name_plural": "Reservations",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="booking",
            constraint=models.CheckConstraint(
                condition=models.Q(("check_out_date__gt", models.F("check_in_date"))),
                name="booking_checkout_after_checkin",
            ),
        ),
        migrations.AddConstraint(
            model_name="booking",
            constraint=models.CheckConstraint(
                condition=models.Q(("adults__gte", 1)),
                name="booking_at_least_one_adult",
            ),
        ),
    ]
