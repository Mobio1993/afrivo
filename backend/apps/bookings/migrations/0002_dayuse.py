import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0001_initial"),
        ("guests", "0002_remove_guest_unique_guest_identity_document_and_more"),
        ("rooms", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DayUse",
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
                            ("pending_payment", "Paiement en attente"),
                            ("ready", "Pret a entrer"),
                            ("in_progress", "En cours"),
                            ("completed", "Termine"),
                            ("cancelled", "Annule"),
                        ],
                        default="pending_payment",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                ("package_price", models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Formule fixe")),
                (
                    "overtime_choice",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (0, "Aucun depassement"),
                            (2, "+ 2 heures"),
                            (4, "+ 4 heures"),
                            (6, "+ 6 heures"),
                        ],
                        default=0,
                        verbose_name="Depassement",
                    ),
                ),
                (
                    "overtime_fee",
                    models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Frais de depassement"),
                ),
                (
                    "total_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Montant total"),
                ),
                (
                    "planned_entry_at",
                    models.DateTimeField(default=django.utils.timezone.now, verbose_name="Entree prevue"),
                ),
                (
                    "check_in_at",
                    models.DateTimeField(blank=True, null=True, verbose_name="Entree effectuee le"),
                ),
                (
                    "check_out_at",
                    models.DateTimeField(blank=True, null=True, verbose_name="Sortie effectuee le"),
                ),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="day_uses",
                        to="guests.guest",
                        verbose_name="Client",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="day_uses",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Day use",
                "verbose_name_plural": "Day use",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="dayuse",
            constraint=models.CheckConstraint(
                condition=models.Q(("package_price__gt", 0)),
                name="day_use_package_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="dayuse",
            constraint=models.CheckConstraint(
                condition=models.Q(("overtime_fee__gte", 0)),
                name="day_use_overtime_fee_non_negative",
            ),
        ),
    ]
