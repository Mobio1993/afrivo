from rest_framework import serializers

from apps.super_root.models import SuperRootPlatform


class SuperRootMaintenanceRunSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["subscription_lifecycle", "healthcheck"])
    dry_run = serializers.BooleanField(required=False, default=True)
    confirmation = serializers.DictField(required=False, default=dict)


class SuperRootReadOnlyPayloadSerializer(serializers.Serializer):
    generated_at = serializers.CharField(required=False)
    scope = serializers.CharField(required=False)


class SuperRootPlatformCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuperRootPlatform
        fields = [
            "name",
            "slug",
            "code",
            "domain_url",
            "environment",
            "region",
            "owner_email",
            "notes",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "code": {"required": False, "allow_blank": True},
            "domain_url": {"required": False, "allow_blank": True},
            "environment": {"required": False, "allow_blank": True},
            "region": {"required": False, "allow_blank": True},
            "owner_email": {"required": False, "allow_blank": True},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate_name(self, value):
        value = (value or "").strip()
        if len(value) < 3:
            raise serializers.ValidationError("Le nom de plateforme doit contenir au moins 3 caracteres.")
        return value

    def validate_environment(self, value):
        value = (value or "production").strip().lower()
        allowed = {"production", "staging", "sandbox", "development"}
        if value not in allowed:
            raise serializers.ValidationError("Environnement invalide.")
        return value
