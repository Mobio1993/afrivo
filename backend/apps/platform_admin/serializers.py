from django.utils import timezone
from rest_framework import serializers

from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, SubscriptionPlan
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
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "is_active",
        ]
        read_only_fields = ["id"]


class PlatformHotelWriteSerializer(serializers.ModelSerializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        source="organization",
        queryset=Organization.objects.all(),
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

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "is_active",
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
        if obj.is_hotel_admin:
            return "hotel"
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
