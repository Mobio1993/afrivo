from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history


class RoomType(models.Model):
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_types",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    name = models.CharField(max_length=100, verbose_name="Nom")
    code = models.CharField(max_length=30, verbose_name="Code")
    description = models.TextField(blank=True, verbose_name="Description")
    capacity = models.PositiveIntegerField(default=1, verbose_name="Capacite totale")
    max_adults = models.PositiveIntegerField(default=1, verbose_name="Nombre maximum d'adultes")
    max_children = models.PositiveIntegerField(default=0, verbose_name="Nombre maximum d'enfants")
    base_price_per_night = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Prix de base par nuit",
    )
    base_price_day_use = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Prix de base day use",
    )
    amenities = models.JSONField(default=list, blank=True, verbose_name="Equipements")
    image_urls = models.JSONField(default=list, blank=True, verbose_name="Images")
    pricing_policy_notes = models.TextField(blank=True, verbose_name="Politique tarifaire")
    is_day_use_available = models.BooleanField(default=True, verbose_name="Day use autorise")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Type de chambre"
        verbose_name_plural = "Types de chambres"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["hotel", "name"], name="room_type_unique_hotel_name"),
            models.UniqueConstraint(fields=["hotel", "code"], name="room_type_unique_hotel_code"),
        ]
        indexes = [
            models.Index(fields=["hotel", "name"], name="room_type_hotel_name_idx"),
            models.Index(fields=["hotel", "code"], name="room_type_hotel_code_idx"),
            models.Index(fields=["hotel", "is_active"], name="room_type_hotel_active_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Room(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Disponible"
        OCCUPIED = "occupied", "Occupee"
        RESERVED = "reserved", "Reservee"
        CLEANING = "cleaning", "En nettoyage"
        OUT_OF_SERVICE = "out_of_service", "Hors service"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="rooms",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    number = models.CharField(max_length=20, verbose_name="Numero")
    room_code = models.CharField(max_length=40, blank=True, db_index=True, verbose_name="Code chambre")
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="rooms",
        verbose_name="Type de chambre",
    )
    floor = models.PositiveIntegerField(blank=True, null=True, verbose_name="Etage")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
        verbose_name="Statut",
    )
    custom_price_per_night = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Tarif nuit personnalise",
    )
    custom_price_day_use = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Tarif day use personnalise",
    )
    is_vip_preferred = models.BooleanField(default=False, verbose_name="Prioritaire VIP")
    notes = models.TextField(blank=True, verbose_name="Notes")
    last_cleaned_at = models.DateTimeField(blank=True, null=True, verbose_name="Dernier nettoyage")
    last_inspected_at = models.DateTimeField(blank=True, null=True, verbose_name="Derniere inspection")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Chambre"
        verbose_name_plural = "Chambres"
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["hotel", "number"], name="room_unique_hotel_number"),
        ]
        indexes = [
            models.Index(fields=["hotel", "number"], name="room_hotel_number_idx"),
            models.Index(fields=["hotel", "status"], name="room_hotel_status_idx"),
            models.Index(fields=["hotel", "floor"], name="room_hotel_floor_idx"),
            models.Index(fields=["hotel", "is_active"], name="room_hotel_active_idx"),
        ]

    def __str__(self):
        return f"Chambre {self.number}"

    @property
    def is_available_for_check_in(self):
        return self.status in {self.Status.AVAILABLE, self.Status.RESERVED} and self.is_active

    @property
    def effective_price_per_night(self):
        return self.custom_price_per_night or self.room_type.base_price_per_night

    @property
    def effective_price_day_use(self):
        return self.custom_price_day_use or self.room_type.base_price_day_use

    def build_room_code(self):
        hotel_code = self.hotel.code if self.hotel_id and getattr(self.hotel, "code", "") else "HOT"
        return f"{hotel_code}-RM-{self.number}".upper()

    def complete_cleaning(self):
        if self.status != self.Status.CLEANING:
            raise ValidationError("Seule une chambre en nettoyage peut etre remise disponible.")

        self.last_cleaned_at = timezone.now()
        self.save(update_fields=["last_cleaned_at", "updated_at"])

        from apps.rooms.services import sync_room_operational_status

        sync_room_operational_status(self)
        log_history(
            action_type=HistoryEntry.ActionType.CLEANING_COMPLETED,
            module="rooms",
            entity_type="Room",
            entity_reference=self.number,
            description=f"Nettoyage termine pour la chambre {self.number}.",
            metadata={
                "room_id": self.id,
                "status": self.status,
            },
            hotel=self.hotel,
        )

    def clean(self):
        errors = {}

        if self.room_type_id and self.room_type and self.room_type.hotel_id and not self.hotel_id:
            self.hotel = self.room_type.hotel

        if self.hotel_id and self.room_type_id and self.room_type and self.room_type.hotel_id:
            if self.room_type.hotel_id != self.hotel_id:
                errors["room_type"] = "Le type de chambre doit appartenir au meme hotel que la chambre."

        if self.custom_price_per_night is not None and self.custom_price_per_night < 0:
            errors["custom_price_per_night"] = "Le tarif personnalise ne peut pas etre negatif."

        if self.custom_price_day_use is not None and self.custom_price_day_use < 0:
            errors["custom_price_day_use"] = "Le tarif day use personnalise ne peut pas etre negatif."

        if self.hotel_id and not self.room_code:
            self.room_code = self.build_room_code()

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class RoomRateRule(models.Model):
    class AppliesTo(models.TextChoices):
        NIGHT = "night", "Nuit"
        DAY_USE = "day_use", "Day use"
        BOTH = "both", "Les deux"

    class RuleType(models.TextChoices):
        WEEKEND = "weekend", "Week-end"
        SEASONAL = "seasonal", "Saisonnier"
        OCCUPANCY = "occupancy", "Occupation"

    class AdjustmentMode(models.TextChoices):
        PERCENT = "percent", "Pourcentage"
        FIXED = "fixed", "Montant fixe"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_rate_rules",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.CASCADE,
        related_name="rate_rules",
        verbose_name="Type de chambre",
    )
    name = models.CharField(max_length=120, verbose_name="Nom")
    applies_to = models.CharField(max_length=20, choices=AppliesTo.choices, default=AppliesTo.NIGHT, verbose_name="S'applique a")
    rule_type = models.CharField(max_length=20, choices=RuleType.choices, verbose_name="Type de regle")
    adjustment_mode = models.CharField(
        max_length=20,
        choices=AdjustmentMode.choices,
        default=AdjustmentMode.PERCENT,
        verbose_name="Mode d'ajustement",
    )
    adjustment_value = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valeur")
    start_date = models.DateField(blank=True, null=True, verbose_name="Debut")
    end_date = models.DateField(blank=True, null=True, verbose_name="Fin")
    min_occupancy_rate = models.PositiveIntegerField(blank=True, null=True, verbose_name="Occupation minimum (%)")
    priority = models.PositiveSmallIntegerField(default=10, verbose_name="Priorite")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Regle tarifaire chambre"
        verbose_name_plural = "Regles tarifaires chambres"
        ordering = ["priority", "name"]
        indexes = [
            models.Index(fields=["hotel", "is_active"], name="rm_rate_hotel_active_idx"),
            models.Index(fields=["hotel", "rule_type"], name="rm_rate_hotel_type_idx"),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        errors = {}

        if self.room_type_id and self.room_type and self.room_type.hotel_id and not self.hotel_id:
            self.hotel = self.room_type.hotel

        if self.hotel_id and self.room_type_id and self.room_type and self.room_type.hotel_id != self.hotel_id:
            errors["room_type"] = "Le type de chambre doit appartenir au meme hotel que la regle."

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "La fin ne peut pas etre anterieure au debut."

        if self.rule_type == self.RuleType.OCCUPANCY and self.min_occupancy_rate is None:
            errors["min_occupancy_rate"] = "Le seuil d'occupation est requis pour une regle d'occupation."

        if self.min_occupancy_rate is not None and not 0 <= self.min_occupancy_rate <= 100:
            errors["min_occupancy_rate"] = "Le taux d'occupation doit rester entre 0 et 100."

        if self.adjustment_mode == self.AdjustmentMode.PERCENT and self.adjustment_value <= Decimal("-100"):
            errors["adjustment_value"] = "Le pourcentage ne peut pas annuler totalement le tarif."

        if errors:
            raise ValidationError(errors)


class RoomHousekeepingTask(models.Model):
    class TaskType(models.TextChoices):
        TURNOVER = "turnover", "Rotation"
        DEEP_CLEANING = "deep_cleaning", "Nettoyage profond"
        INSPECTION = "inspection", "Inspection"
        TOUCH_UP = "touch_up", "Retouche"

    class Status(models.TextChoices):
        PENDING = "pending", "A nettoyer"
        IN_PROGRESS = "in_progress", "En cours"
        COMPLETED = "completed", "Termine"
        CANCELLED = "cancelled", "Annule"

    class Priority(models.TextChoices):
        LOW = "low", "Faible"
        NORMAL = "normal", "Normale"
        HIGH = "high", "Haute"
        URGENT = "urgent", "Urgente"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="housekeeping_tasks",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="housekeeping_tasks",
        verbose_name="Chambre",
    )
    task_type = models.CharField(max_length=20, choices=TaskType.choices, default=TaskType.TURNOVER, verbose_name="Type de tache")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name="Statut")
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL, verbose_name="Priorite")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="room_housekeeping_tasks",
        blank=True,
        null=True,
        verbose_name="Attribue a",
    )
    estimated_minutes = models.PositiveIntegerField(default=30, verbose_name="Temps estime (min)")
    actual_minutes = models.PositiveIntegerField(blank=True, null=True, verbose_name="Temps reel (min)")
    notes = models.TextField(blank=True, verbose_name="Notes")
    issue_reported = models.TextField(blank=True, verbose_name="Probleme signale")
    requested_at = models.DateTimeField(default=timezone.now, verbose_name="Demande le")
    started_at = models.DateTimeField(blank=True, null=True, verbose_name="Commence le")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Termine le")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Tache housekeeping"
        verbose_name_plural = "Taches housekeeping"
        ordering = ["status", "-priority", "-requested_at"]
        indexes = [
            models.Index(fields=["hotel", "status"], name="room_hk_hotel_status_idx"),
            models.Index(fields=["hotel", "priority"], name="room_hk_hotel_priority_idx"),
            models.Index(fields=["hotel", "assigned_to"], name="room_hk_hotel_assigned_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.get_task_type_display()}"

    def clean(self):
        errors = {}

        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre doit appartenir au meme hotel que la tache."

        if self.assigned_to_id and self.assigned_to and self.assigned_to.hotel_id and self.hotel_id and self.assigned_to.hotel_id != self.hotel_id:
            errors["assigned_to"] = "L'agent housekeeping doit appartenir au meme hotel."

        if self.started_at and self.completed_at and self.completed_at < self.started_at:
            errors["completed_at"] = "La fin de tache ne peut pas etre anterieure au debut."

        if self.status == self.Status.COMPLETED and not self.completed_at:
            self.completed_at = timezone.now()
        if self.status == self.Status.IN_PROGRESS and not self.started_at:
            self.started_at = timezone.now()

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        previous_status = None
        if self.pk:
            previous_status = type(self).objects.filter(pk=self.pk).values_list("status", flat=True).first()

        self.full_clean()
        super().save(*args, **kwargs)

        from apps.rooms.services import sync_room_operational_status

        if self.status == self.Status.COMPLETED:
            self.room.last_cleaned_at = self.completed_at or timezone.now()
            self.room.save(update_fields=["last_cleaned_at", "updated_at"])

        sync_room_operational_status(self.room)

        if is_new or previous_status != self.status:
            log_history(
                action_type=HistoryEntry.ActionType.STATUS_UPDATED,
                module="rooms",
                entity_type="RoomHousekeepingTask",
                entity_reference=f"{self.room.number}-{self.id}",
                description=f"Tache housekeeping {self.get_status_display().lower()} pour la chambre {self.room.number}.",
                actor=self.assigned_to if is_new else None,
                metadata={
                    "task_id": self.id,
                    "room_id": self.room_id,
                    "status": self.status,
                    "priority": self.priority,
                },
                hotel=self.hotel,
            )


class RoomMaintenanceIncident(models.Model):
    class Severity(models.TextChoices):
        LOW = "low", "Faible"
        MEDIUM = "medium", "Moyenne"
        HIGH = "high", "Haute"
        CRITICAL = "critical", "Critique"

    class Status(models.TextChoices):
        OPEN = "open", "Ouvert"
        IN_PROGRESS = "in_progress", "En cours"
        RESOLVED = "resolved", "Resolue"
        CLOSED = "closed", "Cloturee"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_maintenance_incidents",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="maintenance_incidents",
        verbose_name="Chambre",
    )
    title = models.CharField(max_length=150, verbose_name="Titre")
    description = models.TextField(blank=True, verbose_name="Description")
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM, verbose_name="Severite")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, verbose_name="Statut")
    marks_room_out_of_service = models.BooleanField(default=True, verbose_name="Mettre hors service")
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reported_room_incidents",
        blank=True,
        null=True,
        verbose_name="Signale par",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_room_incidents",
        blank=True,
        null=True,
        verbose_name="Attribue a",
    )
    reported_at = models.DateTimeField(default=timezone.now, verbose_name="Signale le")
    resolved_at = models.DateTimeField(blank=True, null=True, verbose_name="Resolue le")
    resolution_notes = models.TextField(blank=True, verbose_name="Notes de resolution")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Incident chambre"
        verbose_name_plural = "Incidents chambres"
        ordering = ["status", "-reported_at"]
        indexes = [
            models.Index(fields=["hotel", "status"], name="room_incident_hotel_status_idx"),
            models.Index(fields=["hotel", "severity"], name="rm_inc_hotel_severity_idx"),
            models.Index(fields=["hotel", "room"], name="rm_inc_hotel_room_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.title}"

    def clean(self):
        errors = {}

        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre doit appartenir au meme hotel que l'incident."

        if self.reported_by_id and self.reported_by and self.reported_by.hotel_id and self.hotel_id and self.reported_by.hotel_id != self.hotel_id:
            errors["reported_by"] = "Le declarant doit appartenir au meme hotel."

        if self.assigned_to_id and self.assigned_to and self.assigned_to.hotel_id and self.hotel_id and self.assigned_to.hotel_id != self.hotel_id:
            errors["assigned_to"] = "Le technicien doit appartenir au meme hotel."

        if self.status in {self.Status.RESOLVED, self.Status.CLOSED} and not self.resolved_at:
            self.resolved_at = timezone.now()
        if self.resolved_at and self.resolved_at < self.reported_at:
            errors["resolved_at"] = "La resolution ne peut pas etre anterieure au signalement."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        previous_status = None
        if self.pk:
            previous_status = type(self).objects.filter(pk=self.pk).values_list("status", flat=True).first()

        self.full_clean()
        super().save(*args, **kwargs)

        from apps.rooms.services import sync_room_operational_status

        sync_room_operational_status(self.room)

        if is_new or previous_status != self.status:
            log_history(
                action_type=HistoryEntry.ActionType.STATUS_UPDATED,
                module="rooms",
                entity_type="RoomMaintenanceIncident",
                entity_reference=f"{self.room.number}-{self.id}",
                description=f"Incident {self.get_status_display().lower()} pour la chambre {self.room.number}.",
                actor=self.reported_by if is_new else None,
                metadata={
                    "incident_id": self.id,
                    "room_id": self.room_id,
                    "status": self.status,
                    "severity": self.severity,
                    "out_of_service": self.marks_room_out_of_service,
                },
                hotel=self.hotel,
            )


class RoomLiveStatus(models.Model):
    class HotelStatus(models.TextChoices):
        AVAILABLE = "available", "Disponible"
        OCCUPIED = "occupied", "Occupee"
        RESERVED = "reserved", "Reservee"
        CLEANING = "cleaning", "En nettoyage"
        MAINTENANCE = "maintenance", "Maintenance"

    class PresenceStatus(models.TextChoices):
        DETECTED = "detected", "Detectee"
        NONE = "none", "Aucune"

    class DoorStatus(models.TextChoices):
        OPEN = "open", "Ouverte"
        OPEN_LONG = "open_long", "Ouverte trop longtemps"
        CLOSED = "closed", "Fermee"

    class DeviceStatus(models.TextChoices):
        ON = "on", "Allume"
        OFF = "off", "Eteint"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_live_statuses",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.OneToOneField(
        Room,
        on_delete=models.CASCADE,
        related_name="live_status",
        verbose_name="Chambre",
    )
    hotel_status = models.CharField(
        max_length=20,
        choices=HotelStatus.choices,
        default=HotelStatus.AVAILABLE,
        verbose_name="Statut hotelier",
    )
    presence_status = models.CharField(
        max_length=20,
        choices=PresenceStatus.choices,
        default=PresenceStatus.NONE,
        verbose_name="Presence",
    )
    door_status = models.CharField(
        max_length=20,
        choices=DoorStatus.choices,
        default=DoorStatus.CLOSED,
        verbose_name="Porte",
    )
    ac_status = models.CharField(
        max_length=10,
        choices=DeviceStatus.choices,
        default=DeviceStatus.OFF,
        verbose_name="Climatisation",
    )
    light_status = models.CharField(
        max_length=10,
        choices=DeviceStatus.choices,
        default=DeviceStatus.OFF,
        verbose_name="Lumiere",
    )
    temperature = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=22,
        verbose_name="Temperature (C)",
    )
    humidity = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=60,
        verbose_name="Humidite (%)",
    )
    last_activity_at = models.DateTimeField(blank=True, null=True, verbose_name="Derniere activite")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Statut live chambre"
        verbose_name_plural = "Statuts live chambres"
        indexes = [
            models.Index(fields=["hotel"], name="rm_live_hotel_idx"),
            models.Index(fields=["hotel", "hotel_status"], name="rm_live_hotel_status_idx"),
            models.Index(fields=["hotel", "presence_status"], name="rm_live_hotel_presence_idx"),
        ]

    def __str__(self):
        return f"Live {self.room.number}"

    def clean(self):
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel


class RoomSensor(models.Model):
    class SensorType(models.TextChoices):
        PRESENCE = "presence", "Presence (mmWave)"
        DOOR = "door", "Porte"
        TEMPERATURE = "temperature", "Temperature"
        HUMIDITY = "humidity", "Humidite"
        ENERGY = "energy", "Energie"
        LIGHT = "light", "Lumiere"
        AC = "ac", "Climatisation"
        MULTI = "multi", "Capteur multi"

    class Status(models.TextChoices):
        ONLINE = "online", "En ligne"
        OFFLINE = "offline", "Hors ligne"
        ERROR = "error", "Erreur"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_sensors",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="sensors",
        verbose_name="Chambre",
    )
    sensor_type = models.CharField(
        max_length=20,
        choices=SensorType.choices,
        verbose_name="Type",
    )
    name = models.CharField(max_length=100, verbose_name="Nom")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ONLINE,
        verbose_name="Statut",
    )
    last_seen_at = models.DateTimeField(blank=True, null=True, verbose_name="Derniere activite")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Capteur chambre"
        verbose_name_plural = "Capteurs chambres"
        ordering = ["room", "sensor_type"]
        indexes = [
            models.Index(fields=["hotel", "status"], name="rm_sensor_hotel_status_idx"),
            models.Index(fields=["hotel", "sensor_type"], name="rm_sensor_hotel_type_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.get_sensor_type_display()}"

    def clean(self):
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel


class RoomAlert(models.Model):
    class AlertType(models.TextChoices):
        PRESENCE_ANOMALY = "presence_anomaly", "Anomalie presence"
        DOOR_OPEN_LONG = "door_open_long", "Porte ouverte trop longtemps"
        TEMPERATURE_HIGH = "temperature_high", "Temperature elevee"
        TEMPERATURE_LOW = "temperature_low", "Temperature basse"
        SENSOR_OFFLINE = "sensor_offline", "Capteur hors ligne"
        ENERGY_SPIKE = "energy_spike", "Pic energetique"
        MAINTENANCE = "maintenance", "Maintenance requise"

    class Severity(models.TextChoices):
        INFO = "info", "Information"
        WARNING = "warning", "Avertissement"
        CRITICAL = "critical", "Critique"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_smart_alerts",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="smart_alerts",
        verbose_name="Chambre",
    )
    alert_type = models.CharField(
        max_length=30,
        choices=AlertType.choices,
        verbose_name="Type d'alerte",
    )
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.WARNING,
        verbose_name="Severite",
    )
    message = models.TextField(verbose_name="Message")
    is_active = models.BooleanField(default=True, verbose_name="Active")
    resolved_at = models.DateTimeField(blank=True, null=True, verbose_name="Resolue le")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Alerte intelligente chambre"
        verbose_name_plural = "Alertes intelligentes chambres"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hotel", "is_active"], name="rm_alert_hotel_active_idx"),
            models.Index(fields=["hotel", "severity"], name="rm_alert_hotel_severity_idx"),
            models.Index(fields=["hotel", "alert_type"], name="rm_alert_hotel_type_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.get_alert_type_display()}"

    def clean(self):
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel


class SensorEvent(models.Model):
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="sensor_events",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="sensor_events",
        verbose_name="Chambre",
    )
    sensor = models.ForeignKey(
        RoomSensor,
        on_delete=models.SET_NULL,
        related_name="events",
        blank=True,
        null=True,
        verbose_name="Capteur",
    )
    event_type = models.CharField(max_length=50, verbose_name="Type d'evenement")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Donnees")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Evenement capteur"
        verbose_name_plural = "Evenements capteurs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hotel", "created_at"], name="sensor_event_hotel_date_idx"),
            models.Index(fields=["hotel", "event_type"], name="sensor_event_hotel_type_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.event_type}"

    def clean(self):
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel


class EnergyReading(models.Model):
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="energy_readings",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="energy_readings",
        verbose_name="Chambre",
    )
    value_kwh = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        verbose_name="Consommation (kWh)",
    )
    recorded_at = models.DateTimeField(default=timezone.now, verbose_name="Enregistre le")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Lecture energie"
        verbose_name_plural = "Lectures energie"
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["hotel", "recorded_at"], name="energy_hotel_date_idx"),
            models.Index(fields=["hotel", "room"], name="energy_hotel_room_idx"),
        ]

    def __str__(self):
        return f"{self.room.number} - {self.value_kwh} kWh"

    def clean(self):
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel
