from django.utils import timezone
from rest_framework import serializers

from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, PlatformLicense, PlatformModule, SubscriptionPlan
from apps.super_root.models import SuperRootPlatform
from apps.tenancy.models import Hotel, Organization
from apps.users.models import User


def _format_datetime(value):
    if not value:
        return ""
    return timezone.localtime(value).isoformat()


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "code",
            "name",
            "description",
            "monthly_price",
            "yearly_price",
            "max_hotels",
            "max_users",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SubscriptionPlanWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "code",
            "name",
            "description",
            "monthly_price",
            "yearly_price",
            "max_hotels",
            "max_users",
            "is_active",
        ]
        read_only_fields = ["id"]


class PlatformOrganizationWriteSerializer(serializers.ModelSerializer):
    platform_id = serializers.SlugRelatedField(
        source="platform",
        queryset=SuperRootPlatform.objects.all(),
        slug_field="slug",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "status",
            "is_active",
            "platform_id",
        ]
        read_only_fields = ["id"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom ne peut pas etre vide.")
        return value

    def validate_slug(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError("Le slug est requis.")
        if not value.replace("-", "").isalnum() or "_" in value or "--" in value or value.startswith("-") or value.endswith("-"):
            raise serializers.ValidationError(
                "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets."
            )
        qs = Organization.objects.filter(slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ce slug est deja utilise par une autre organisation.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "status" not in attrs and "is_active" in attrs:
            attrs["status"] = (
                Organization.Status.ACTIVE if attrs["is_active"] else Organization.Status.INACTIVE
            )
        if "status" in attrs:
            attrs["is_active"] = attrs["status"] == Organization.Status.ACTIVE
        return attrs


class PlatformHotelWriteSerializer(serializers.ModelSerializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
    )
    platform_id = serializers.SlugRelatedField(
        source="platform",
        queryset=SuperRootPlatform.objects.all(),
        slug_field="slug",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Hotel
        fields = [
            "id",
            "organization_id",
            "name",
            "code",
            "slug",
            "country",
            "city",
            "timezone",
            "currency",
            "is_active",
            "platform_id",
        ]
        read_only_fields = ["id"]


class PlatformHotelSubscriptionWriteSerializer(serializers.ModelSerializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
    )
    hotel_id = serializers.PrimaryKeyRelatedField(
        source="hotel",
        queryset=Hotel.objects.select_related("organization"),
    )
    plan_id = serializers.PrimaryKeyRelatedField(
        source="plan",
        queryset=SubscriptionPlan.objects.filter(is_active=True),
    )

    class Meta:
        model = HotelSubscription
        fields = [
            "id",
            "organization_id",
            "hotel_id",
            "plan_id",
            "status",
            "starts_at",
            "ends_at",
            "trial_ends_at",
            "billing_cycle",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        hotel = attrs.get("hotel", getattr(self.instance, "hotel", None))
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        status = attrs.get("status", getattr(self.instance, "status", None))
        trial_ends_at = attrs.get("trial_ends_at", getattr(self.instance, "trial_ends_at", None))

        if hotel and organization and hotel.organization_id != organization.id:
            raise serializers.ValidationError(
                {"hotel_id": ["L'hotel selectionne doit appartenir a l'organisation choisie."]}
            )

        if status == HotelSubscription.Status.TRIAL and not trial_ends_at:
            raise serializers.ValidationError(
                {"trial_ends_at": ["Une date de fin d'essai est requise pour un abonnement en essai."]}
            )

        return attrs


class PlatformHotelAdminOnboardingSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)


class PlatformSecurityReviewSerializer(serializers.Serializer):
    target_type = serializers.CharField(max_length=50)
    target_id = serializers.IntegerField(required=False, allow_null=True)
    target_label = serializers.CharField(max_length=150)
    note = serializers.CharField()
    severity = serializers.ChoiceField(
        choices=[
            ("info", "Info"),
            ("warning", "Warning"),
            ("critical", "Critical"),
        ],
        default="info",
    )


class PlatformSubscriptionLifecycleRunSerializer(serializers.Serializer):
    run = serializers.BooleanField(default=True)


class PlatformSubscriptionRenewSerializer(serializers.Serializer):
    duration_days = serializers.IntegerField(min_value=1, max_value=3650)
    note = serializers.CharField(required=False, allow_blank=True)


class PlatformSubscriptionPlanChangeSerializer(serializers.Serializer):
    plan_id = serializers.PrimaryKeyRelatedField(
        source="plan",
        queryset=SubscriptionPlan.objects.filter(is_active=True),
    )
    note = serializers.CharField(required=False, allow_blank=True)


class PlatformModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformModule
        fields = [
            "id",
            "code",
            "name",
            "description",
            "monthly_license_price",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PlatformModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformModule
        fields = ["id", "code", "name", "description", "monthly_license_price", "is_active"]
        read_only_fields = ["id"]

    def validate_code(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError("Le code module est requis.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom du module est requis.")
        return value


class PlatformLicenseSerializer(serializers.ModelSerializer):
    module_code = serializers.CharField(source="module.code", read_only=True)
    module_name = serializers.CharField(source="module.name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    is_valid = serializers.BooleanField(source="is_valid_now", read_only=True)

    class Meta:
        model = PlatformLicense
        fields = [
            "id",
            "module",
            "module_code",
            "module_name",
            "organization",
            "organization_name",
            "hotel",
            "hotel_name",
            "status",
            "starts_at",
            "ends_at",
            "monthly_price",
            "is_valid",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PlatformLicenseWriteSerializer(serializers.ModelSerializer):
    module_id = serializers.PrimaryKeyRelatedField(
        source="module",
        queryset=PlatformModule.objects.all(),
    )
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

    class Meta:
        model = PlatformLicense
        fields = [
            "id",
            "module_id",
            "organization_id",
            "hotel_id",
            "status",
            "starts_at",
            "ends_at",
            "monthly_price",
            "notes",
        ]
        read_only_fields = ["id"]
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        hotel = attrs.get("hotel", getattr(self.instance, "hotel", None))
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))

        if not hotel and not organization:
            raise serializers.ValidationError({"organization_id": ["Une licence doit cibler une organisation ou un hotel."]})
        if hotel and organization and hotel.organization_id != organization.id:
            raise serializers.ValidationError({"hotel_id": ["L'hotel doit appartenir a l'organisation de la licence."]})
        if starts_at and ends_at and ends_at < starts_at:
            raise serializers.ValidationError({"ends_at": ["La date d'expiration ne peut pas preceder la date de debut."]})
        return attrs


class PlatformLicenseRenewSerializer(serializers.Serializer):
    ends_at = serializers.DateTimeField()
    note = serializers.CharField(required=False, allow_blank=True)


class PlatformModuleAccessCheckSerializer(serializers.Serializer):
    module_code = serializers.CharField(max_length=60)
    organization_id = serializers.IntegerField(required=False, allow_null=True)
    hotel_id = serializers.IntegerField(required=False, allow_null=True)


class PlatformAdminUserWriteSerializer(serializers.Serializer):
    WEAK_PASSWORD_TERMS = ("password", "admin", "afrivo", "123456")

    class AdminScope:
        PLATFORM = "platform"
        ORGANIZATION = "organization"
        HOTEL = "hotel"

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    admin_scope = serializers.ChoiceField(choices=[AdminScope.PLATFORM, AdminScope.ORGANIZATION, AdminScope.HOTEL])
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
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom d'utilisateur est requis.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur existe deja.")
        return value

    def validate_email(self, value):
        value = (value or "").strip()
        if not value:
            return ""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Cet email est deja utilise par un autre utilisateur.")
        return value

    def validate_password(self, value):
        errors = []
        if len(value) < 8:
            errors.append("Le mot de passe doit contenir au moins 8 caracteres.")
        if not any(char.isupper() for char in value):
            errors.append("Le mot de passe doit contenir au moins une majuscule.")
        if not any(char.islower() for char in value):
            errors.append("Le mot de passe doit contenir au moins une minuscule.")
        if not any(char.isdigit() for char in value):
            errors.append("Le mot de passe doit contenir au moins un chiffre.")
        if not any(not char.isalnum() for char in value):
            errors.append("Le mot de passe doit contenir au moins un caractere special.")
        lower_value = value.lower()
        for term in self.WEAK_PASSWORD_TERMS:
            if term in lower_value:
                errors.append("Le mot de passe contient un terme trop faible ou interdit.")
                break
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        scope = attrs.get("admin_scope")
        organization = attrs.get("organization")
        hotel = attrs.get("hotel")
        username = (attrs.get("username") or "").lower()
        password = (attrs.get("password") or "").lower()

        if username and username in password:
            raise serializers.ValidationError({"password": ["Le mot de passe ne doit pas contenir le username."]})

        if scope == self.AdminScope.PLATFORM:
            attrs["organization"] = None
            attrs["hotel"] = None
            return attrs

        if scope == self.AdminScope.ORGANIZATION:
            if not organization:
                raise serializers.ValidationError({"organization_id": ["L'organisation est requise pour un Admin Organisation."]})
            attrs["hotel"] = None
            return attrs

        if scope == self.AdminScope.HOTEL:
            if not hotel:
                raise serializers.ValidationError({"hotel_id": ["L'hotel est requis pour un Admin Hotel."]})
            if organization and hotel.organization_id != organization.id:
                raise serializers.ValidationError({
                    "organization_id": ["L'organisation est rattachee automatiquement a partir de l'hotel selectionne."]
                })
            attrs["organization"] = hotel.organization

        return attrs


class PlatformAdminUserUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)

    def validate(self, attrs):
        user = self.context.get("target_user")
        if user and user.is_superuser and not user.is_platform_admin:
            raise serializers.ValidationError("Le Super Admin Plateforme ne peut pas modifier le Super Root.")
        return attrs


class PlatformAdminUserResetAccessSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        user = self.context.get("target_user")
        if user and user.is_superuser and not user.is_platform_admin:
            raise serializers.ValidationError("Le Super Admin Plateforme ne peut pas reinitialiser le Super Root.")
        return attrs


class PlatformOnboardingBundleSerializer(serializers.Serializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
        required=False,
        allow_null=True,
    )
    organization_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    organization_slug = serializers.CharField(required=False, allow_blank=True, max_length=160)
    hotel_name = serializers.CharField(max_length=150)
    hotel_code = serializers.CharField(max_length=40)
    hotel_slug = serializers.CharField(max_length=160)
    country = serializers.CharField(required=False, allow_blank=True, max_length=100)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    timezone_name = serializers.CharField(required=False, allow_blank=True, max_length=64, default="Atlantic/Reykjavik")
    currency = serializers.CharField(required=False, allow_blank=True, max_length=3, default="XOF")
    admin_username = serializers.CharField(max_length=150)
    admin_password = serializers.CharField(write_only=True, min_length=6)
    admin_first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    admin_last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    admin_email = serializers.EmailField(required=False, allow_blank=True)
    admin_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    plan_id = serializers.PrimaryKeyRelatedField(
        source="plan",
        queryset=SubscriptionPlan.objects.filter(is_active=True),
    )
    subscription_status = serializers.ChoiceField(choices=HotelSubscription.Status.choices, default=HotelSubscription.Status.TRIAL)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    trial_ends_at = serializers.DateTimeField(required=False, allow_null=True)
    billing_cycle = serializers.ChoiceField(choices=HotelSubscription.BillingCycle.choices, default=HotelSubscription.BillingCycle.MONTHLY)
    subscription_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        organization = attrs.get("organization")
        if organization is None:
            if not attrs.get("organization_name"):
                raise serializers.ValidationError({"organization_name": ["Le nom de l'organisation est requis."]})
            if not attrs.get("organization_slug"):
                raise serializers.ValidationError({"organization_slug": ["Le slug de l'organisation est requis."]})

        if attrs.get("subscription_status") == HotelSubscription.Status.TRIAL and not attrs.get("trial_ends_at"):
            raise serializers.ValidationError(
                {"trial_ends_at": ["Une date de fin d'essai est requise pour un onboarding en essai."]}
            )

        return attrs


class HotelSubscriptionSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    hotel_code = serializers.CharField(source="hotel.code", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    billing_cycle_label = serializers.CharField(source="get_billing_cycle_display", read_only=True)
    starts_at_display = serializers.SerializerMethodField()
    ends_at_display = serializers.SerializerMethodField()
    trial_ends_at_display = serializers.SerializerMethodField()
    plan_max_hotels = serializers.IntegerField(source="plan.max_hotels", read_only=True)
    plan_max_users = serializers.IntegerField(source="plan.max_users", read_only=True)
    active_user_count = serializers.IntegerField(read_only=True)
    user_quota_status = serializers.SerializerMethodField()

    class Meta:
        model = HotelSubscription
        fields = [
            "id",
            "organization",
            "organization_name",
            "hotel",
            "hotel_name",
            "hotel_code",
            "plan",
            "plan_name",
            "status",
            "status_label",
            "starts_at",
            "starts_at_display",
            "ends_at",
            "ends_at_display",
            "trial_ends_at",
            "trial_ends_at_display",
            "billing_cycle",
            "billing_cycle_label",
            "plan_max_hotels",
            "plan_max_users",
            "active_user_count",
            "user_quota_status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_starts_at_display(self, obj):
        return _format_datetime(obj.starts_at)

    def get_ends_at_display(self, obj):
        return _format_datetime(obj.ends_at)

    def get_trial_ends_at_display(self, obj):
        return _format_datetime(obj.trial_ends_at)

    def get_user_quota_status(self, obj):
        max_users = getattr(obj.plan, "max_users", 0) or 0
        active_user_count = getattr(obj, "active_user_count", 0) or 0
        if not max_users:
            return "unlimited"
        if active_user_count > max_users:
            return "critical"
        if active_user_count >= max_users * 0.8:
            return "warning"
        return "healthy"


class PlatformOrganizationSerializer(serializers.ModelSerializer):
    hotel_count = serializers.IntegerField(read_only=True)
    active_hotel_count = serializers.IntegerField(read_only=True)
    user_count = serializers.IntegerField(read_only=True)
    hotel_admin_count = serializers.IntegerField(read_only=True)
    active_subscription_count = serializers.IntegerField(read_only=True)
    platform_id = serializers.CharField(source="platform.slug", read_only=True)
    platform_name = serializers.CharField(source="platform.name", read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "status",
            "is_active",
            "platform_id",
            "platform_name",
            "hotel_count",
            "active_hotel_count",
            "user_count",
            "hotel_admin_count",
            "active_subscription_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PlatformHotelSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    platform_id = serializers.SerializerMethodField()
    platform_name = serializers.SerializerMethodField()
    subscription_status = serializers.CharField(source="subscription.status", read_only=True)
    subscription_status_label = serializers.CharField(source="subscription.get_status_display", read_only=True)
    subscription_plan_name = serializers.CharField(source="subscription.plan.name", read_only=True)
    subscription_plan_max_users = serializers.IntegerField(source="subscription.plan.max_users", read_only=True)
    subscription_plan_max_hotels = serializers.IntegerField(source="subscription.plan.max_hotels", read_only=True)
    active_user_count = serializers.IntegerField(read_only=True)
    hotel_admin_count = serializers.IntegerField(read_only=True)
    user_quota_status = serializers.SerializerMethodField()

    class Meta:
        model = Hotel
        fields = [
            "id",
            "organization",
            "organization_name",
            "platform_id",
            "platform_name",
            "name",
            "code",
            "slug",
            "country",
            "city",
            "timezone",
            "currency",
            "is_active",
            "subscription_status",
            "subscription_status_label",
            "subscription_plan_name",
            "subscription_plan_max_users",
            "subscription_plan_max_hotels",
            "active_user_count",
            "hotel_admin_count",
            "user_quota_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_platform_id(self, obj):
        if getattr(obj, "platform_id", None):
            return obj.platform.slug
        if getattr(obj.organization, "platform_id", None):
            return obj.organization.platform.slug
        return ""

    def get_platform_name(self, obj):
        if getattr(obj, "platform_id", None):
            return obj.platform.name
        if getattr(obj.organization, "platform_id", None):
            return obj.organization.platform.name
        return "AFRIVO Default"

    def get_user_quota_status(self, obj):
        max_users = getattr(getattr(obj, "subscription", None), "plan", None)
        max_users = getattr(max_users, "max_users", 0) or 0
        active_user_count = getattr(obj, "active_user_count", 0) or 0
        if not max_users:
            return "unlimited"
        if active_user_count > max_users:
            return "critical"
        if active_user_count >= max_users * 0.8:
            return "warning"
        return "healthy"


class PlatformUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    admin_scope = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "role_label",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_platform_admin",
            "organization",
            "organization_name",
            "hotel",
            "hotel_name",
            "admin_scope",
            "date_joined",
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name().strip() or obj.username

    def get_admin_scope(self, obj):
        if obj.is_platform_admin:
            return "platform"
        if obj.role == User.Role.ADMIN and obj.hotel_id:
            return "hotel"
        if obj.role == User.Role.ADMIN and obj.organization_id:
            return "organization"
        return "none"


class PlatformAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    event_label = serializers.CharField(source="get_event_type_display", read_only=True)
    created_at_display = serializers.SerializerMethodField()

    class Meta:
        model = PlatformAuditEvent
        fields = [
            "id",
            "event_type",
            "event_label",
            "target_type",
            "target_id",
            "target_label",
            "metadata",
            "actor",
            "actor_name",
            "created_at",
            "created_at_display",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return "Systeme"
        return obj.actor.get_full_name().strip() or obj.actor.username

    def get_created_at_display(self, obj):
        return _format_datetime(obj.created_at)


class HotelPlatformCardSerializer(serializers.ModelSerializer):
    nom = serializers.CharField(source="name", read_only=True)
    pays = serializers.CharField(source="country", read_only=True)
    ville = serializers.CharField(source="city", read_only=True)
    fuseau_horaire = serializers.CharField(source="timezone", read_only=True)
    devise = serializers.CharField(source="currency", read_only=True)
    organisation_nom = serializers.CharField(source="organization.name", read_only=True)
    utilisateurs_actifs = serializers.SerializerMethodField()
    quota_plan = serializers.SerializerMethodField()
    quota_pct = serializers.SerializerMethodField()
    quota_statut = serializers.SerializerMethodField()
    plan_nom = serializers.SerializerMethodField()
    plan_sans_limite = serializers.SerializerMethodField()
    admins_count = serializers.SerializerMethodField()
    statut = serializers.SerializerMethodField()
    statut_display = serializers.SerializerMethodField()
    initiales = serializers.SerializerMethodField()
    alerte = serializers.SerializerMethodField()

    def get_utilisateurs_actifs(self, obj):
        annotated = getattr(obj, "active_user_count", None)
        if annotated is not None:
            return annotated
        try:
            return obj.users.filter(is_active=True).count()
        except Exception:
            return 0

    def get_quota_plan(self, obj):
        plan = getattr(getattr(obj, "subscription", None), "plan", None)
        quota = getattr(plan, "max_users", None)
        return quota or None

    def get_quota_pct(self, obj):
        quota = self.get_quota_plan(obj)
        if not quota:
            return 0
        actifs = self.get_utilisateurs_actifs(obj)
        return min(100, round((actifs / quota) * 100))

    def get_quota_statut(self, obj):
        quota = self.get_quota_plan(obj)
        if quota is None:
            return "sans_limite"
        pct = self.get_quota_pct(obj)
        if pct >= 90:
            return "critique"
        if pct >= 60:
            return "attention"
        return "sain"

    def get_plan_nom(self, obj):
        plan = getattr(getattr(obj, "subscription", None), "plan", None)
        return getattr(plan, "name", None) or "Starter"

    def get_plan_sans_limite(self, obj):
        return self.get_quota_plan(obj) is None

    def get_admins_count(self, obj):
        annotated = getattr(obj, "hotel_admin_count", None)
        if annotated is not None:
            return annotated
        try:
            return obj.users.filter(role=User.Role.ADMIN, is_platform_admin=False, is_active=True).count()
        except Exception:
            return 0

    def get_statut(self, obj):
        return "actif" if getattr(obj, "is_active", False) else "suspendu"

    def get_statut_display(self, obj):
        return "Actif" if getattr(obj, "is_active", False) else "Suspendu"

    def get_initiales(self, obj):
        nom = getattr(obj, "name", "") or ""
        parts = nom.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[1][0]).upper()
        return nom[:2].upper() if nom else "??"

    def get_alerte(self, obj):
        admins = self.get_admins_count(obj)
        quota_statut = self.get_quota_statut(obj)
        actifs = self.get_utilisateurs_actifs(obj)
        quota = self.get_quota_plan(obj)

        if quota_statut == "critique":
            return {"type": "critique", "msg": f"Quota critique - {actifs}/{quota} utilisateurs"}
        if admins == 0:
            return {"type": "warning", "msg": "Aucun admin hotel assigne"}
        if quota_statut == "attention":
            return {"type": "warning", "msg": f"Quota attention - {actifs}/{quota} utilisateurs"}
        return None

    class Meta:
        model = Hotel
        fields = [
            "id",
            "nom",
            "code",
            "slug",
            "statut",
            "statut_display",
            "pays",
            "ville",
            "fuseau_horaire",
            "devise",
            "organisation_nom",
            "utilisateurs_actifs",
            "quota_plan",
            "quota_pct",
            "quota_statut",
            "plan_nom",
            "plan_sans_limite",
            "admins_count",
            "initiales",
            "alerte",
        ]


class PlatformHotelDashboardSerializer(serializers.Serializer):
    hotels_total = serializers.IntegerField()
    hotels_actifs = serializers.IntegerField()
    hotels_suspendus = serializers.IntegerField()
    admins_total = serializers.IntegerField()
    utilisateurs_total = serializers.IntegerField()
    quota_critique_count = serializers.IntegerField()
    hotels = HotelPlatformCardSerializer(many=True)
    alertes = serializers.ListField()
    stats_plans = serializers.DictField()
    stats_quota = serializers.DictField()


class PlatformCommandCenterSerializer(serializers.Serializer):
    score_sante = serializers.IntegerField()
    score_label = serializers.CharField()
    score_description = serializers.CharField()
    organisations_total = serializers.IntegerField()
    hotels_actifs = serializers.IntegerField()
    hotels_inactifs = serializers.IntegerField()
    abonnements_total = serializers.IntegerField()
    admins_plateforme = serializers.IntegerField()
    admins_hotels = serializers.IntegerField()
    quota_critique_count = serializers.IntegerField()
    abonnements_actifs = serializers.IntegerField()
    abonnements_essai = serializers.IntegerField()
    abonnements_suspendus = serializers.IntegerField()
    abonnements_expires = serializers.IntegerField()
    taux_retention_pct = serializers.FloatField()
    checklist = serializers.ListField()
    events = serializers.ListField()
    essais_expirants_7j = serializers.IntegerField()
    contrats_a_renouveler = serializers.IntegerField()
    hotels_proche_quota = serializers.IntegerField()
    hotels_hors_quota = serializers.IntegerField()


class ClientSaaSCommandCardSerializer(serializers.ModelSerializer):
    nom = serializers.CharField(source="name", read_only=True)
    statut = serializers.CharField(source="status", read_only=True)
    hotels_count = serializers.SerializerMethodField()
    admins_count = serializers.SerializerMethodField()
    abonnements_actifs = serializers.SerializerMethodField()
    utilisateurs_actifs = serializers.SerializerMethodField()
    quota_plan = serializers.SerializerMethodField()
    quota_pct = serializers.SerializerMethodField()
    plan_nom = serializers.SerializerMethodField()
    plan_sans_limite = serializers.SerializerMethodField()
    statut_display = serializers.SerializerMethodField()
    initiales = serializers.SerializerMethodField()
    sante_statut = serializers.SerializerMethodField()
    sante_label = serializers.SerializerMethodField()
    alerte = serializers.SerializerMethodField()

    def _active_subscriptions(self, obj):
        try:
            return obj.hotel_subscriptions.filter(status=HotelSubscription.Status.ACTIVE)
        except Exception:
            return HotelSubscription.objects.none()

    def get_hotels_count(self, obj):
        annotated = getattr(obj, "hotel_count", None)
        if annotated is not None:
            return annotated
        try:
            return obj.hotels.count()
        except Exception:
            return 0

    def get_admins_count(self, obj):
        annotated = getattr(obj, "hotel_admin_count", None)
        if annotated is not None:
            return annotated
        try:
            return obj.users.filter(role=User.Role.ADMIN, is_platform_admin=False, is_active=True).count()
        except Exception:
            return 0

    def get_abonnements_actifs(self, obj):
        annotated = getattr(obj, "active_subscription_count", None)
        if annotated is not None:
            return annotated
        return self._active_subscriptions(obj).count()

    def get_utilisateurs_actifs(self, obj):
        annotated = getattr(obj, "active_user_count", None)
        if annotated is not None:
            return annotated
        try:
            return obj.users.filter(is_active=True).count()
        except Exception:
            return 0

    def get_quota_plan(self, obj):
        quota = 0
        has_active_plan = False
        for subscription in self._active_subscriptions(obj).select_related("plan"):
            plan_quota = getattr(subscription.plan, "max_users", None)
            if plan_quota:
                quota += plan_quota
                has_active_plan = True
        return quota if has_active_plan else None

    def get_quota_pct(self, obj):
        quota = self.get_quota_plan(obj)
        if not quota:
            return 0
        actifs = self.get_utilisateurs_actifs(obj)
        return min(100, round((actifs / quota) * 100))

    def get_plan_nom(self, obj):
        subscriptions = list(self._active_subscriptions(obj).select_related("plan")[:2])
        if not subscriptions:
            return "Aucun"
        first_name = getattr(subscriptions[0].plan, "name", None) or "Starter"
        total = self.get_abonnements_actifs(obj)
        return f"{first_name} +{total - 1}" if total > 1 else first_name

    def get_plan_sans_limite(self, obj):
        return self.get_quota_plan(obj) is None

    def get_statut_display(self, obj):
        mapping = {
            Organization.Status.ACTIVE: "Active",
            Organization.Status.SUSPENDED: "Suspendue",
            Organization.Status.INACTIVE: "Inactive",
        }
        return mapping.get(getattr(obj, "status", ""), getattr(obj, "status", ""))

    def get_initiales(self, obj):
        nom = getattr(obj, "name", "") or ""
        parts = nom.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[1][0]).upper()
        return nom[:2].upper() if nom else "??"

    def _compute_sante(self, obj):
        if getattr(obj, "status", "") != Organization.Status.ACTIVE or not getattr(obj, "is_active", False):
            return "critique", "Organisation suspendue"
        admins = self.get_admins_count(obj)
        hotels = self.get_hotels_count(obj)
        if admins == 0 and hotels > 0:
            return "attention", "Aucun admin hotel assigne"
        quota_pct = self.get_quota_pct(obj)
        if quota_pct >= 90:
            return "critique", f"Quota critique - {quota_pct}% utilise"
        if quota_pct >= 60:
            return "attention", f"Quota attention - {quota_pct}% utilise"
        if self.get_abonnements_actifs(obj) == 0 and hotels > 0:
            return "attention", "Aucun abonnement actif"
        return "sain", None

    def get_sante_statut(self, obj):
        statut, _ = self._compute_sante(obj)
        return statut

    def get_sante_label(self, obj):
        statut, _ = self._compute_sante(obj)
        return {"sain": "Sain", "attention": "Attention", "critique": "Critique"}[statut]

    def get_alerte(self, obj):
        statut, reason = self._compute_sante(obj)
        if statut == "sain":
            return None
        return {"type": statut, "message": reason}

    class Meta:
        model = Organization
        fields = [
            "id",
            "nom",
            "slug",
            "statut",
            "statut_display",
            "initiales",
            "hotels_count",
            "admins_count",
            "abonnements_actifs",
            "utilisateurs_actifs",
            "quota_plan",
            "quota_pct",
            "plan_nom",
            "plan_sans_limite",
            "sante_statut",
            "sante_label",
            "alerte",
        ]


class ClientSaaSCommandCenterSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    actives = serializers.IntegerField()
    suspendues = serializers.IntegerField()
    hotels_total = serializers.IntegerField()
    abonnements_actifs = serializers.IntegerField()
    score_sante = serializers.IntegerField()
    score_label = serializers.CharField()
    score_description = serializers.CharField()
    clients = serializers.ListField()
    checklist = serializers.ListField()


class ModuleCommandCardSerializer(serializers.ModelSerializer):
    hotels_abonnes = serializers.SerializerMethodField()
    taux_adoption_pct = serializers.SerializerMethodField()
    sante_statut = serializers.SerializerMethodField()
    sante_label = serializers.SerializerMethodField()
    initiales = serializers.SerializerMethodField()
    statut_display = serializers.SerializerMethodField()
    prix_display = serializers.SerializerMethodField()
    updated_at_display = serializers.SerializerMethodField()

    def _get_total_hotels(self):
        try:
            return max(Hotel.objects.count(), 1)
        except Exception:
            return 1

    def get_hotels_abonnes(self, obj):
        try:
            return obj.licenses.filter(
                status=PlatformLicense.Status.ACTIVE,
                hotel__isnull=False,
            ).values("hotel").distinct().count()
        except Exception:
            return 0

    def get_taux_adoption_pct(self, obj):
        hotels_abonnes = self.get_hotels_abonnes(obj)
        total = self._get_total_hotels()
        return min(100, round((hotels_abonnes / total) * 100))

    def get_sante_statut(self, obj):
        if not getattr(obj, "is_active", False):
            return "inactif"
        pct = self.get_taux_adoption_pct(obj)
        return "sain" if pct >= 20 else "attention"

    def get_sante_label(self, obj):
        return {
            "sain": "Sain",
            "attention": "Attention",
            "inactif": "Inactif",
        }.get(self.get_sante_statut(obj), "Sain")

    def get_initiales(self, obj):
        name = getattr(obj, "name", "") or ""
        parts = name.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[1][0]).upper()
        return name[:2].upper() if name else "??"

    def get_statut_display(self, obj):
        return "Actif" if getattr(obj, "is_active", False) else "Inactif"

    def get_prix_display(self, obj):
        try:
            return f"{float(obj.monthly_license_price):.2f} XOF"
        except Exception:
            return "0.00 XOF"

    def get_updated_at_display(self, obj):
        if obj.updated_at:
            return obj.updated_at.strftime("%d/%m/%Y")
        return "-"

    class Meta:
        model = PlatformModule
        fields = [
            "id",
            "name",
            "code",
            "description",
            "monthly_license_price",
            "is_active",
            "hotels_abonnes",
            "taux_adoption_pct",
            "sante_statut",
            "sante_label",
            "initiales",
            "statut_display",
            "prix_display",
            "updated_at_display",
        ]


class ModuleCommandCenterSerializer(serializers.Serializer):
    modules_total = serializers.IntegerField()
    modules_actifs = serializers.IntegerField()
    modules_inactifs = serializers.IntegerField()
    hotels_abonnes_total = serializers.IntegerField()
    taux_adoption_moyen = serializers.FloatField()
    score_catalogue = serializers.IntegerField()
    score_label = serializers.CharField()
    score_description = serializers.CharField()
    modules = serializers.ListField()
    adoption_stats = serializers.ListField()
    checklist = serializers.ListField()
