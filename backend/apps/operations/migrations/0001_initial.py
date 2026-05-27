from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("bookings", "0004_booking_no_active_room_overlap"),
        ("guests", "0007_remove_guest_middle_name"),
        ("rooms", "0005_smart_rooms"),
        ("stays", "0006_alter_stay_adults_count_alter_stay_children_count"),
        ("tenancy", "0003_expand_hotelsettings"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomRelocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(max_length=255, verbose_name="Motif")),
                (
                    "rate_impact_mode",
                    models.CharField(
                        choices=[
                            ("keep_original", "Conserver le tarif"),
                            ("none", "Aucun impact"),
                            ("apply_new_rate", "Appliquer le nouveau tarif"),
                            ("manual_adjustment", "Ajustement manuel"),
                        ],
                        default="keep_original",
                        max_length=30,
                        verbose_name="Impact tarifaire",
                    ),
                ),
                ("old_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Ancien montant")),
                ("new_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Nouveau montant")),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                (
                    "booking",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations",
                        to="bookings.booking",
                        verbose_name="Reservation",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="room_relocations",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Agent",
                    ),
                ),
                (
                    "guest",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="room_relocations",
                        to="guests.guest",
                        verbose_name="Client",
                    ),
                ),
                (
                    "hotel",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="room_relocations",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "new_room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations_to",
                        to="rooms.room",
                        verbose_name="Nouvelle chambre",
                    ),
                ),
                (
                    "new_room_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations_to",
                        to="rooms.roomtype",
                        verbose_name="Nouveau type de chambre",
                    ),
                ),
                (
                    "old_room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations_from",
                        to="rooms.room",
                        verbose_name="Ancienne chambre",
                    ),
                ),
                (
                    "old_room_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations_from",
                        to="rooms.roomtype",
                        verbose_name="Ancien type de chambre",
                    ),
                ),
                (
                    "stay",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="relocations",
                        to="stays.stay",
                        verbose_name="Sejour",
                    ),
                ),
            ],
            options={
                "verbose_name": "Relogement",
                "verbose_name_plural": "Relogements",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="roomrelocation",
            index=models.Index(fields=["hotel", "created_at"], name="reloc_hotel_created_idx"),
        ),
        migrations.AddIndex(
            model_name="roomrelocation",
            index=models.Index(fields=["booking"], name="reloc_booking_idx"),
        ),
        migrations.AddIndex(
            model_name="roomrelocation",
            index=models.Index(fields=["stay"], name="reloc_stay_idx"),
        ),
    ]
