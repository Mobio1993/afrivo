from rest_framework import serializers
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError

from apps.iam.models import User
from apps.iam.services.permission_service import PermissionService
from apps.super_root.services.security_policy_service import SuperRootSecurityPolicyService
from apps.tenants.hotels.models import Hotel
from apps.tenants.organizations.models import Organization


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
    business_permissions = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "public_id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "email_verified",
            "phone_verified",
            "role",
            "role_label",
            "is_active",
            "is_platform_admin",
            "platform_role",
            "organization_id",
            "organization_name",
            "hotel_id",
            "hotel_name",
            "permissions",
            "business_permissions",
            "initials",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "public_id", "initials", "date_joined", "last_login")

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)

        hotel = attrs.get("hotel", getattr(self.instance, "hotel", None))
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        is_platform_admin = attrs.get("is_platform_admin", getattr(self.instance, "is_platform_admin", False))
        platform_role = attrs.get("platform_role", getattr(self.instance, "platform_role", User.PlatformRole.NONE))
        is_superuser = attrs.get("is_superuser", getattr(self.instance, "is_superuser", False))

        if hotel and organization and hotel.organization_id != organization.id:
            raise serializers.ValidationError(
                {"hotel_id": ["L'hotel selectionne doit appartenir a la meme organisation."]}
            )

        if actor and getattr(actor, "is_authenticated", False) and not getattr(actor, "is_superuser", False):
            if is_platform_admin and not getattr(actor, "is_platform_admin", False):
                raise serializers.ValidationError(
                    {"is_platform_admin": ["Seul un administrateur plateforme peut attribuer ce niveau d'acces."]}
                )
            if is_platform_admin and not getattr(actor, "is_super_admin_platform", False):
                raise serializers.ValidationError(
                    {"platform_role": ["Seul un Super Admin Plateforme peut gerer les administrateurs plateforme."]}
                )
            assigns_super_admin = (
                attrs.get("platform_role") == User.PlatformRole.SUPER_ADMIN
                or (self.instance is None and is_platform_admin and platform_role == User.PlatformRole.SUPER_ADMIN)
            )
            if assigns_super_admin and not getattr(actor, "is_super_root", False):
                raise serializers.ValidationError(
                    {"platform_role": ["Seul le Super Root peut attribuer le role Super Admin Plateforme."]}
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
            if attrs.get("platform_role", platform_role) == User.PlatformRole.NONE:
                attrs["platform_role"] = User.PlatformRole.PLATFORM_ADMIN

        if actor and getattr(actor, "is_authenticated", False):
            target = User()
            if self.instance is not None:
                target.pk = self.instance.pk
                target.is_superuser = self.instance.is_superuser
                target.is_active = self.instance.is_active
                target.role = self.instance.role
                target.organization = self.instance.organization
                target.hotel = self.instance.hotel
                target.is_platform_admin = self.instance.is_platform_admin
                target.platform_role = self.instance.platform_role
            for field in ("role", "organization", "hotel", "is_platform_admin", "platform_role", "is_active"):
                if field in attrs:
                    setattr(target, field, attrs[field])
            if not PermissionService.can_manage_user(actor, target):
                raise serializers.ValidationError(
                    {"non_field_errors": ["Vous ne pouvez pas gerer un compte de niveau egal ou superieur."]}
                )
            if SuperRootSecurityPolicyService.values_would_be_super_root(
                target_user=self.instance,
                values={
                    "is_superuser": is_superuser,
                    "is_platform_admin": attrs.get("is_platform_admin", is_platform_admin),
                    "is_active": attrs.get("is_active", getattr(self.instance, "is_active", True)),
                },
            ):
                try:
                    SuperRootSecurityPolicyService.validate_user_super_root_mutation(
                        actor,
                        target_user=self.instance,
                        values={
                            "is_superuser": is_superuser,
                            "is_platform_admin": attrs.get("is_platform_admin", is_platform_admin),
                            "is_active": attrs.get("is_active", getattr(self.instance, "is_active", True)),
                        },
                        confirmation=self.initial_data.get("confirmation") if hasattr(self, "initial_data") else None,
                        request=request,
                    )
                except (PermissionDenied, DjangoValidationError) as exc:
                    raise serializers.ValidationError({"is_superuser": [str(exc)]}) from exc

        password = attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": ["Le mot de passe est obligatoire a la creation."]})

        return attrs

    def get_permissions(self, obj):
        return PermissionService.build_permission_map(obj)

    def get_business_permissions(self, obj):
        return sorted(PermissionService.build_business_action_set(obj))

    def get_initials(self, obj):
        full_name = obj.get_full_name().strip()
        parts = full_name.split() if full_name else [obj.username or "?"]
        return "".join(part[0].upper() for part in parts[:2] if part) or "?"

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
