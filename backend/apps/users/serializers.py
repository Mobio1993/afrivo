from rest_framework import serializers

from apps.tenancy.models import Hotel, Organization
from apps.users.access import build_user_permission_map
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, style={"input_type": "password"})
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
        required=False,
        allow_null=True,
    )
    hotel_id = serializers.PrimaryKeyRelatedField(
        source="hotel",
        queryset=Hotel.objects.select_related("organization"),
        required=False,
        allow_null=True,
    )
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    is_platform_admin = serializers.BooleanField(required=False)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "role_label",
            "is_active",
            "is_platform_admin",
            "organization_id",
            "organization_name",
            "hotel_id",
            "hotel_name",
            "permissions",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)

        hotel = attrs.get("hotel", getattr(self.instance, "hotel", None))
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        is_platform_admin = attrs.get("is_platform_admin", getattr(self.instance, "is_platform_admin", False))

        if hotel and organization and hotel.organization_id != organization.id:
            raise serializers.ValidationError(
                {"hotel_id": ["L'hotel selectionne doit appartenir a la meme organisation."]}
            )

        if actor and getattr(actor, "is_authenticated", False) and not getattr(actor, "is_superuser", False):
            if is_platform_admin and not getattr(actor, "is_platform_admin", False):
                raise serializers.ValidationError(
                    {"is_platform_admin": ["Seul un administrateur plateforme peut attribuer ce niveau d'acces."]}
                )
            if actor.hotel_id:
                if is_platform_admin:
                    raise serializers.ValidationError(
                        {"is_platform_admin": ["Un administrateur hotel ne peut pas creer un administrateur plateforme."]}
                    )
                if hotel and hotel.id != actor.hotel_id:
                    raise serializers.ValidationError(
                        {"hotel_id": ["Un administrateur d'hotel ne peut gerer que les utilisateurs de son hotel."]}
                    )
                attrs["hotel"] = actor.hotel
                attrs["organization"] = actor.hotel.organization
            elif actor.organization_id:
                if is_platform_admin:
                    raise serializers.ValidationError(
                        {"is_platform_admin": ["Ce compte ne peut pas creer un administrateur plateforme."]}
                    )
                if hotel and hotel.organization_id != actor.organization_id:
                    raise serializers.ValidationError(
                        {"hotel_id": ["L'hotel selectionne doit appartenir a votre organisation."]}
                    )
                if organization and organization.id != actor.organization_id:
                    raise serializers.ValidationError(
                        {"organization_id": ["Vous ne pouvez gerer que les utilisateurs de votre organisation."]}
                    )
                attrs["organization"] = actor.organization

        if is_platform_admin:
            attrs["organization"] = None
            attrs["hotel"] = None
            attrs["role"] = User.Role.ADMIN

        password = attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": ["Le mot de passe est obligatoire a la creation."]})

        return attrs

    def get_permissions(self, obj):
        return build_user_permission_map(obj)

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
