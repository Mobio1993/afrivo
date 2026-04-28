import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.bookings.models import Booking
from apps.consumptions.models import ClientConsumption, ServiceDepartment
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay


User = get_user_model()


class ClientConsumptionModelTests(TestCase):
    def setUp(self):
        self.guest = Guest.objects.create(
            first_name="Awa",
            last_name="Diop",
            phone="+221770000111",
        )
        self.room_type = RoomType.objects.create(
            name="Deluxe",
            code="DLX",
            capacity=3,
            max_adults=2,
            max_children=1,
            base_price_per_night=85000,
        )
        self.room = Room.objects.create(number="205", room_type=self.room_type)
        self.booking = Booking.objects.create(
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
            adults=2,
            children=0,
        )
        self.stay = Stay.create_from_booking(self.booking)
        self.department = ServiceDepartment.objects.create(
            code="spa",
            name="Spa",
            department_type=ServiceDepartment.DepartmentType.SPA,
        )

    def test_consumption_autofills_reservation_room_and_total_from_stay(self):
        consumption = ClientConsumption.objects.create(
            client=self.guest,
            stay=self.stay,
            service_department=self.department,
            label="Massage duo",
            quantity=Decimal("2.00"),
            unit_price=Decimal("15000.00"),
        )

        self.assertEqual(consumption.reservation_id, self.booking.id)
        self.assertEqual(consumption.room_id, self.room.id)
        self.assertEqual(consumption.total_amount, Decimal("30000.00"))
        self.assertFalse(consumption.is_billed)
        self.assertFalse(consumption.is_paid)

    def test_consumption_rejects_mismatched_stay_client(self):
        other_guest = Guest.objects.create(
            first_name="Moussa",
            last_name="Ba",
            phone="+221770000222",
        )
        consumption = ClientConsumption(
            client=other_guest,
            stay=self.stay,
            service_department=self.department,
            label="Soin",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        with self.assertRaises(ValidationError):
            consumption.full_clean()


class ClientConsumptionApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cashier",
            password="testpass123",
        )
        self.client.force_login(self.user)

        self.guest = Guest.objects.create(
            first_name="Awa",
            last_name="Diop",
            phone="+221770000333",
        )
        self.room_type = RoomType.objects.create(
            name="Suite",
            code="STE",
            capacity=4,
            max_adults=2,
            max_children=2,
            base_price_per_night=125000,
        )
        self.room = Room.objects.create(number="402", room_type=self.room_type)
        self.booking = Booking.objects.create(
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=1),
        )
        self.stay = Stay.create_from_booking(self.booking)
        self.department = ServiceDepartment.objects.create(
            code="restaurant",
            name="Restaurant",
            department_type=ServiceDepartment.DepartmentType.RESTAURANT,
        )

    def test_create_consumption_accepts_aliases_and_returns_compatible_payload(self):
        response = self.client.post(
            "/api/consumptions/client-consumptions/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "service": self.department.id,
                    "label": "Petit-dejeuner buffet",
                    "quantity": "2.00",
                    "unit_price": "8500.00",
                    "consumed_at": timezone.now().isoformat(),
                    "notes": "Consommation chambre",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["service_department"], self.department.id)
        self.assertEqual(payload["service"], self.department.id)
        self.assertEqual(payload["reservation"], self.booking.id)
        self.assertEqual(payload["room"], self.room.id)
        self.assertEqual(payload["room_number"], self.room.number)
        self.assertTrue(payload["consumed_at"])

    def test_list_consumptions_supports_room_and_service_filters(self):
        ClientConsumption.objects.create(
            client=self.guest,
            stay=self.stay,
            service_department=self.department,
            label="Dinner",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        response = self.client.get(
            f"/api/consumptions/client-consumptions/?room={self.room.id}&service={self.department.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["room"], self.room.id)

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": False,
            "consumptions": True,
            "satisfaction": False,
            "guests": False,
            "operations": False,
            "history": False,
        }
    )
    def test_consumptions_api_can_be_switched_to_strict_mode(self):
        response = self.client.get("/api/consumptions/client-consumptions/")

        self.assertEqual(response.status_code, 403)
