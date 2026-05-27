import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.bookings.models import Booking, DayUse
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.tenancy.models import Hotel, Organization
from apps.users.models import IAMPermission, UserPermissionOverride


User = get_user_model()


class DayUseApiTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Day Use API Group", slug="day-use-api-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Day Use API Hotel",
            code="DUA",
            slug="day-use-api-hotel",
        )
        self.user = User.objects.create_user(
            username="day-use-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            hotel=self.hotel,
            organization=self.organization,
        )
        self.client.force_login(self.user)
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Dayuse",
            phone="+2250700000001",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Day Use Suite",
            code="DU-S",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=Decimal("60000.00"),
            base_price_day_use=Decimal("12000.00"),
            is_day_use_available=True,
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="DU101",
            room_type=self.room_type,
            status=Room.Status.AVAILABLE,
        )

    def test_day_use_api_create_pay_checkin_checkout(self):
        start = timezone.now() + timedelta(minutes=10)
        response = self.client.post(
            reverse("api-day-use-list"),
            data=json.dumps(
                {
                    "client_id": self.guest.id,
                    "room_id": self.room.id,
                    "start_datetime": start.isoformat(),
                    "expected_duration_hours": 2,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()["day_use"]
        self.assertEqual(payload["payment_status"], DayUse.PaymentStatus.UNPAID)
        self.assertEqual(payload["final_amount"], "24000.00")

        day_use_id = payload["id"]
        payment_response = self.client.post(
            reverse("api-day-use-payments", kwargs={"day_use_id": day_use_id}),
            data=json.dumps({"amount": "24000.00"}),
            content_type="application/json",
        )
        self.assertEqual(payment_response.status_code, 201)
        self.assertEqual(payment_response.json()["day_use"]["payment_status"], DayUse.PaymentStatus.PAID)

        checkin_response = self.client.patch(reverse("api-day-use-check-in-v2", kwargs={"day_use_id": day_use_id}))
        self.assertEqual(checkin_response.status_code, 200)
        self.assertEqual(checkin_response.json()["day_use"]["status"], DayUse.Status.IN_PROGRESS)

        checkout_response = self.client.patch(reverse("api-day-use-check-out-v2", kwargs={"day_use_id": day_use_id}))
        self.assertEqual(checkout_response.status_code, 200)
        self.assertEqual(checkout_response.json()["day_use"]["status"], DayUse.Status.COMPLETED)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, Room.Status.CLEANING)

    def test_day_use_api_rejects_overlapping_room(self):
        start = timezone.now() + timedelta(hours=1)
        DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.READY,
            package_price=Decimal("12000.00"),
            start_datetime=start,
            end_datetime=start + timedelta(hours=2),
        )

        response = self.client.post(
            reverse("api-day-use-list"),
            data=json.dumps(
                {
                    "client_id": self.guest.id,
                    "room_id": self.room.id,
                    "start_datetime": (start + timedelta(minutes=30)).isoformat(),
                    "expected_duration_hours": 1,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("room", response.json()["errors"])

    def test_day_use_api_rejects_reserved_room(self):
        self.room.status = Room.Status.RESERVED
        self.room.save(update_fields=["status", "updated_at"])

        response = self.client.post(
            reverse("api-day-use-list"),
            data=json.dumps(
                {
                    "client_id": self.guest.id,
                    "room_id": self.room.id,
                    "start_datetime": (timezone.now() + timedelta(minutes=10)).isoformat(),
                    "expected_duration_hours": 2,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("room", response.json()["errors"])

    def test_day_use_api_rejects_other_hotel_guest_and_room(self):
        other_organization = Organization.objects.create(name="Other Group", slug="other-group")
        other_hotel = Hotel.objects.create(
            organization=other_organization,
            name="Other Hotel",
            code="OTH",
            slug="other-hotel",
        )
        other_guest = Guest.objects.create(
            hotel=other_hotel,
            first_name="Client",
            last_name="Other",
            phone="+2250700000099",
        )
        other_room_type = RoomType.objects.create(
            hotel=other_hotel,
            name="Other Type",
            code="OTH-DU",
            base_price_per_night=Decimal("50000.00"),
            base_price_day_use=Decimal("10000.00"),
            is_day_use_available=True,
        )
        other_room = Room.objects.create(
            hotel=other_hotel,
            number="OTH101",
            room_type=other_room_type,
            status=Room.Status.AVAILABLE,
        )

        response = self.client.post(
            reverse("api-day-use-list"),
            data=json.dumps(
                {
                    "client_id": other_guest.id,
                    "room_id": other_room.id,
                    "start_datetime": (timezone.now() + timedelta(minutes=10)).isoformat(),
                    "expected_duration_hours": 2,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    def test_day_use_api_rejects_overpayment(self):
        start = timezone.now() + timedelta(minutes=10)
        create_response = self.client.post(
            reverse("api-day-use-list"),
            data=json.dumps(
                {
                    "client_id": self.guest.id,
                    "room_id": self.room.id,
                    "start_datetime": start.isoformat(),
                    "expected_duration_hours": 2,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 201)
        day_use_id = create_response.json()["day_use"]["id"]

        payment_response = self.client.post(
            reverse("api-day-use-payments", kwargs={"day_use_id": day_use_id}),
            data=json.dumps({"amount": "24001.00"}),
            content_type="application/json",
        )

        self.assertEqual(payment_response.status_code, 400)
        self.assertIn("amount", payment_response.json()["errors"])

    def test_day_use_api_check_out_accepts_overtime(self):
        start = timezone.now() - timedelta(hours=3)
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.OVERTIME,
            payment_status=DayUse.PaymentStatus.PAID,
            package_price=Decimal("24000.00"),
            total_amount=Decimal("24000.00"),
            final_amount=Decimal("24000.00"),
            subtotal_amount=Decimal("24000.00"),
            hourly_rate=Decimal("12000.00"),
            expected_duration_hours=2,
            planned_entry_at=start,
            start_datetime=start,
            end_datetime=start + timedelta(hours=2),
            check_in_at=start,
            checked_in_at=start,
        )

        response = self.client.patch(reverse("api-day-use-check-out-v2", kwargs={"day_use_id": day_use.id}))

        self.assertEqual(response.status_code, 200)
        day_use.refresh_from_db()
        self.assertEqual(day_use.status, DayUse.Status.COMPLETED)
        self.assertGreater(day_use.overtime_amount, Decimal("0.00"))

    def test_day_use_actions_require_business_permissions(self):
        start = timezone.now() + timedelta(minutes=10)
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.READY,
            payment_status=DayUse.PaymentStatus.PAID,
            package_price=Decimal("24000.00"),
            total_amount=Decimal("24000.00"),
            final_amount=Decimal("24000.00"),
            subtotal_amount=Decimal("24000.00"),
            hourly_rate=Decimal("12000.00"),
            expected_duration_hours=2,
            planned_entry_at=start,
            start_datetime=start,
            end_datetime=start + timedelta(hours=2),
        )
        restricted_user = User.objects.create_user(
            username="day-use-restricted",
            password="testpass123",
            role=User.Role.RECEPTION,
            hotel=self.hotel,
            organization=self.organization,
        )
        for permission_code in ("dayuse.check_in", "payments.record"):
            permission, _ = IAMPermission.objects.get_or_create(
                code=permission_code,
                defaults={
                    "module_code": permission_code.split(".", 1)[0],
                    "action": permission_code.split(".", 1)[1],
                },
            )
            UserPermissionOverride.objects.create(
                user=restricted_user,
                permission=permission,
                is_allowed=False,
                reason="test business denial",
            )
        self.client.force_login(restricted_user)

        checkin_response = self.client.patch(reverse("api-day-use-check-in-v2", kwargs={"day_use_id": day_use.id}))
        payment_response = self.client.post(
            reverse("api-day-use-payments", kwargs={"day_use_id": day_use.id}),
            data=json.dumps({"amount": "24000.00"}),
            content_type="application/json",
        )

        self.assertEqual(checkin_response.status_code, 403)
        self.assertEqual(checkin_response.json()["code"], "business_permission_denied")
        self.assertEqual(checkin_response.json()["action"], "dayuse.check_in")
        self.assertEqual(payment_response.status_code, 403)
        self.assertEqual(payment_response.json()["code"], "business_permission_denied")
        self.assertEqual(payment_response.json()["action"], "payments.record")

    def test_day_use_api_rejects_extension_over_ten_hours(self):
        start = timezone.now() - timedelta(hours=1)
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.IN_PROGRESS,
            package_price=Decimal("108000.00"),
            total_amount=Decimal("108000.00"),
            final_amount=Decimal("108000.00"),
            subtotal_amount=Decimal("108000.00"),
            hourly_rate=Decimal("12000.00"),
            expected_duration_hours=9,
            planned_entry_at=start,
            start_datetime=start,
            end_datetime=start + timedelta(hours=9),
            check_in_at=start,
            checked_in_at=start,
        )

        response = self.client.patch(
            reverse("api-day-use-extend", kwargs={"day_use_id": day_use.id}),
            data=json.dumps({"extra_hours": 2}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("extra_hours", response.json()["errors"])

    def test_day_use_api_convert_to_night_creates_booking(self):
        start = timezone.now() - timedelta(hours=1)
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.IN_PROGRESS,
            package_price=Decimal("24000.00"),
            total_amount=Decimal("24000.00"),
            final_amount=Decimal("24000.00"),
            subtotal_amount=Decimal("24000.00"),
            hourly_rate=Decimal("12000.00"),
            expected_duration_hours=2,
            planned_entry_at=start,
            start_datetime=start,
            end_datetime=start + timedelta(hours=2),
            check_in_at=start,
            checked_in_at=start,
        )

        response = self.client.post(reverse("api-day-use-convert-to-night", kwargs={"day_use_id": day_use.id}))

        self.assertEqual(response.status_code, 201)
        day_use.refresh_from_db()
        self.assertTrue(day_use.converted_to_night)
        self.assertIsNotNone(day_use.converted_reservation_id)
        self.assertTrue(Booking.objects.filter(pk=day_use.converted_reservation_id).exists())
