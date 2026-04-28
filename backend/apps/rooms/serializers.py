from rest_framework import serializers

from apps.rooms.models import Room, RoomHousekeepingTask, RoomMaintenanceIncident, RoomRateRule, RoomType
from apps.rooms.services import get_room_type_effective_rates, suggest_rooms


class RoomTypeSerializer(serializers.ModelSerializer):
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


class RoomSerializer(serializers.ModelSerializer):
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


class RoomRateRuleSerializer(serializers.ModelSerializer):
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


class RoomHousekeepingTaskSerializer(serializers.ModelSerializer):
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


class RoomMaintenanceIncidentSerializer(serializers.ModelSerializer):
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
