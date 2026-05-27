import json
from io import StringIO
from datetime import timedelta

from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, PlatformLicense, PlatformModule, SubscriptionPlan
from apps.platform_admin.serializers import (
    HotelSubscriptionSerializer,
    PlatformAuditEventSerializer,
    PlatformHotelSerializer,
    PlatformLicenseSerializer,
    PlatformModuleSerializer,
    PlatformOrganizationSerializer,
    PlatformUserSerializer,
    SubscriptionPlanSerializer,
)
from apps.platform_admin.services import (
    build_platform_dashboard_payload,
    change_platform_subscription_plan,
    create_platform_audit_event,
    list_platform_admin_users,
    list_platform_hotels,
    list_platform_organizations,
    list_platform_subscriptions,
    onboard_platform_bundle,
    platform_module_access_allowed,
    process_subscription_lifecycle,
    renew_platform_subscription,
)
from apps.history.models import ActivityLog
from apps.tenancy.models import Hotel, Organization
from apps.tenancy.utils import module_license_is_active


User = get_user_model()


class PlatformAdminServicesTests(TestCase):
    def setUp(self):
        self.plan = SubscriptionPlan.objects.create(
            code="starter",
            name="Starter",
            monthly_price="49.00",
            yearly_price="490.00",
            max_hotels=2,
            max_users=15,
        )
        self.organization = Organization.objects.create(name="AFRIVO Group", slug="afrivo-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="AFRIVO Dakar",
            code="DKR-01",
            slug="afrivo-dakar",
        )
        self.subscription = HotelSubscription.objects.create(
            organization=self.organization,
            hotel=self.hotel,
            plan=self.plan,
            status=HotelSubscription.Status.ACTIVE,
        )
        self.platform_admin = User.objects.create_user(
            username="platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )
        self.hotel_admin = User.objects.create_user(
            username="hotel-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.reception = User.objects.create_user(
            username="frontdesk",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_dashboard_payload_returns_platform_counts(self):
        payload = build_platform_dashboard_payload()

        self.assertEqual(payload["summary_cards"][0]["value"], Organization.objects.count())
        self.assertEqual(payload["summary_cards"][1]["value"], Hotel.objects.filter(is_active=True).count())
        self.assertEqual(payload["summary_cards"][2]["value"], Hotel.objects.filter(is_active=False).count())
        self.assertEqual(
            payload["summary_cards"][3]["value"],
            HotelSubscription.objects.filter(status=HotelSubscription.Status.ACTIVE).count(),
        )
        self.assertEqual(
            payload["summary_cards"][4]["value"],
            User.objects.filter(is_platform_admin=True, is_active=True).count(),
        )

    def test_list_platform_organizations_returns_annotated_counts(self):
        organization = list_platform_organizations().get(pk=self.organization.pk)

        self.assertEqual(organization.hotel_count, 1)
        self.assertEqual(organization.active_hotel_count, 1)
        self.assertEqual(organization.user_count, 2)
        self.assertEqual(organization.hotel_admin_count, 1)
        self.assertEqual(organization.active_subscription_count, 1)

    def test_list_platform_hotels_returns_annotated_counts(self):
        hotel = list_platform_hotels().get(pk=self.hotel.pk)

        self.assertEqual(hotel.active_user_count, 2)
        self.assertEqual(hotel.hotel_admin_count, 1)

    def test_list_platform_subscriptions_returns_subscription_queryset(self):
        subscription = list_platform_subscriptions().get(pk=self.subscription.pk)

        self.assertEqual(subscription.plan_id, self.plan.id)
        self.assertEqual(subscription.hotel_id, self.hotel.id)

    def test_list_platform_admin_users_can_include_hotel_admins(self):
        admins = list_platform_admin_users(include_hotel_admins=True)

        self.assertEqual(admins.count(), 2)

    def test_create_platform_audit_event_uses_target_metadata(self):
        event = create_platform_audit_event(
            actor=self.platform_admin,
            event_type=PlatformAuditEvent.EventType.HOTEL_CREATED,
            target=self.hotel,
            metadata={"source": "test"},
        )

        self.assertEqual(event.target_type, "Hotel")
        self.assertEqual(event.target_id, self.hotel.id)
        self.assertEqual(event.target_label, str(self.hotel))
        self.assertEqual(event.metadata["source"], "test")

    def test_platform_module_access_uses_org_or_hotel_license(self):
        module = PlatformModule.objects.create(code="day-use", name="Day Use", monthly_license_price="15.00")
        PlatformLicense.objects.create(
            module=module,
            organization=self.organization,
            status=PlatformLicense.Status.ACTIVE,
        )

        self.assertTrue(
            platform_module_access_allowed(module_code="day-use", organization_id=self.organization.id)
        )
        self.assertTrue(
            platform_module_access_allowed(module_code="day-use", hotel_id=self.hotel.id)
        )

    def test_suspended_license_blocks_module_access(self):
        module = PlatformModule.objects.create(code="billing-plus", name="Billing Plus")
        PlatformLicense.objects.create(
            module=module,
            hotel=self.hotel,
            status=PlatformLicense.Status.SUSPENDED,
        )

        self.assertFalse(platform_module_access_allowed(module_code="billing-plus", hotel_id=self.hotel.id))

    def test_module_license_helper_enforces_configured_modules_only(self):
        self.assertTrue(module_license_is_active("clients", hotel=self.hotel))

        module = PlatformModule.objects.create(code="clients", name="Clients")
        self.assertFalse(module_license_is_active("clients", hotel=self.hotel))

        PlatformLicense.objects.create(
            module=module,
            organization=self.organization,
            status=PlatformLicense.Status.ACTIVE,
        )

        self.assertTrue(module_license_is_active("clients", hotel=self.hotel))

    def test_suspended_organization_blocks_module_license(self):
        module = PlatformModule.objects.create(code="billing", name="Billing")
        PlatformLicense.objects.create(
            module=module,
            organization=self.organization,
            status=PlatformLicense.Status.ACTIVE,
        )

        self.organization.is_active = False
        self.organization.save(update_fields=["is_active"])

        self.assertFalse(module_license_is_active("billing", hotel=self.hotel))

    def test_inactive_hotel_blocks_module_license(self):
        module = PlatformModule.objects.create(code="payments", name="Payments")
        PlatformLicense.objects.create(
            module=module,
            organization=self.organization,
            status=PlatformLicense.Status.ACTIVE,
        )

        self.hotel.is_active = False
        self.hotel.save(update_fields=["is_active"])

        self.assertFalse(module_license_is_active("payments", hotel=self.hotel))

    def test_process_subscription_lifecycle_suspends_due_active_subscription(self):
        self.subscription.ends_at = timezone.now() - timedelta(days=1)
        self.subscription.save(update_fields=["ends_at"])

        result = process_subscription_lifecycle()

        self.subscription.refresh_from_db()
        self.hotel.refresh_from_db()
        self.assertEqual(self.subscription.status, HotelSubscription.Status.SUSPENDED)
        self.assertFalse(self.hotel.is_active)
        self.assertEqual(result["suspended_count"], 1)

    def test_process_subscription_lifecycle_expires_due_trial(self):
        self.subscription.status = HotelSubscription.Status.TRIAL
        self.subscription.trial_ends_at = timezone.now() - timedelta(hours=1)
        self.subscription.save(update_fields=["status", "trial_ends_at"])

        result = process_subscription_lifecycle()

        self.subscription.refresh_from_db()
        self.hotel.refresh_from_db()
        self.assertEqual(self.subscription.status, HotelSubscription.Status.EXPIRED)
        self.assertFalse(self.hotel.is_active)
        self.assertEqual(result["expired_count"], 1)

    def test_renew_platform_subscription_reactivates_hotel(self):
        self.subscription.status = HotelSubscription.Status.SUSPENDED
        self.subscription.ends_at = timezone.now() - timedelta(days=1)
        self.subscription.save(update_fields=["status", "ends_at"])
        self.hotel.is_active = False
        self.hotel.save(update_fields=["is_active"])

        renew_platform_subscription(subscription=self.subscription, duration_days=30, actor=self.platform_admin)

        self.subscription.refresh_from_db()
        self.hotel.refresh_from_db()
        self.assertEqual(self.subscription.status, HotelSubscription.Status.ACTIVE)
        self.assertTrue(self.hotel.is_active)
        self.assertIsNotNone(self.subscription.ends_at)

    def test_change_platform_subscription_plan_returns_upgrade_kind(self):
        premium_plan = SubscriptionPlan.objects.create(
            code="premium",
            name="Premium",
            monthly_price="149.00",
            yearly_price="1490.00",
            max_hotels=3,
            max_users=40,
        )

        _, change_kind = change_platform_subscription_plan(
            subscription=self.subscription,
            new_plan=premium_plan,
            actor=self.platform_admin,
        )

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan_id, premium_plan.id)
        self.assertEqual(change_kind, "upgrade")

    def test_onboard_platform_bundle_creates_full_stack(self):
        result = onboard_platform_bundle(
            organization_name="Bundle Org",
            organization_slug="bundle-org",
            hotel_name="Bundle Hotel",
            hotel_code="BND-01",
            hotel_slug="bundle-hotel",
            admin_username="bundle-admin",
            admin_password="strongpass123",
            plan=self.plan,
            subscription_status=HotelSubscription.Status.TRIAL,
            trial_ends_at=timezone.now() + timedelta(days=7),
            actor=self.platform_admin,
        )

        self.assertEqual(result["organization"].slug, "bundle-org")
        self.assertEqual(result["hotel"].code, "BND-01")
        self.assertEqual(result["admin_user"].username, "bundle-admin")
        self.assertEqual(result["subscription"].plan_id, self.plan.id)

    def test_init_platform_subscriptions_command_creates_missing_contracts(self):
        extra_organization = Organization.objects.create(name="No Sub Org", slug="no-sub-org")
        extra_hotel = Hotel.objects.create(
            organization=extra_organization,
            name="No Sub Hotel",
            code="NSH-01",
            slug="no-sub-hotel",
        )
        out = StringIO()

        call_command(
            "init_platform_subscriptions",
            plan_code="starter",
            plan_name="Starter",
            status=HotelSubscription.Status.ACTIVE,
            stdout=out,
        )

        self.assertTrue(HotelSubscription.objects.filter(hotel=extra_hotel, status=HotelSubscription.Status.ACTIVE).exists())
        self.assertEqual(HotelSubscription.objects.filter(hotel=self.hotel).count(), 1)
        self.assertIn("abonnement(s) cree(s)", out.getvalue())


class PlatformAdminSerializersTests(TestCase):
    def setUp(self):
        self.plan = SubscriptionPlan.objects.create(
            code="business",
            name="Business",
            monthly_price="99.00",
            yearly_price="990.00",
            max_hotels=5,
            max_users=50,
        )
        self.organization = Organization.objects.create(name="Hotel Group", slug="hotel-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Hotel Luxe",
            code="LUX-01",
            slug="hotel-luxe",
        )
        self.subscription = HotelSubscription.objects.create(
            organization=self.organization,
            hotel=self.hotel,
            plan=self.plan,
            status=HotelSubscription.Status.TRIAL,
        )
        self.platform_admin = User.objects.create_user(
            username="platform-root",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )
        self.audit_event = PlatformAuditEvent.objects.create(
            actor=self.platform_admin,
            event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED,
            target_type="HotelSubscription",
            target_id=self.subscription.id,
            target_label="Hotel Luxe - Business",
            metadata={"status": "trial"},
        )

    def test_subscription_plan_serializer_exposes_read_only_payload(self):
        payload = SubscriptionPlanSerializer(self.plan).data

        self.assertEqual(payload["code"], "business")
        self.assertEqual(payload["name"], "Business")

    def test_hotel_subscription_serializer_exposes_labels(self):
        payload = HotelSubscriptionSerializer(self.subscription).data

        self.assertEqual(payload["organization_name"], self.organization.name)
        self.assertEqual(payload["hotel_name"], self.hotel.name)
        self.assertEqual(payload["plan_name"], self.plan.name)
        self.assertEqual(payload["status"], HotelSubscription.Status.TRIAL)

    def test_platform_organization_serializer_exposes_annotation_fields(self):
        annotated = list_platform_organizations().get(pk=self.organization.pk)
        payload = PlatformOrganizationSerializer(annotated).data

        self.assertEqual(payload["hotel_count"], 1)
        self.assertEqual(payload["name"], self.organization.name)

    def test_platform_hotel_serializer_exposes_subscription_fields(self):
        annotated = list_platform_hotels().get(pk=self.hotel.pk)
        payload = PlatformHotelSerializer(annotated).data

        self.assertEqual(payload["organization_name"], self.organization.name)
        self.assertEqual(payload["subscription_status"], HotelSubscription.Status.TRIAL)
        self.assertEqual(payload["subscription_plan_name"], self.plan.name)

    def test_platform_user_serializer_exposes_platform_scope(self):
        payload = PlatformUserSerializer(self.platform_admin).data

        self.assertEqual(payload["admin_scope"], "platform")
        self.assertTrue(payload["is_platform_admin"])

    def test_platform_audit_event_serializer_exposes_actor_name(self):
        payload = PlatformAuditEventSerializer(self.audit_event).data

        self.assertEqual(payload["event_type"], PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED)
        self.assertEqual(payload["actor_name"], self.platform_admin.username)

    def test_platform_module_and_license_serializers_expose_status(self):
        module = PlatformModule.objects.create(code="reports-pro", name="Reports Pro")
        license_obj = PlatformLicense.objects.create(module=module, hotel=self.hotel)

        self.assertEqual(PlatformModuleSerializer(module).data["code"], "reports-pro")
        self.assertTrue(PlatformLicenseSerializer(license_obj).data["is_valid"])


class PlatformAdminApiTests(TestCase):
    def setUp(self):
        self.plan = SubscriptionPlan.objects.create(
            code="enterprise",
            name="Enterprise",
            monthly_price="199.00",
            yearly_price="1990.00",
            max_hotels=20,
            max_users=200,
        )
        self.organization = Organization.objects.create(name="Platform Org", slug="platform-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Platform Hotel",
            code="PLT-01",
            slug="platform-hotel",
        )
        self.subscription = HotelSubscription.objects.create(
            organization=self.organization,
            hotel=self.hotel,
            plan=self.plan,
            status=HotelSubscription.Status.ACTIVE,
        )
        self.platform_admin = User.objects.create_user(
            username="platform-api-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )
        self.hotel_admin = User.objects.create_user(
            username="hotel-api-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        PlatformAuditEvent.objects.create(
            actor=self.platform_admin,
            event_type=PlatformAuditEvent.EventType.HOTEL_CREATED,
            target_type="Hotel",
            target_id=self.hotel.id,
            target_label=self.hotel.name,
        )

    def test_platform_admin_can_view_dashboard_api(self):
        self.client.force_login(self.platform_admin)

        response = self.client.get(reverse("api-platform-dashboard"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("summary_cards", payload)
        self.assertEqual(payload["title"], "Console plateforme AFRIVO")

    def test_hotel_admin_cannot_view_platform_dashboard_api(self):
        self.client.force_login(self.hotel_admin)

        response = self.client.get(reverse("api-platform-dashboard"))

        self.assertEqual(response.status_code, 403)

    def test_platform_admin_can_create_module_and_license(self):
        self.client.force_login(self.platform_admin)

        module_response = self.client.post(
            reverse("api-platform-modules"),
            data=json.dumps({"code": "clients-premium", "name": "Clients Premium", "monthly_license_price": "25.00"}),
            content_type="application/json",
        )

        self.assertEqual(module_response.status_code, 201)
        module_id = module_response.json()["module"]["id"]

        license_response = self.client.post(
            reverse("api-platform-licenses"),
            data=json.dumps(
                {
                    "module_id": module_id,
                    "organization_id": self.organization.id,
                    "status": PlatformLicense.Status.ACTIVE,
                    "monthly_price": "25.00",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(license_response.status_code, 201)
        self.assertTrue(license_response.json()["license"]["is_valid"])

    def test_platform_admin_cannot_reset_super_root_access(self):
        super_root = User.objects.create_superuser(username="super-root", password="testpass123")
        self.client.force_login(self.platform_admin)

        response = self.client.post(
            reverse("api-platform-user-reset-access", kwargs={"user_id": super_root.id}),
            data=json.dumps({"password": "newpass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "user_hierarchy_denied")

    def test_platform_admin_create_endpoint_creates_organization_admin(self):
        self.client.force_login(self.platform_admin)

        response = self.client.post(
            reverse("api-platform-users"),
            data=json.dumps(
                {
                    "username": "org-admin",
                    "password": "Testpass123!",
                    "admin_scope": "organization",
                    "organization_id": self.organization.id,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="org-admin")
        self.assertEqual(user.organization_id, self.organization.id)
        self.assertIsNone(user.hotel_id)
        self.assertFalse(user.is_platform_admin)

    def test_super_admin_can_deactivate_and_activate_platform_admin(self):
        self.client.force_login(self.platform_admin)
        target = User.objects.create_user(
            username="managed-platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )
        session = target.sessions.create(refresh_token_jti="managed-platform-admin-session", is_active=True)

        deactivate_response = self.client.post(reverse("api-platform-user-deactivate", kwargs={"user_id": target.id}))

        self.assertEqual(deactivate_response.status_code, 200)
        target.refresh_from_db()
        session.refresh_from_db()
        self.assertFalse(target.is_active)
        self.assertFalse(session.is_active)
        self.assertIsNotNone(session.revoked_at)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(
                event_type=PlatformAuditEvent.EventType.ADMIN_UPDATED,
                target_id=target.id,
                metadata__action="admin_deactivated",
            ).exists()
        )

        activate_response = self.client.post(reverse("api-platform-user-activate", kwargs={"user_id": target.id}))

        self.assertEqual(activate_response.status_code, 200)
        target.refresh_from_db()
        self.assertTrue(target.is_active)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(
                event_type=PlatformAuditEvent.EventType.ADMIN_UPDATED,
                target_id=target.id,
                metadata__action="admin_activated",
            ).exists()
        )

    def test_super_admin_cannot_deactivate_equal_platform_admin(self):
        peer = User.objects.create_user(
            username="peer-super-admin-platform",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.SUPER_ADMIN,
        )
        self.client.force_login(self.platform_admin)

        response = self.client.post(reverse("api-platform-user-deactivate", kwargs={"user_id": peer.id}))

        self.assertEqual(response.status_code, 403)
        peer.refresh_from_db()
        self.assertTrue(peer.is_active)

    def test_platform_admin_can_view_platform_lists(self):
        self.client.force_login(self.platform_admin)

        organizations_response = self.client.get(reverse("api-platform-organizations"))
        hotels_response = self.client.get(reverse("api-platform-hotels"))
        subscriptions_response = self.client.get(reverse("api-platform-subscriptions"))
        users_response = self.client.get(reverse("api-platform-users"))
        security_response = self.client.get(reverse("api-platform-security-events"))

        self.assertEqual(organizations_response.status_code, 200)
        self.assertEqual(hotels_response.status_code, 200)
        self.assertEqual(subscriptions_response.status_code, 200)
        self.assertEqual(users_response.status_code, 200)
        self.assertEqual(security_response.status_code, 200)

        self.assertTrue(organizations_response.json()["results"])
        self.assertTrue(hotels_response.json()["results"])
        self.assertTrue(subscriptions_response.json()["results"])
        self.assertTrue(users_response.json()["results"])
        self.assertTrue(security_response.json()["results"])

    def test_platform_admin_can_create_organization(self):
        self.client.force_login(self.platform_admin)

        response = self.client.post(
            reverse("api-platform-organizations"),
            data=json.dumps({"name": "New Group", "slug": "new-group", "is_active": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Organization.objects.filter(slug="new-group").exists())
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.ORGANIZATION_CREATED).exists()
        )

    def test_platform_admin_can_update_organization(self):
        self.client.force_login(self.platform_admin)

        response = self.client.patch(
            reverse("api-platform-organization-detail", kwargs={"organization_id": self.organization.id}),
            data=json.dumps({"name": "Updated Org", "slug": "updated-org", "status": "suspended"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.name, "Updated Org")
        self.assertEqual(self.organization.slug, "updated-org")
        self.assertEqual(self.organization.status, Organization.Status.SUSPENDED)
        self.assertFalse(self.organization.is_active)
        self.assertEqual(response.json()["organization"]["status"], Organization.Status.SUSPENDED)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.ORGANIZATION_UPDATED).exists()
        )

    def test_platform_organization_update_rejects_duplicate_slug(self):
        self.client.force_login(self.platform_admin)
        other = Organization.objects.create(name="Other Org", slug="other-org")

        response = self.client.patch(
            reverse("api-platform-organization-detail", kwargs={"organization_id": other.id}),
            data=json.dumps({"slug": self.organization.slug}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "validation_error")

    def test_platform_admin_can_create_update_suspend_and_reactivate_hotel(self):
        self.client.force_login(self.platform_admin)
        organization = Organization.objects.create(name="Another Org", slug="another-org")

        create_response = self.client.post(
            reverse("api-platform-hotels"),
            data=json.dumps(
                {
                    "organization_id": organization.id,
                    "name": "New Hotel",
                    "code": "NEW-01",
                    "slug": "new-hotel",
                    "country": "Senegal",
                    "city": "Dakar",
                    "timezone": "Atlantic/Reykjavik",
                    "currency": "XOF",
                    "is_active": True,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        hotel_id = create_response.json()["hotel"]["id"]

        patch_response = self.client.patch(
            reverse("api-platform-hotel-detail", kwargs={"hotel_id": hotel_id}),
            data=json.dumps({"city": "Abidjan", "currency": "XAF"}),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)

        suspend_response = self.client.post(reverse("api-platform-hotel-suspend", kwargs={"hotel_id": hotel_id}))
        self.assertEqual(suspend_response.status_code, 200)

        reactivate_response = self.client.post(reverse("api-platform-hotel-reactivate", kwargs={"hotel_id": hotel_id}))
        self.assertEqual(reactivate_response.status_code, 200)

        hotel = Hotel.objects.get(pk=hotel_id)
        self.assertTrue(hotel.is_active)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.HOTEL_CREATED).exists()
        )
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.HOTEL_UPDATED).exists()
        )
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.HOTEL_SUSPENDED).exists()
        )
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.HOTEL_REACTIVATED).exists()
        )

    def test_platform_admin_can_create_and_update_subscription(self):
        self.client.force_login(self.platform_admin)
        hotel = Hotel.objects.create(
            organization=self.organization,
            name="Second Hotel",
            code="PLT-02",
            slug="platform-hotel-2",
        )

        create_response = self.client.post(
            reverse("api-platform-subscriptions"),
            data=json.dumps(
                {
                    "organization_id": self.organization.id,
                    "hotel_id": hotel.id,
                    "plan_id": self.plan.id,
                    "status": "trial",
                    "starts_at": timezone.now().isoformat(),
                    "trial_ends_at": (timezone.now() + timedelta(days=14)).isoformat(),
                    "billing_cycle": "monthly",
                    "notes": "Bootstrap",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        subscription_id = create_response.json()["subscription"]["id"]

        patch_response = self.client.patch(
            reverse("api-platform-subscription-detail", kwargs={"subscription_id": subscription_id}),
            data=json.dumps({"status": "active", "notes": "Validated"}),
            content_type="application/json",
        )

        self.assertEqual(patch_response.status_code, 200)
        subscription = HotelSubscription.objects.get(pk=subscription_id)
        self.assertEqual(subscription.status, HotelSubscription.Status.ACTIVE)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED).exists()
        )
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_UPDATED).exists()
        )

    def test_platform_admin_can_list_subscription_plans(self):
        self.client.force_login(self.platform_admin)

        response = self.client.get(reverse("api-platform-subscription-plans"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["results"])

    def test_platform_admin_can_run_subscription_lifecycle_endpoint(self):
        self.client.force_login(self.platform_admin)
        self.subscription.ends_at = timezone.now() - timedelta(days=1)
        self.subscription.save(update_fields=["ends_at"])

        response = self.client.post(reverse("api-platform-subscription-lifecycle-run"), data="{}", content_type="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lifecycle"]["suspended_count"], 1)
        self.assertEqual(response.json()["lifecycle"]["organizations_processed"], 1)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(
                target_type="PlatformSubscriptionLifecycle",
                metadata__action="commercial_cycle_executed",
            ).exists()
        )
        self.assertTrue(
            ActivityLog.objects.filter(
                module="platform_subscriptions",
                object_type="PlatformSubscriptionLifecycle",
            ).exists()
        )

    def test_platform_admin_can_renew_subscription_endpoint(self):
        self.client.force_login(self.platform_admin)
        self.subscription.status = HotelSubscription.Status.SUSPENDED
        self.subscription.save(update_fields=["status"])

        response = self.client.post(
            reverse("api-platform-subscription-renew", kwargs={"subscription_id": self.subscription.id}),
            data=json.dumps({"duration_days": 30, "note": "Renewed"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, HotelSubscription.Status.ACTIVE)

    def test_platform_admin_can_change_subscription_plan_endpoint(self):
        self.client.force_login(self.platform_admin)
        premium_plan = SubscriptionPlan.objects.create(
            code="ultimate",
            name="Ultimate",
            monthly_price="249.00",
            yearly_price="2490.00",
            max_hotels=10,
            max_users=300,
        )

        response = self.client.post(
            reverse("api-platform-subscription-change-plan", kwargs={"subscription_id": self.subscription.id}),
            data=json.dumps({"plan_id": premium_plan.id, "note": "Upgrade"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["change_kind"], "upgrade")

    def test_platform_admin_can_run_onboarding_bundle_endpoint(self):
        self.client.force_login(self.platform_admin)

        response = self.client.post(
            reverse("api-platform-onboarding"),
            data=json.dumps(
                {
                    "organization_name": "Bundle API Org",
                    "organization_slug": "bundle-api-org",
                    "hotel_name": "Bundle API Hotel",
                    "hotel_code": "BAPI-01",
                    "hotel_slug": "bundle-api-hotel",
                    "admin_username": "bundle-api-admin",
                    "admin_password": "strongpass123",
                    "plan_id": self.plan.id,
                    "subscription_status": "trial",
                    "trial_ends_at": (timezone.now() + timedelta(days=10)).isoformat(),
                    "billing_cycle": "monthly",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Organization.objects.filter(slug="bundle-api-org").exists())
        self.assertTrue(User.objects.filter(username="bundle-api-admin").exists())

    def test_platform_admin_can_create_hotel_admin_during_onboarding(self):
        self.client.force_login(self.platform_admin)

        response = self.client.post(
            reverse("api-platform-hotel-admin-create", kwargs={"hotel_id": self.hotel.id}),
            data=json.dumps(
                {
                    "username": "new-hotel-admin",
                    "password": "strongpass123",
                    "first_name": "Hotel",
                    "last_name": "Admin",
                    "email": "hotel-admin@afrivo.test",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        created_user = User.objects.get(username="new-hotel-admin")
        self.assertEqual(created_user.hotel_id, self.hotel.id)
        self.assertEqual(created_user.organization_id, self.organization.id)
        self.assertEqual(created_user.role, User.Role.ADMIN)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(event_type=PlatformAuditEvent.EventType.USER_LINKED).exists()
        )

    def test_platform_admin_can_create_and_update_subscription_plan(self):
        self.client.force_login(self.platform_admin)

        create_response = self.client.post(
            reverse("api-platform-subscription-plans"),
            data=json.dumps(
                {
                    "code": "growth",
                    "name": "Growth",
                    "description": "Plan intermediaire",
                    "monthly_price": "79.00",
                    "yearly_price": "790.00",
                    "max_hotels": 4,
                    "max_users": 35,
                    "is_active": True,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 201)
        plan_id = create_response.json()["plan"]["id"]

        patch_response = self.client.patch(
            reverse("api-platform-subscription-plan-detail", kwargs={"plan_id": plan_id}),
            data=json.dumps({"max_users": 45, "is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        plan = SubscriptionPlan.objects.get(pk=plan_id)
        self.assertEqual(plan.max_users, 45)
        self.assertFalse(plan.is_active)

    def test_platform_security_events_can_be_filtered_and_review_logged(self):
        self.client.force_login(self.platform_admin)
        PlatformAuditEvent.objects.create(
            actor=self.platform_admin,
            event_type=PlatformAuditEvent.EventType.SECURITY_REVIEW,
            target_type="Hotel",
            target_id=self.hotel.id,
            target_label=self.hotel.name,
            metadata={"severity": "warning"},
        )

        filtered_response = self.client.get(
            reverse("api-platform-security-events"),
            {"event_type": PlatformAuditEvent.EventType.SECURITY_REVIEW, "target_type": "Hotel"},
        )
        self.assertEqual(filtered_response.status_code, 200)
        self.assertTrue(filtered_response.json()["results"])

        review_response = self.client.post(
            reverse("api-platform-security-review"),
            data=json.dumps(
                {
                    "target_type": "Hotel",
                    "target_id": self.hotel.id,
                    "target_label": self.hotel.name,
                    "note": "Controle manuel termine",
                    "severity": "critical",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(review_response.status_code, 200)
        self.assertTrue(
            PlatformAuditEvent.objects.filter(
                event_type=PlatformAuditEvent.EventType.SECURITY_REVIEW,
                metadata__severity="critical",
            ).exists()
        )
