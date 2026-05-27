from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.rooms.models import (
    EnergyReading,
    Room,
    RoomAlert,
    RoomHousekeepingTask,
    RoomLiveStatus,
    RoomMaintenanceIncident,
    RoomRateRule,
    RoomSensor,
    RoomType,
    SensorEvent,
)
from apps.rooms.services import get_room_type_effective_rates, suggest_rooms
from apps.tenants.services.tenant_service import TenantService

validate_objects_belong_to_hotel = TenantService.validate_objects_belong_to_hotel


class TenantHotelValidationMixin:
    tenant_related_fields = ()

    def get_effective_hotel(self, attrs):
        instance = self.instance
        request = self.context.get("request")
        return (
            attrs.get("hotel")
            or getattr(instance, "hotel", None)
            or getattr(request, "active_hotel", None)
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        related = {}
        for field_name in self.tenant_related_fields:
            related[field_name] = attrs.get(field_name) if field_name in attrs else getattr(instance, field_name, None)
        validate_objects_belong_to_hotel(self.get_effective_hotel(attrs), **related)
        return attrs


class RoomTypeSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    effective_price_per_night = serializers.SerializerMethodField()
    effective_price_day_use = serializers.SerializerMethodField()

    class Meta:
        model = RoomType
        fields = [
            "id",
            "hotel",
            "name",
            "code",
            "description",
            "capacity",
            "max_adults",
            "max_children",
            "base_price_per_night",
            "base_price_day_use",
            "amenities",
            "image_urls",
            "pricing_policy_notes",
            "is_day_use_available",
            "is_active",
            "effective_price_per_night",
            "effective_price_day_use",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "effective_price_per_night", "effective_price_day_use"]

    def get_effective_price_per_night(self, obj):
        return get_room_type_effective_rates(obj)["night"]

    def get_effective_price_day_use(self, obj):
        return get_room_type_effective_rates(obj)["day_use"]


class RoomSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room_type",)
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    effective_price_per_night = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    effective_price_day_use = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "hotel",
            "number",
            "room_code",
            "room_type",
            "room_type_name",
            "floor",
            "status",
            "status_label",
            "custom_price_per_night",
            "custom_price_day_use",
            "effective_price_per_night",
            "effective_price_day_use",
            "is_vip_preferred",
            "notes",
            "last_cleaned_at",
            "last_inspected_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["room_code", "created_at", "updated_at", "effective_price_per_night", "effective_price_day_use"]


class RoomRateRuleSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room_type",)
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)

    class Meta:
        model = RoomRateRule
        fields = [
            "id",
            "hotel",
            "room_type",
            "room_type_name",
            "name",
            "applies_to",
            "rule_type",
            "adjustment_mode",
            "adjustment_value",
            "start_date",
            "end_date",
            "min_occupancy_rate",
            "priority",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "room_type_name"]


class RoomHousekeepingTaskSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    task_type_label = serializers.CharField(source="get_task_type_display", read_only=True)

    class Meta:
        model = RoomHousekeepingTask
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "task_type",
            "task_type_label",
            "status",
            "status_label",
            "priority",
            "priority_label",
            "assigned_to",
            "assigned_to_name",
            "estimated_minutes",
            "actual_minutes",
            "notes",
            "issue_reported",
            "requested_at",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "room_number", "assigned_to_name", "status_label", "priority_label", "task_type_label"]

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return ""
        return obj.assigned_to.get_full_name().strip() or obj.assigned_to.username


class RoomMaintenanceIncidentSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)
    reported_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_display", read_only=True)

    class Meta:
        model = RoomMaintenanceIncident
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "title",
            "description",
            "severity",
            "severity_label",
            "status",
            "status_label",
            "marks_room_out_of_service",
            "reported_by",
            "reported_by_name",
            "assigned_to",
            "assigned_to_name",
            "reported_at",
            "resolved_at",
            "resolution_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "room_number",
            "reported_by_name",
            "assigned_to_name",
            "status_label",
            "severity_label",
        ]

    def get_reported_by_name(self, obj):
        if not obj.reported_by:
            return ""
        return obj.reported_by.get_full_name().strip() or obj.reported_by.username

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return ""
        return obj.assigned_to.get_full_name().strip() or obj.assigned_to.username

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("reported_by", request.user)
        return super().create(validated_data)


class RoomAssignmentSuggestionSerializer(serializers.Serializer):
    guest = serializers.IntegerField(required=False)
    room_type = serializers.IntegerField(required=False)
    check_in_date = serializers.DateField(required=False)
    check_out_date = serializers.DateField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=20, default=5)

    def validate(self, attrs):
        check_in_date = attrs.get("check_in_date")
        check_out_date = attrs.get("check_out_date")
        if check_in_date and check_out_date and check_out_date <= check_in_date:
            raise serializers.ValidationError({"check_out_date": "La date de sortie doit etre posterieure a l'arrivee."})
        return attrs

    def build_payload(self, *, hotel):
        guest = None
        room_type = None
        if self.validated_data.get("guest"):
            guest = hotel.guests.filter(pk=self.validated_data["guest"]).first()
        if self.validated_data.get("room_type"):
            room_type = hotel.room_types.filter(pk=self.validated_data["room_type"]).first()
        return suggest_rooms(
            hotel=hotel,
            room_type=room_type,
            guest=guest,
            check_in_date=self.validated_data.get("check_in_date"),
            check_out_date=self.validated_data.get("check_out_date"),
            limit=self.validated_data.get("limit", 5),
        )


class RoomRealtimeStateSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    roomNumber = serializers.CharField()
    roomType = serializers.CharField()
    floor = serializers.CharField()
    hotelStatus = serializers.CharField()
    presenceStatus = serializers.CharField()
    doorStatus = serializers.CharField()
    acStatus = serializers.CharField()
    lightStatus = serializers.CharField()
    temperature = serializers.IntegerField()
    humidity = serializers.IntegerField()
    lastActivity = serializers.CharField()
    alertLevel = serializers.CharField()
    alertMessage = serializers.CharField()
    sensorStatus = serializers.CharField()


class RoomLiveStatusSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)
    room_type = serializers.CharField(source="room.room_type.name", read_only=True)
    hotel_status_label = serializers.CharField(source="get_hotel_status_display", read_only=True)
    presence_status_label = serializers.CharField(source="get_presence_status_display", read_only=True)
    door_status_label = serializers.CharField(source="get_door_status_display", read_only=True)

    class Meta:
        model = RoomLiveStatus
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "room_type",
            "hotel_status",
            "hotel_status_label",
            "presence_status",
            "presence_status_label",
            "door_status",
            "door_status_label",
            "ac_status",
            "light_status",
            "temperature",
            "humidity",
            "last_activity_at",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "room_number", "room_type", "hotel_status_label", "presence_status_label", "door_status_label"]


class RoomSensorSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)
    sensor_type_label = serializers.CharField(source="get_sensor_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RoomSensor
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "sensor_type",
            "sensor_type_label",
            "name",
            "status",
            "status_label",
            "last_seen_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "room_number", "sensor_type_label", "status_label"]


class RoomAlertSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)
    alert_type_label = serializers.CharField(source="get_alert_type_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_display", read_only=True)

    class Meta:
        model = RoomAlert
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "alert_type",
            "alert_type_label",
            "severity",
            "severity_label",
            "message",
            "is_active",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = ["created_at", "room_number", "alert_type_label", "severity_label"]


class SensorEventSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room", "sensor")
    room_number = serializers.CharField(source="room.number", read_only=True)

    class Meta:
        model = SensorEvent
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "sensor",
            "event_type",
            "payload",
            "created_at",
        ]
        read_only_fields = ["created_at", "room_number"]


class EnergyReadingSerializer(TenantHotelValidationMixin, serializers.ModelSerializer):
    tenant_related_fields = ("room",)
    room_number = serializers.CharField(source="room.number", read_only=True)

    class Meta:
        model = EnergyReading
        fields = [
            "id",
            "hotel",
            "room",
            "room_number",
            "value_kwh",
            "recorded_at",
            "created_at",
        ]
        read_only_fields = ["created_at", "room_number"]


class RoomRealtimeSerializer(serializers.ModelSerializer):
    numero = serializers.CharField(source="number", read_only=True)
    etage = serializers.SerializerMethodField()
    etat_hotelier = serializers.SerializerMethodField()
    etat_hotelier_display = serializers.SerializerMethodField()
    type_chambre_display = serializers.SerializerMethodField()
    presence_detectee = serializers.SerializerMethodField()
    porte_statut = serializers.SerializerMethodField()
    porte_duree_min = serializers.SerializerMethodField()
    temperature = serializers.SerializerMethodField()
    humidite = serializers.SerializerMethodField()
    lumiere_allumee = serializers.SerializerMethodField()
    clim_allumee = serializers.SerializerMethodField()
    capteur_en_ligne = serializers.SerializerMethodField()
    derniere_activite = serializers.SerializerMethodField()
    derniere_alerte_msg = serializers.SerializerMethodField()
    derniere_alerte_niveau = serializers.SerializerMethodField()
    historique = serializers.SerializerMethodField()

    def _live(self, obj):
        try:
            return obj.live_status
        except RoomLiveStatus.DoesNotExist:
            return None

    def _active_alert(self, obj):
        try:
            return obj.smart_alerts.filter(is_active=True).order_by("-created_at").first()
        except Exception:
            return None

    def get_etage(self, obj):
        return f"{obj.floor}e etage" if obj.floor else "Etage non renseigne"

    def get_etat_hotelier(self, obj):
        live = self._live(obj)
        status = live.hotel_status if live else obj.status
        if status == Room.Status.OUT_OF_SERVICE:
            return "hors_service"
        if status == "available":
            return "disponible"
        if status == "occupied":
            return "occupee"
        if status == "cleaning":
            return "nettoyage"
        if status == "maintenance":
            return "maintenance"
        return status

    def get_etat_hotelier_display(self, obj):
        return {
            "disponible": "Disponible",
            "occupee": "Occupee",
            "reserved": "Reservee",
            "nettoyage": "Nettoyage",
            "maintenance": "Maintenance",
            "hors_service": "Hors service",
        }.get(self.get_etat_hotelier(obj), obj.get_status_display())

    def get_type_chambre_display(self, obj):
        return obj.room_type.name if obj.room_type_id else "-"

    def get_presence_detectee(self, obj):
        live = self._live(obj)
        return bool(live and live.presence_status == RoomLiveStatus.PresenceStatus.DETECTED)

    def get_porte_statut(self, obj):
        live = self._live(obj)
        if not live:
            return "inconnu"
        return "ouverte" if live.door_status in {
            RoomLiveStatus.DoorStatus.OPEN,
            RoomLiveStatus.DoorStatus.OPEN_LONG,
        } else "fermee"

    def get_porte_duree_min(self, obj):
        live = self._live(obj)
        if not live or live.door_status == RoomLiveStatus.DoorStatus.CLOSED:
            return 0
        if live.door_status == RoomLiveStatus.DoorStatus.OPEN_LONG:
            return 15
        return 3

    def get_temperature(self, obj):
        live = self._live(obj)
        if not live or live.temperature is None:
            return None
        return round(float(live.temperature), 1)

    def get_humidite(self, obj):
        live = self._live(obj)
        if not live or live.humidity is None:
            return None
        return round(float(live.humidity), 1)

    def get_lumiere_allumee(self, obj):
        live = self._live(obj)
        return bool(live and live.light_status == RoomLiveStatus.DeviceStatus.ON)

    def get_clim_allumee(self, obj):
        live = self._live(obj)
        return bool(live and live.ac_status == RoomLiveStatus.DeviceStatus.ON)

    def get_capteur_en_ligne(self, obj):
        from datetime import timedelta
        from django.utils import timezone

        sensors = list(obj.sensors.all())
        if not sensors:
            return False
        threshold = timezone.now() - timedelta(minutes=5)
        for sensor in sensors:
            if sensor.status == RoomSensor.Status.ONLINE and (not sensor.last_seen_at or sensor.last_seen_at >= threshold):
                return True
        return False

    def get_derniere_activite(self, obj):
        from django.utils import timezone

        live = self._live(obj)
        last = None
        if live:
            last = live.last_activity_at or live.updated_at
        if not last:
            event = obj.sensor_events.order_by("-created_at").first()
            last = event.created_at if event else obj.updated_at
        delta = timezone.now() - last
        mins = max(int(delta.total_seconds() // 60), 0)
        if mins < 1:
            return "il y a moins d'une minute"
        if mins < 60:
            return f"il y a {mins} min"
        return f"il y a {max(mins // 60, 1)}h"

    def get_derniere_alerte_msg(self, obj):
        alert = self._active_alert(obj)
        return alert.message if alert else None

    def get_derniere_alerte_niveau(self, obj):
        alert = self._active_alert(obj)
        if not alert:
            return None
        return "critique" if alert.severity == RoomAlert.Severity.CRITICAL else alert.severity

    def get_historique(self, obj):
        from django.utils import timezone

        events = []
        for event in obj.sensor_events.order_by("-created_at")[:5]:
            delta = timezone.now() - event.created_at
            mins = max(int(delta.total_seconds() // 60), 0)
            level = event.payload.get("niveau") or event.payload.get("level") or "info"
            message = event.payload.get("message") or event.event_type
            events.append({
                "message": message,
                "niveau": "critique" if level == "critical" else level,
                "time": f"il y a {mins} min" if mins < 60 else f"il y a {mins // 60}h",
                "iso": event.created_at.strftime("%H:%M"),
            })
        if not events:
            events.append({
                "message": "Statut chambre synchronise",
                "niveau": "ok",
                "time": self.get_derniere_activite(obj),
                "iso": "",
            })
        return events

    class Meta:
        model = Room
        fields = [
            "id",
            "numero",
            "etat_hotelier",
            "etat_hotelier_display",
            "type_chambre_display",
            "etage",
            "presence_detectee",
            "porte_statut",
            "porte_duree_min",
            "temperature",
            "humidite",
            "lumiere_allumee",
            "clim_allumee",
            "capteur_en_ligne",
            "derniere_activite",
            "derniere_alerte_msg",
            "derniere_alerte_niveau",
            "historique",
        ]


class RoomRealtimeSummarySerializer(serializers.Serializer):
    total_chambres = serializers.IntegerField()
    disponibles = serializers.IntegerField()
    occupees = serializers.IntegerField()
    nettoyage = serializers.IntegerField()
    hors_service = serializers.IntegerField()
    alertes_actives = serializers.IntegerField()
    capteurs_hors_ligne = serializers.IntegerField()
    portes_ouvertes_long = serializers.IntegerField()
    temperature_moyenne = serializers.FloatField(allow_null=True)
    humidite_moyenne = serializers.FloatField(allow_null=True)
    rooms = RoomRealtimeSerializer(many=True)
    alerts_feed = serializers.ListField()


class HousekeepingTaskEnhancedSerializer(serializers.ModelSerializer):
    chambre_numero = serializers.SerializerMethodField()
    chambre_type = serializers.SerializerMethodField()
    agent_nom = serializers.SerializerMethodField()
    statut = serializers.CharField(source="status", read_only=True)
    statut_display = serializers.SerializerMethodField()
    type_tache = serializers.CharField(source="task_type", read_only=True)
    type_tache_display = serializers.SerializerMethodField()
    priorite = serializers.CharField(source="priority", read_only=True)
    priorite_display = serializers.SerializerMethodField()
    temps_estime = serializers.IntegerField(source="estimated_minutes", read_only=True)
    probleme_signale = serializers.CharField(source="issue_reported", read_only=True)
    duree_ecoulee_min = serializers.SerializerMethodField()
    est_en_retard = serializers.SerializerMethodField()
    retard_min = serializers.SerializerMethodField()
    attente_min = serializers.SerializerMethodField()
    progression_pct = serializers.SerializerMethodField()
    heure_debut = serializers.SerializerMethodField()
    heure_fin_estimee = serializers.SerializerMethodField()

    def get_chambre_numero(self, obj):
        try:
            return str(obj.room.number) if obj.room_id else "-"
        except Exception:
            return "-"

    def get_chambre_type(self, obj):
        try:
            return obj.room.room_type.name if obj.room_id and obj.room.room_type_id else "-"
        except Exception:
            return "-"

    def get_agent_nom(self, obj):
        try:
            if not obj.assigned_to_id:
                return None
            return obj.assigned_to.get_full_name().strip() or obj.assigned_to.username
        except Exception:
            return None

    def get_statut_display(self, obj):
        if getattr(obj, "issue_reported", "") and obj.status != RoomHousekeepingTask.Status.COMPLETED:
            return "Probleme signale"
        return {
            RoomHousekeepingTask.Status.PENDING: "A nettoyer",
            RoomHousekeepingTask.Status.IN_PROGRESS: "En cours",
            RoomHousekeepingTask.Status.COMPLETED: "Termine",
            RoomHousekeepingTask.Status.CANCELLED: "Annule",
        }.get(obj.status, obj.status)

    def get_type_tache_display(self, obj):
        return {
            RoomHousekeepingTask.TaskType.TURNOVER: "Rotation",
            RoomHousekeepingTask.TaskType.DEEP_CLEANING: "Nettoyage profond",
            RoomHousekeepingTask.TaskType.INSPECTION: "Inspection",
            RoomHousekeepingTask.TaskType.TOUCH_UP: "Retouche",
        }.get(obj.task_type, obj.task_type)

    def get_priorite_display(self, obj):
        return {
            RoomHousekeepingTask.Priority.URGENT: "Urgente",
            RoomHousekeepingTask.Priority.HIGH: "Haute",
            RoomHousekeepingTask.Priority.NORMAL: "Normale",
            RoomHousekeepingTask.Priority.LOW: "Faible",
        }.get(obj.priority, obj.priority)

    def get_duree_ecoulee_min(self, obj):
        try:
            if obj.status == RoomHousekeepingTask.Status.IN_PROGRESS and obj.started_at:
                return int((timezone.now() - obj.started_at).total_seconds() / 60)
            if obj.status == RoomHousekeepingTask.Status.COMPLETED and obj.started_at and obj.completed_at:
                return int((obj.completed_at - obj.started_at).total_seconds() / 60)
        except Exception:
            pass
        return int(obj.actual_minutes or 0)

    def get_attente_min(self, obj):
        try:
            if obj.status == RoomHousekeepingTask.Status.PENDING and obj.requested_at:
                return int((timezone.now() - obj.requested_at).total_seconds() / 60)
        except Exception:
            pass
        return 0

    def get_est_en_retard(self, obj):
        try:
            estimate = obj.estimated_minutes or 30
            if obj.status == RoomHousekeepingTask.Status.IN_PROGRESS:
                return self.get_duree_ecoulee_min(obj) > estimate
            if obj.status == RoomHousekeepingTask.Status.PENDING:
                return self.get_attente_min(obj) > 20
        except Exception:
            pass
        return False

    def get_retard_min(self, obj):
        try:
            if obj.status != RoomHousekeepingTask.Status.IN_PROGRESS:
                return 0
            return max(0, self.get_duree_ecoulee_min(obj) - (obj.estimated_minutes or 30))
        except Exception:
            return 0

    def get_progression_pct(self, obj):
        try:
            if obj.status == RoomHousekeepingTask.Status.COMPLETED:
                return 100
            if obj.status == RoomHousekeepingTask.Status.IN_PROGRESS:
                return min(100, round((self.get_duree_ecoulee_min(obj) / (obj.estimated_minutes or 30)) * 100))
        except Exception:
            pass
        return 0

    def get_heure_debut(self, obj):
        try:
            return timezone.localtime(obj.started_at).strftime("%H:%M") if obj.started_at else None
        except Exception:
            return None

    def get_heure_fin_estimee(self, obj):
        try:
            if obj.started_at:
                return timezone.localtime(obj.started_at + timedelta(minutes=obj.estimated_minutes or 30)).strftime("%H:%M")
        except Exception:
            pass
        return None

    class Meta:
        model = RoomHousekeepingTask
        fields = [
            "id",
            "chambre_numero",
            "chambre_type",
            "agent_nom",
            "statut",
            "statut_display",
            "type_tache",
            "type_tache_display",
            "priorite",
            "priorite_display",
            "temps_estime",
            "notes",
            "probleme_signale",
            "duree_ecoulee_min",
            "est_en_retard",
            "retard_min",
            "attente_min",
            "progression_pct",
            "heure_debut",
            "heure_fin_estimee",
            "created_at",
        ]


class HousekeepingDashboardSerializer(serializers.Serializer):
    a_nettoyer_count = serializers.IntegerField()
    en_cours_count = serializers.IntegerField()
    termine_count = serializers.IntegerField()
    duree_moyenne_min = serializers.FloatField()
    en_retard_count = serializers.IntegerField()
    agents_actifs_count = serializers.IntegerField()
    non_attribuees_count = serializers.IntegerField()
    kanban_a_nettoyer = HousekeepingTaskEnhancedSerializer(many=True)
    kanban_en_cours = HousekeepingTaskEnhancedSerializer(many=True)
    kanban_termine = HousekeepingTaskEnhancedSerializer(many=True)
    kanban_probleme = HousekeepingTaskEnhancedSerializer(many=True)
    agents = serializers.ListField()
    alertes = serializers.ListField()
    stats_par_type = serializers.DictField()
    stats_duree_par_agent = serializers.ListField()
    stats_duree_moyenne = serializers.FloatField()


class RoomHotelViewSerializer(serializers.ModelSerializer):
    """Enhanced serializer for the Vue Hotel room cards."""

    numero = serializers.CharField(source="number", read_only=True)
    etage = serializers.IntegerField(source="floor", read_only=True, allow_null=True)
    statut = serializers.CharField(source="status", read_only=True)
    etat_hotelier_display = serializers.SerializerMethodField()
    type_chambre_display = serializers.SerializerMethodField()
    tarif_base = serializers.SerializerMethodField()
    client_nom = serializers.SerializerMethodField()
    sejour_actif = serializers.SerializerMethodField()
    depart_aujourd_hui = serializers.SerializerMethodField()
    arrivee_aujourd_hui = serializers.SerializerMethodField()
    sejour_progression_pct = serializers.SerializerMethodField()
    sejour_jours_restes = serializers.SerializerMethodField()
    sejour_date_depart = serializers.SerializerMethodField()
    sejour_nuit_actuelle = serializers.SerializerMethodField()
    sejour_total_nuits = serializers.SerializerMethodField()
    solde_du = serializers.SerializerMethodField()
    solde_statue = serializers.SerializerMethodField()
    temperature = serializers.SerializerMethodField()
    lumiere_allumee = serializers.SerializerMethodField()
    porte_ouverte = serializers.SerializerMethodField()
    porte_duree_min = serializers.SerializerMethodField()
    presence_detectee = serializers.SerializerMethodField()
    capteur_en_ligne = serializers.SerializerMethodField()
    tache_hk_active = serializers.SerializerMethodField()

    def _active_stay(self, obj):
        try:
            return (
                obj.stays.filter(status="in_progress")
                .select_related("guest")
                .order_by("-check_in_at", "-id")
                .first()
            )
        except Exception:
            return None

    def _live(self, obj):
        try:
            return obj.live_status
        except RoomLiveStatus.DoesNotExist:
            return None

    def get_etat_hotelier_display(self, obj):
        return {
            Room.Status.AVAILABLE: "Disponible",
            Room.Status.OCCUPIED: "Occupee",
            Room.Status.RESERVED: "Reservee",
            Room.Status.CLEANING: "En nettoyage",
            Room.Status.OUT_OF_SERVICE: "Hors service",
        }.get(obj.status, obj.get_status_display())

    def get_type_chambre_display(self, obj):
        return obj.room_type.name if obj.room_type_id else "-"

    def get_tarif_base(self, obj):
        try:
            return float(obj.effective_price_per_night or 0)
        except Exception:
            return 0

    def get_client_nom(self, obj):
        stay = self._active_stay(obj)
        if not stay or not stay.guest_id:
            return None
        return stay.guest.full_name

    def get_sejour_actif(self, obj):
        return self._active_stay(obj) is not None

    def get_depart_aujourd_hui(self, obj):
        stay = self._active_stay(obj)
        return bool(stay and stay.expected_check_out_date == timezone.localdate())

    def get_arrivee_aujourd_hui(self, obj):
        try:
            return obj.bookings.filter(check_in_date=timezone.localdate(), status__in=["pending", "confirmed"]).exists()
        except Exception:
            return False

    def _stay_dates(self, obj):
        stay = self._active_stay(obj)
        if not stay:
            return None, None
        start = (stay.planned_check_in or stay.check_in_at or stay.actual_check_in)
        start_date = start.date() if hasattr(start, "date") else start
        end_date = stay.expected_check_out_date
        if not end_date and stay.planned_check_out:
            end_date = stay.planned_check_out.date()
        return start_date, end_date

    def get_sejour_progression_pct(self, obj):
        try:
            start, end = self._stay_dates(obj)
            if not start or not end:
                return 0
            today = timezone.localdate()
            total = max((end - start).days, 1)
            done = max((today - start).days, 0)
            return min(100, round((done / total) * 100))
        except Exception:
            return 0

    def get_sejour_jours_restes(self, obj):
        try:
            _, end = self._stay_dates(obj)
            return max((end - timezone.localdate()).days, 0) if end else None
        except Exception:
            return None

    def get_sejour_date_depart(self, obj):
        _, end = self._stay_dates(obj)
        return end.strftime("%d/%m/%Y") if end else None

    def get_sejour_total_nuits(self, obj):
        try:
            start, end = self._stay_dates(obj)
            return max((end - start).days, 1) if start and end else None
        except Exception:
            return None

    def get_sejour_nuit_actuelle(self, obj):
        try:
            start, end = self._stay_dates(obj)
            if not start or not end:
                return None
            return min(max((timezone.localdate() - start).days + 1, 1), max((end - start).days, 1))
        except Exception:
            return None

    def get_solde_du(self, obj):
        stay = self._active_stay(obj)
        if not stay:
            return 0
        try:
            return float(stay.get_financial_totals()["unpaid_balance"] or 0)
        except Exception:
            return 0

    def get_solde_statue(self, obj):
        solde = self.get_solde_du(obj)
        if solde <= 0:
            return "solde"
        stay = self._active_stay(obj)
        try:
            total = float(stay.get_financial_totals()["total_amount"] or 0) if stay else 0
            return "impaye" if total and solde >= total else "partiel"
        except Exception:
            return "partiel"

    def get_temperature(self, obj):
        live = self._live(obj)
        return round(float(live.temperature), 1) if live and live.temperature is not None else None

    def get_lumiere_allumee(self, obj):
        live = self._live(obj)
        return bool(live and live.light_status == RoomLiveStatus.DeviceStatus.ON)

    def get_porte_ouverte(self, obj):
        live = self._live(obj)
        return bool(live and live.door_status in {RoomLiveStatus.DoorStatus.OPEN, RoomLiveStatus.DoorStatus.OPEN_LONG})

    def get_porte_duree_min(self, obj):
        live = self._live(obj)
        if not live or live.door_status == RoomLiveStatus.DoorStatus.CLOSED:
            return 0
        return 15 if live.door_status == RoomLiveStatus.DoorStatus.OPEN_LONG else 3

    def get_presence_detectee(self, obj):
        live = self._live(obj)
        return bool(live and live.presence_status == RoomLiveStatus.PresenceStatus.DETECTED)

    def get_capteur_en_ligne(self, obj):
        threshold = timezone.now() - timedelta(minutes=5)
        return any(
            sensor.status == RoomSensor.Status.ONLINE and (not sensor.last_seen_at or sensor.last_seen_at >= threshold)
            for sensor in obj.sensors.all()
        )

    def get_tache_hk_active(self, obj):
        task = (
            obj.housekeeping_tasks.filter(status__in=[RoomHousekeepingTask.Status.PENDING, RoomHousekeepingTask.Status.IN_PROGRESS])
            .select_related("assigned_to")
            .order_by("-priority", "requested_at")
            .first()
        )
        if not task:
            return None
        elapsed = int((timezone.now() - task.started_at).total_seconds() // 60) if task.started_at else 0
        estimate = task.estimated_minutes or 30
        return {
            "id": task.id,
            "type": task.task_type,
            "statut": task.status,
            "agent": task.assigned_to.get_full_name().strip() or task.assigned_to.username if task.assigned_to_id else None,
            "progression_pct": min(100, round((elapsed / estimate) * 100)) if task.started_at else 0,
            "duree_min": elapsed,
            "temps_estime": estimate,
        }

    class Meta:
        model = Room
        fields = [
            "id",
            "numero",
            "etage",
            "statut",
            "etat_hotelier_display",
            "type_chambre_display",
            "tarif_base",
            "client_nom",
            "sejour_actif",
            "depart_aujourd_hui",
            "arrivee_aujourd_hui",
            "sejour_progression_pct",
            "sejour_jours_restes",
            "sejour_date_depart",
            "sejour_nuit_actuelle",
            "sejour_total_nuits",
            "solde_du",
            "solde_statue",
            "temperature",
            "lumiere_allumee",
            "porte_ouverte",
            "porte_duree_min",
            "presence_detectee",
            "capteur_en_ligne",
            "tache_hk_active",
        ]


class VueHotelDashboardSerializer(serializers.Serializer):
    disponibles = serializers.IntegerField()
    occupees = serializers.IntegerField()
    nettoyage = serializers.IntegerField()
    hors_service = serializers.IntegerField()
    taux_occupation_pct = serializers.FloatField()
    arrivees_today = serializers.IntegerField()
    departs_today = serializers.IntegerField()
    revpar = serializers.FloatField()
    solde_total_impaye = serializers.FloatField()
    rooms = RoomHotelViewSerializer(many=True)
    departs_liste = serializers.ListField()
    arrivees_liste = serializers.ListField()
    suggestions = serializers.ListField()
    files_prioritaires = serializers.ListField()
