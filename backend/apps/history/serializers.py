from rest_framework import serializers

from apps.history.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    hotel_name = serializers.CharField(source="hotel.name", read_only=True, default="")
    user_name = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_display", read_only=True)
    integrity_valid = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "hotel",
            "hotel_name",
            "user",
            "user_name",
            "user_role",
            "action",
            "action_label",
            "module",
            "object_type",
            "object_id",
            "object_reference",
            "description",
            "old_values",
            "new_values",
            "metadata",
            "ip_address",
            "user_agent",
            "severity",
            "severity_label",
            "session_key",
            "previous_integrity_hash",
            "integrity_hash",
            "integrity_valid",
            "created_at",
        )
        read_only_fields = fields

    def get_user_name(self, obj):
        if not obj.user_id:
            return "Systeme"
        return obj.user.get_full_name() or obj.user.username

    def get_integrity_valid(self, obj):
        return obj.verify_integrity()


class RolePermissionHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.CharField(source="user_role", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True, default="")
    event_type = serializers.SerializerMethodField()
    target_type = serializers.CharField(source="object_type", read_only=True)
    target_reference = serializers.CharField(source="object_reference", read_only=True)
    old_role = serializers.SerializerMethodField()
    new_role = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    scope = serializers.SerializerMethodField()
    scope_target = serializers.SerializerMethodField()
    permission_delta = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "event_type",
            "actor_name",
            "actor_role",
            "target_type",
            "target_reference",
            "hotel",
            "hotel_name",
            "old_role",
            "new_role",
            "role_code",
            "scope",
            "scope_target",
            "permission_delta",
            "description",
            "ip_address",
            "user_agent",
            "severity",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.user_id:
            return "Systeme"
        return obj.user.get_full_name() or obj.user.username

    def get_event_type(self, obj):
        return (
            obj.metadata.get("security_event")
            or obj.metadata.get("iam_action")
            or obj.action
        )

    def get_old_role(self, obj):
        return obj.old_values.get("platform_role") or obj.old_values.get("role") or ""

    def get_new_role(self, obj):
        return obj.new_values.get("platform_role") or obj.new_values.get("role") or ""

    def get_role_code(self, obj):
        return (
            obj.metadata.get("role_code")
            or obj.new_values.get("code")
            or obj.old_values.get("code")
            or ""
        )

    def get_scope(self, obj):
        return obj.metadata.get("scope") or ""

    def get_scope_target(self, obj):
        return obj.metadata.get("target_label") or ""

    def get_permission_delta(self, obj):
        old_codes = set(obj.old_values.get("permission_codes") or [])
        new_codes = set(obj.new_values.get("permission_codes") or [])
        metadata_codes = obj.metadata.get("permission_codes")
        if metadata_codes and not new_codes:
            new_codes = set(metadata_codes)
        return {
            "added": sorted(new_codes - old_codes),
            "removed": sorted(old_codes - new_codes),
            "total": len(new_codes),
        }
