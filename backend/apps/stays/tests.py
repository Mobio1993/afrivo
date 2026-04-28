import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.bookings.models import Booking
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay


User = get_user_model()


class StayModelTests(TestCase):
    def setUp(self):
        self.guest = Guest.objects.create(
            first_name="Awa",
            last_name="Diop",
            phone="+221770000001",
        )
        self.room_type = RoomType.objects.create(
            name="Standard",
            code="STD",
            capacity=2,
            max_adults=2,
            max_children=1,
            base_price_per_night=50000,
        )
        self.room = Room.objects.create(number="101", room_type=self.room_type)

    def test_create_from_booking_populates_reel_and_prevu_fields(self):
        booking = Booking.objects.create(
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            source=Booking.BookingSource.PHONE,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
            adults=1,
            children=1,
        )

        stay = Stay.create_from_booking(booking, actor=None)

        self.assertEqual(stay.source, Booking.BookingSource.PHONE)
        self.assertIsNotNone(stay.planned_check_in)
        self.assertIsNotNone(stay.actual_check_in)
        self.assertIsNotNone(stay.planned_check_out)
        self.assertEqual(stay.expected_check_out_date, booking.check_out_date)
        self.assertEqual(stay.number_of_guests, 2)
        self.assertEqual(stay.adults_count, 1)
        self.assertEqual(stay.children_count, 1)

    def test_walk_in_stay_blocks_second_active_stay_for_same_room(self):
        Stay.create_walk_in(
            guest=self.guest,
            room=self.room,
            actual_check_in=timezone.now(),
        )
        other_guest = Guest.objects.create(
            first_name="Moussa",
            last_name="Keita",
            phone="+22370000001",
        )

        with self.assertRaises(ValidationError):
            Stay.create_walk_in(
                guest=other_guest,
                room=self.room,
                actual_check_in=timezone.now(),
            )

    def test_complete_checkout_sets_actual_checkout_and_room_cleaning(self):
        user = User.objects.create_user(username="agent", password="testpass123")
        stay = Stay.create_walk_in(
            guest=self.guest,
            room=self.room,
            actual_check_in=timezone.now(),
            actor=user,
        )

        stay.complete_checkout(actor=user)
        stay.refresh_from_db()
        self.room.refresh_from_db()

        self.assertEqual(stay.status, Stay.Status.COMPLETED)
        self.assertIsNotNone(stay.actual_check_out)
        self.assertEqual(stay.checked_out_by, user)
        self.assertEqual(self.room.status, Room.Status.CLEANING)


class StayApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reception",
            password="testpass123",
            role=User.Role.RECEPTION,
        )
        self.client.force_login(self.user)
        self.guest = Guest.objects.create(
            first_name="Fatou",
            last_name="Ndiaye",
            phone="+221770000002",
        )
        self.room_type = RoomType.objects.create(
            name="Deluxe",
            code="DLX",
            capacity=3,
            max_adults=2,
            max_children=1,
            base_price_per_night=75000,
        )
        self.room = Room.objects.create(number="202", room_type=self.room_type)

    def test_create_stay_endpoint_supports_walk_in_without_booking(self):
        response = self.client.post(
            reverse("api-create-stay"),
            data=json.dumps(
                {
                    "guest_id": self.guest.id,
                    "room_id": self.room.id,
                    "source": "walk_in",
                    "planned_check_out": (timezone.now() + timedelta(days=1)).isoformat(),
                    "adults_count": 2,
                    "children_count": 0,
                    "purpose_of_stay": "Business",
                    "notes": "Arrivee sans reservation",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()["stay"]
        self.assertEqual(payload["guest"], self.guest.full_name)
        self.assertEqual(payload["room"], self.room.number)
        self.assertEqual(payload["source_code"], "walk_in")
        self.assertEqual(payload["number_of_guests"], 2)
