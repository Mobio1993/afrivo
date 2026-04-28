from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.billing.models import Payment
from apps.bookings.models import DayUse
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.tenancy.models import Hotel, Organization

User = get_user_model()


class TenancyReadinessReportApiTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Readiness Org", slug="readiness-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Readiness Hotel",
            code="READY-01",
            slug="readiness-hotel",
        )
        self.admin = User.objects.create_user(
            username="platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )
        self.manager = User.objects.create_user(
            username="manager-user",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.reception = User.objects.create_user(
            username="frontdesk-user",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.housekeeping = User.objects.create_user(
            username="housekeeping-user",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
            organization=self.organization,
            hotel=self.hotel,
        )
        User.objects.create_user(
            username="missing-hotel-user",
            password="testpass123",
            role=User.Role.RECEPTION,
        )

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": True,
            "consumptions": False,
            "satisfaction": True,
            "guests": False,
            "operations": False,
            "history": False,
        }
    )
    def test_admin_can_view_tenancy_readiness_report(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("api-report-tenancy-readiness"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["unassigned_users"], 2)
        self.assertTrue(payload["users_without_hotel"])
        self.assertEqual(payload["strict_modules"][0]["module"], "satisfaction")
        self.assertTrue(any(item["strict_enabled"] for item in payload["strict_modules"]))
        self.assertEqual(payload["strict_modules"][0]["env_var"], "TENANCY_STRICT_SATISFACTION")
        self.assertIn("redeployer le backend", payload["strict_modules"][0]["activation_instruction"])
        self.assertEqual(payload["recommended_rollout_order"][0], "satisfaction")
        self.assertEqual(payload["next_activation"]["module"], "consumptions")
        self.assertFalse(payload["next_activation"]["can_activate_now"])
        self.assertEqual(payload["next_activation"]["status"], "blocked")
        self.assertEqual(payload["next_activation"]["env_var"], "TENANCY_STRICT_CONSUMPTIONS")
        self.assertEqual(payload["rollout_journal"][0]["status"], "completed")
        self.assertEqual(payload["rollout_journal"][2]["status"], "blocked")
        self.assertEqual(payload["rollout_journal"][2]["module"], "consumptions")

    def test_non_admin_cannot_view_tenancy_readiness_report(self):
        self.client.force_login(self.manager)

        response = self.client.get(reverse("api-report-tenancy-readiness"))

        self.assertEqual(response.status_code, 403)

    def test_admin_can_assign_default_hotel_from_report_endpoint(self):
        self.client.force_login(self.admin)

        response = self.client.post(reverse("api-report-tenancy-assign-default-hotel"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["unassigned_users"], 1)
        self.assertEqual(payload["assignment_result"]["assigned"], 2)
        self.assertTrue(payload["assignment_result"]["hotel_name"])

    def test_non_admin_cannot_assign_default_hotel_from_report_endpoint(self):
        self.client.force_login(self.manager)

        response = self.client.post(reverse("api-report-tenancy-assign-default-hotel"))

        self.assertEqual(response.status_code, 403)

    def test_manager_can_view_reports_overview(self):
        self.client.force_login(self.manager)

        response = self.client.get(reverse("api-reports-overview"))

        self.assertEqual(response.status_code, 200)

    def test_housekeeping_cannot_view_reports_overview(self):
        self.client.force_login(self.housekeeping)

        response = self.client.get(reverse("api-reports-overview"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["module"], "reports")


class ScopedReportsApiTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="AFRIVO Group", slug="afrivo-group")
        self.hotel_a = Hotel.objects.create(
            organization=self.organization,
            name="Hotel A",
            code="HTL-A",
            slug="hotel-a",
        )
        self.hotel_b = Hotel.objects.create(
            organization=self.organization,
            name="Hotel B",
            code="HTL-B",
            slug="hotel-b",
        )

        self.manager_a = User.objects.create_user(
            username="manager-a",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel_a,
        )

        self.platform_admin = User.objects.create_user(
            username="platform-root",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )

        self.room_type_a = RoomType.objects.create(
            hotel=self.hotel_a,
            name="Standard A",
            code="STD-A",
            base_price_per_night=100,
            base_price_day_use=40,
        )
        self.room_type_b = RoomType.objects.create(
            hotel=self.hotel_b,
            name="Standard B",
            code="STD-B",
            base_price_per_night=110,
            base_price_day_use=45,
        )

        self.room_a = Room.objects.create(
            hotel=self.hotel_a,
            number="101A",
            room_type=self.room_type_a,
            status=Room.Status.OCCUPIED,
        )
        self.room_b = Room.objects.create(
            hotel=self.hotel_b,
            number="101B",
            room_type=self.room_type_b,
            status=Room.Status.AVAILABLE,
        )

        self.guest_a = Guest.objects.create(
            hotel=self.hotel_a,
            first_name="Alice",
            last_name="HotelA",
            phone="+221700000001",
        )
        self.guest_b = Guest.objects.create(
            hotel=self.hotel_b,
            first_name="Bob",
            last_name="HotelB",
            phone="+221700000002",
        )

        self.day_use_a = DayUse.objects.create(
            hotel=self.hotel_a,
            guest=self.guest_a,
            room=self.room_a,
            package_price=50,
            overtime_fee=0,
            total_amount=50,
        )
        self.day_use_b = DayUse.objects.create(
            hotel=self.hotel_b,
            guest=self.guest_b,
            room=self.room_b,
            package_price=80,
            overtime_fee=0,
            total_amount=80,
        )

        Payment.objects.create(
            reference="PAY-A-001",
            hotel=self.hotel_a,
            client=self.guest_a,
            day_use=self.day_use_a,
            amount=50,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
        )
        Payment.objects.create(
            reference="PAY-B-001",
            hotel=self.hotel_b,
            client=self.guest_b,
            day_use=self.day_use_b,
            amount=80,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
        )

        self.room_a.status = Room.Status.OCCUPIED
        self.room_a.save()
        self.room_b.status = Room.Status.AVAILABLE
        self.room_b.save()

    def test_reports_overview_is_scoped_to_active_hotel(self):
        self.client.force_login(self.manager_a)

        response = self.client.get(reverse("api-reports-overview"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary_cards"][0]["value"], "50.00")
        self.assertEqual(payload["summary_cards"][1]["value"], "100%")
        self.assertEqual(payload["summary_cards"][2]["value"], 1)

    def test_financial_report_is_scoped_to_active_hotel(self):
        self.client.force_login(self.manager_a)

        response = self.client.get(reverse("api-report-financial"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary_cards"][0]["value"], "50.00")
        self.assertEqual(len(payload["recent_rows"]), 1)
        self.assertEqual(payload["recent_rows"][0]["reference"], "PAY-A-001")

    def test_occupancy_report_is_scoped_to_active_hotel(self):
        self.client.force_login(self.manager_a)

        response = self.client.get(reverse("api-report-occupancy"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary_cards"][0]["value"], 1)
        self.assertEqual(payload["summary_cards"][1]["value"], "100%")
        self.assertEqual(len(payload["room_type_breakdown"]), 1)
        self.assertEqual(payload["room_type_breakdown"][0]["name"], "Standard A")

    def test_day_use_report_is_scoped_to_active_hotel(self):
        self.client.force_login(self.manager_a)

        response = self.client.get(reverse("api-report-day-use"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary_cards"][0]["value"], 1)
        self.assertEqual(payload["summary_cards"][3]["value"], "50.00")
        self.assertEqual(len(payload["recent_rows"]), 1)
        self.assertEqual(payload["recent_rows"][0]["reference"], self.day_use_a.reference)

    def test_reports_overview_requires_hotel_for_non_platform_admin(self):
        user_without_hotel = User.objects.create_user(
            username="manager-no-hotel",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
        )
        self.client.force_login(user_without_hotel)

        response = self.client.get(reverse("api-reports-overview"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "hotel_required")

    def test_tenancy_readiness_requires_platform_admin(self):
        hotel_admin = User.objects.create_user(
            username="hotel-admin-a",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel_a,
        )
        self.client.force_login(hotel_admin)

        response = self.client.get(reverse("api-report-tenancy-readiness"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "platform_admin_required")

    def test_platform_admin_can_still_access_global_tenancy_readiness(self):
        self.client.force_login(self.platform_admin)

        response = self.client.get(reverse("api-report-tenancy-readiness"))

        self.assertEqual(response.status_code, 200)
