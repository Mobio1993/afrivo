import json

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.bookings.models import DayUse
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenancy.models import Hotel, Organization

User = get_user_model()


class OperationsApiStrictModeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ops-agent",
            password="testpass123",
            role=User.Role.RECEPTION,
        )
        self.client.force_login(self.user)

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": False,
            "consumptions": False,
            "satisfaction": False,
            "guests": False,
            "operations": True,
            "history": False,
        }
    )
    def test_operations_choices_requires_active_hotel_in_strict_mode(self):
        response = self.client.get(reverse("api-operations-choices"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["module"], "operations")


class OperationsPermissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cashier-ops",
            password="testpass123",
            role=User.Role.CASHIER,
        )
        self.client.force_login(self.user)

    def test_cashier_cannot_create_booking_from_operations_module(self):
        response = self.client.post(
            reverse("api-create-booking"),
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["module"], "operations")
        self.assertEqual(response.json()["action"], "create")


class OperationsHotelScopeTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Ops Group", slug="ops-group")
        self.hotel_a = Hotel.objects.create(
            organization=self.organization,
            name="Hotel A",
            code="OPS-A",
            slug="ops-hotel-a",
        )
        self.hotel_b = Hotel.objects.create(
            organization=self.organization,
            name="Hotel B",
            code="OPS-B",
            slug="ops-hotel-b",
        )

        self.user = User.objects.create_user(
            username="ops-manager-a",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel_a,
        )
        self.client.force_login(self.user)

        self.room_type_a = RoomType.objects.create(
            hotel=self.hotel_a,
            name="Type Ops A",
            code="OPS-TA",
            base_price_per_night=100,
            base_price_day_use=40,
        )
        self.room_type_b = RoomType.objects.create(
            hotel=self.hotel_b,
            name="Type Ops B",
            code="OPS-TB",
            base_price_per_night=110,
            base_price_day_use=45,
        )

        self.stay_room_a = Room.objects.create(
            hotel=self.hotel_a,
            number="401A",
            room_type=self.room_type_a,
            status=Room.Status.AVAILABLE,
        )
        self.stay_room_b = Room.objects.create(
            hotel=self.hotel_b,
            number="401B",
            room_type=self.room_type_b,
            status=Room.Status.AVAILABLE,
        )
        self.day_use_room_a = Room.objects.create(
            hotel=self.hotel_a,
            number="402A",
            room_type=self.room_type_a,
            status=Room.Status.AVAILABLE,
        )
        self.day_use_room_b = Room.objects.create(
            hotel=self.hotel_b,
            number="402B",
            room_type=self.room_type_b,
            status=Room.Status.AVAILABLE,
        )
        self.available_room_a = Room.objects.create(
            hotel=self.hotel_a,
            number="403A",
            room_type=self.room_type_a,
            status=Room.Status.AVAILABLE,
        )

        self.guest_a = Guest.objects.create(
            hotel=self.hotel_a,
            first_name="Alice",
            last_name="Ops",
            phone="+221770000001",
        )
        self.guest_b = Guest.objects.create(
            hotel=self.hotel_b,
            first_name="Bob",
            last_name="Ops",
            phone="+221770000002",
        )

        self.stay_a = Stay.create_walk_in(
            guest=self.guest_a,
            room=self.stay_room_a,
            actual_check_in=timezone.now(),
            actor=self.user,
        )
        self.stay_b = Stay.create_walk_in(
            guest=self.guest_b,
            room=self.stay_room_b,
            actual_check_in=timezone.now(),
        )

        self.day_use_a = DayUse.objects.create(
            hotel=self.hotel_a,
            guest=self.guest_a,
            room=self.day_use_room_a,
            package_price=50,
            overtime_fee=0,
            total_amount=50,
        )
        self.day_use_a.status = DayUse.Status.IN_PROGRESS
        self.day_use_a.check_in_at = timezone.now()
        self.day_use_a.save()

        self.day_use_b = DayUse.objects.create(
            hotel=self.hotel_b,
            guest=self.guest_b,
            room=self.day_use_room_b,
            package_price=60,
            overtime_fee=0,
            total_amount=60,
        )
        self.day_use_b.status = DayUse.Status.IN_PROGRESS
        self.day_use_b.check_in_at = timezone.now()
        self.day_use_b.save()

    def test_bulk_stay_check_out_is_limited_to_active_hotel(self):
        response = self.client.post(
            reverse("api-bulk-stay-check-out"),
            data=json.dumps({"stay_ids": [self.stay_a.id, self.stay_b.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["processed"], 1)

        self.stay_a.refresh_from_db()
        self.stay_b.refresh_from_db()
        self.assertEqual(self.stay_a.status, Stay.Status.COMPLETED)
        self.assertEqual(self.stay_b.status, Stay.Status.IN_PROGRESS)

    def test_bulk_day_use_check_out_is_limited_to_active_hotel(self):
        response = self.client.post(
            reverse("api-bulk-day-use-check-out"),
            data=json.dumps({"day_use_ids": [self.day_use_a.id, self.day_use_b.id]}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["processed"], 1)

        self.day_use_a.refresh_from_db()
        self.day_use_b.refresh_from_db()
        self.assertEqual(self.day_use_a.status, DayUse.Status.COMPLETED)
        self.assertEqual(self.day_use_b.status, DayUse.Status.IN_PROGRESS)

    def test_operations_choices_expose_only_actionable_room_flags_for_active_hotel(self):
        response = self.client.get(reverse("api-operations-choices"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        room_map = {item["id"]: item for item in payload["rooms"]}

        self.assertIn(self.available_room_a.id, room_map)
        self.assertIn(self.stay_room_a.id, room_map)
        self.assertNotIn(self.stay_room_b.id, room_map)

        self.assertTrue(room_map[self.available_room_a.id]["can_assign_booking"])
        self.assertTrue(room_map[self.available_room_a.id]["can_open_stay"])
        self.assertTrue(room_map[self.available_room_a.id]["can_open_day_use"])

        self.assertFalse(room_map[self.stay_room_a.id]["can_open_stay"])
        self.assertFalse(room_map[self.stay_room_a.id]["can_open_day_use"])
