import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("bookings", "0001_initial"),
        ("stays", "0002_stay_check_out_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="Payment",
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
                            ("paid", "Paye"),
                            ("cancelled", "Annule"),
                            ("refunded", "Rembourse"),
                        ],
                        default="paid",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("cash", "Especes"),
                            ("card", "Carte"),
                            ("transfer", "Virement"),
                            ("mobile_money", "Mobile money"),
                            ("other", "Autre"),
                        ],
                        default="cash",
                        max_length=20,
                        verbose_name="Mode de paiement",
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Montant")),
                ("paid_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Paye le")),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "booking",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payments",
                        to="bookings.booking",
                        verbose_name="Reservation",
                    ),
                ),
                (
                    "stay",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payments",
                        to="stays.stay",
                        verbose_name="Sejour",
                    ),
                ),
            ],
            options={
                "verbose_name": "Paiement",
                "verbose_name_plural": "Paiements",
                "ordering": ["-paid_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", 0)),
                name="payment_amount_positive",
            ),
        ),
    ]
