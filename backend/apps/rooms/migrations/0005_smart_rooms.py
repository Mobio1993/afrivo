import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0004_fix_unique_constraints_per_hotel"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomLiveStatus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "hotel_status",
                    models.CharField(
                        choices=[
                            ("available", "Disponible"),
                            ("occupied", "Occupee"),
                            ("reserved", "Reservee"),
                            ("cleaning", "En nettoyage"),
                            ("maintenance", "Maintenance"),
                        ],
                        default="available",
                        max_length=20,
                        verbose_name="Statut hotelier",
                    ),
                ),
                (
                    "presence_status",
                    models.CharField(
                        choices=[("detected", "Detectee"), ("none", "Aucune")],
                        default="none",
                        max_length=20,
                        verbose_name="Presence",
                    ),
                ),
                (
                    "door_status",
                    models.CharField(
                        choices=[("open", "Ouverte"), ("open_long", "Ouverte trop longtemps"), ("closed", "Fermee")],
                        default="closed",
                        max_length=20,
                        verbose_name="Porte",
                    ),
                ),
                (
                    "ac_status",
                    models.CharField(
                        choices=[("on", "Allume"), ("off", "Eteint")],
                        default="off",
                        max_length=10,
                        verbose_name="Climatisation",
                    ),
                ),
                (
                    "light_status",
                    models.CharField(
                        choices=[("on", "Allume"), ("off", "Eteint")],
                        default="off",
                        max_length=10,
                        verbose_name="Lumiere",
                    ),
                ),
                ("temperature", models.DecimalField(decimal_places=2, default=22, max_digits=5, verbose_name="Temperature (C)")),
                ("humidity", models.DecimalField(decimal_places=2, default=60, max_digits=5, verbose_name="Humidite (%)")),
                ("last_activity_at", models.DateTimeField(blank=True, null=True, verbose_name="Derniere activite")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "hotel",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="room_live_statuses",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "room",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="live_status",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Statut live chambre",
                "verbose_name_plural": "Statuts live chambres",
            },
        ),
        migrations.CreateModel(
            name="RoomSensor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "sensor_type",
                    models.CharField(
                        choices=[
                            ("presence", "Presence (mmWave)"),
                            ("door", "Porte"),
                            ("temperature", "Temperature"),
                            ("humidity", "Humidite"),
                            ("energy", "Energie"),
                            ("light", "Lumiere"),
                            ("ac", "Climatisation"),
                            ("multi", "Capteur multi"),
                        ],
                        max_length=20,
                        verbose_name="Type",
                    ),
                ),
                ("name", models.CharField(max_length=100, verbose_name="Nom")),
                (
                    "status",
                    models.CharField(
                        choices=[("online", "En ligne"), ("offline", "Hors ligne"), ("error", "Erreur")],
                        default="online",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                ("last_seen_at", models.DateTimeField(blank=True, null=True, verbose_name="Derniere activite")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "hotel",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="room_sensors",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sensors",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Capteur chambre",
                "verbose_name_plural": "Capteurs chambres",
                "ordering": ["room", "sensor_type"],
            },
        ),
        migrations.CreateModel(
            name="RoomAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "alert_type",
                    models.CharField(
                        choices=[
                            ("presence_anomaly", "Anomalie presence"),
                            ("door_open_long", "Porte ouverte trop longtemps"),
                            ("temperature_high", "Temperature elevee"),
                            ("temperature_low", "Temperature basse"),
                            ("sensor_offline", "Capteur hors ligne"),
                            ("energy_spike", "Pic energetique"),
                            ("maintenance", "Maintenance requise"),
                        ],
                        max_length=30,
                        verbose_name="Type d'alerte",
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[("info", "Information"), ("warning", "Avertissement"), ("critical", "Critique")],
                        default="warning",
                        max_length=20,
                        verbose_name="Severite",
                    ),
                ),
                ("message", models.TextField(verbose_name="Message")),
                ("is_active", models.BooleanField(default=True, verbose_name="Active")),
                ("resolved_at", models.DateTimeField(blank=True, null=True, verbose_name="Resolue le")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                (
                    "hotel",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="room_smart_alerts",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="smart_alerts",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Alerte intelligente chambre",
                "verbose_name_plural": "Alertes intelligentes chambres",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SensorEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=50, verbose_name="Type d'evenement")),
                ("payload", models.JSONField(blank=True, default=dict, verbose_name="Donnees")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                (
                    "hotel",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sensor_events",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sensor_events",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
                (
                    "sensor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="events",
                        to="rooms.roomsensor",
                        verbose_name="Capteur",
                    ),
                ),
            ],
            options={
                "verbose_name": "Evenement capteur",
                "verbose_name_plural": "Evenements capteurs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EnergyReading",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("value_kwh", models.DecimalField(decimal_places=4, max_digits=10, verbose_name="Consommation (kWh)")),
                ("recorded_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Enregistre le")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                (
                    "hotel",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="energy_readings",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="energy_readings",
                        to="rooms.room",
                        verbose_name="Chambre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Lecture energie",
                "verbose_name_plural": "Lectures energie",
                "ordering": ["-recorded_at"],
            },
        ),
        migrations.AddIndex(
            model_name="roomlivestatus",
            index=models.Index(fields=["hotel"], name="rm_live_hotel_idx"),
        ),
        migrations.AddIndex(
            model_name="roomlivestatus",
            index=models.Index(fields=["hotel", "hotel_status"], name="rm_live_hotel_status_idx"),
        ),
        migrations.AddIndex(
            model_name="roomlivestatus",
            index=models.Index(fields=["hotel", "presence_status"], name="rm_live_hotel_presence_idx"),
        ),
        migrations.AddIndex(
            model_name="roomsensor",
            index=models.Index(fields=["hotel", "status"], name="rm_sensor_hotel_status_idx"),
        ),
        migrations.AddIndex(
            model_name="roomsensor",
            index=models.Index(fields=["hotel", "sensor_type"], name="rm_sensor_hotel_type_idx"),
        ),
        migrations.AddIndex(
            model_name="roomalert",
            index=models.Index(fields=["hotel", "is_active"], name="rm_alert_hotel_active_idx"),
        ),
        migrations.AddIndex(
            model_name="roomalert",
            index=models.Index(fields=["hotel", "severity"], name="rm_alert_hotel_severity_idx"),
        ),
        migrations.AddIndex(
            model_name="roomalert",
            index=models.Index(fields=["hotel", "alert_type"], name="rm_alert_hotel_type_idx"),
        ),
        migrations.AddIndex(
            model_name="sensorevent",
            index=models.Index(fields=["hotel", "created_at"], name="sensor_event_hotel_date_idx"),
        ),
        migrations.AddIndex(
            model_name="sensorevent",
            index=models.Index(fields=["hotel", "event_type"], name="sensor_event_hotel_type_idx"),
        ),
        migrations.AddIndex(
            model_name="energyreading",
            index=models.Index(fields=["hotel", "recorded_at"], name="energy_hotel_date_idx"),
        ),
        migrations.AddIndex(
            model_name="energyreading",
            index=models.Index(fields=["hotel", "room"], name="energy_hotel_room_idx"),
        ),
    ]
