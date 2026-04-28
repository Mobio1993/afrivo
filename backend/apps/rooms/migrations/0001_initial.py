from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="RoomType",
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
                ("name", models.CharField(max_length=100, unique=True, verbose_name="Nom")),
                ("code", models.CharField(max_length=30, unique=True, verbose_name="Code")),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                ("capacity", models.PositiveIntegerField(default=1, verbose_name="Capacite totale")),
                (
                    "max_adults",
                    models.PositiveIntegerField(default=1, verbose_name="Nombre maximum d'adultes"),
                ),
                (
                    "max_children",
                    models.PositiveIntegerField(default=0, verbose_name="Nombre maximum d'enfants"),
                ),
                (
                    "base_price_per_night",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        verbose_name="Prix de base par nuit",
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
            ],
            options={
                "verbose_name": "Type de chambre",
                "verbose_name_plural": "Types de chambres",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Room",
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
                ("number", models.CharField(max_length=20, unique=True, verbose_name="Numero")),
                ("floor", models.PositiveIntegerField(blank=True, null=True, verbose_name="Etage")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("available", "Disponible"),
                            ("occupied", "Occupee"),
                            ("cleaning", "En nettoyage"),
                            ("out_of_service", "Hors service"),
                        ],
                        default="available",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "room_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rooms",
                        to="rooms.roomtype",
                        verbose_name="Type de chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Chambre",
                "verbose_name_plural": "Chambres",
                "ordering": ["number"],
            },
        ),
    ]
