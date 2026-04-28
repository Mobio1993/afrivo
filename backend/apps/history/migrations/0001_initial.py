import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="HistoryEntry",
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
                (
                    "action_type",
                    models.CharField(
                        choices=[
                            ("booking_created", "Reservation creee"),
                            ("check_in", "Check-in"),
                            ("check_out", "Check-out"),
                            ("cleaning_completed", "Nettoyage termine"),
                            ("payment_recorded", "Paiement enregistre"),
                            ("status_updated", "Statut mis a jour"),
                            ("other", "Autre"),
                        ],
                        max_length=40,
                        verbose_name="Type d'action",
                    ),
                ),
                ("module", models.CharField(max_length=50, verbose_name="Module")),
                ("entity_type", models.CharField(max_length=50, verbose_name="Type d'entite")),
                ("entity_reference", models.CharField(max_length=100, verbose_name="Reference entite")),
                ("description", models.TextField(verbose_name="Description")),
                ("metadata", models.JSONField(blank=True, default=dict, verbose_name="Metadonnees")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="history_entries",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Auteur",
                    ),
                ),
            ],
            options={
                "verbose_name": "Historique",
                "verbose_name_plural": "Historique",
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
