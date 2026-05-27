from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.tenancy.models import Hotel, HotelSettings, Organization


class BookingRobustnessTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Booking Group", slug="booking-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Booking Hotel",
            code="BKG",
            slug="booking-hotel",
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Booking",
            phone="+221770010001",
        )
        self.other_guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Moussa",
            last_name="Booking",
            phone="+221770010002",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Standard Booking",
            code="BKG-STD",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=Decimal("50000.00"),
            base_price_day_use=Decimal("20000.00"),
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="B101",
            room_type=self.room_type,
            status=Room.Status.AVAILABLE,
        )
        self.arrival = timezone.localdate() + timedelta(days=2)
        self.departure = self.arrival + timedelta(days=2)

    def build_booking(self, **overrides):
        values = {
            "hotel": self.hotel,
            "guest": self.guest,
            "room_type": self.room_type,
            "room": self.room,
            "check_in_date": self.arrival,
            "check_out_date": self.departure,
            "adults": 1,
            "children": 0,
        }
        values.update(overrides)
        return Booking(**values)

    def test_booking_rejects_out_of_service_room_for_active_status(self):
        self.room.status = Room.Status.OUT_OF_SERVICE
        self.room.save(update_fields=["status", "updated_at"])

        with self.assertRaises(ValidationError) as context:
            self.build_booking(status=Booking.Status.CONFIRMED).save()

        self.assertIn("hors service", str(context.exception))

    def test_booking_allows_cancelled_overlap_without_blocking_room_availability(self):
        Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CANCELLED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        active = self.build_booking(
            guest=self.other_guest,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival + timedelta(days=1),
            check_out_date=self.departure + timedelta(days=1),
        )
        active.save()

        self.assertEqual(active.status, Booking.Status.CONFIRMED)

    def test_confirm_controls_status_transition_and_rechecks_overlap(self):
        Booking.objects.create(
            hotel=self.hotel,
            guest=self.other_guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            status=Booking.Status.PENDING,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        booking.room = self.room

        with self.assertRaises(ValidationError):
            booking.confirm()

    def test_confirm_requires_paid_deposit_when_hotel_policy_requires_it(self):
        HotelSettings.objects.create(
            hotel=self.hotel,
            deposit_required=True,
            deposit_percentage=Decimal("30.00"),
        )
        booking = self.build_booking(
            room=None,
            status=Booking.Status.PENDING,
            estimated_amount=Decimal("100000.00"),
        )
        booking.save()

        with self.assertRaises(ValidationError) as context:
            booking.confirm()

        self.assertIn("avance", str(context.exception))

        Payment.objects.create(
            hotel=self.hotel,
            client=self.guest,
            booking=booking,
            amount=Decimal("30000.00"),
            payment_type=Payment.PaymentType.ADVANCE,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            notes="Acompte reservation.",
        )
        booking.confirm()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)

    def test_cancel_and_mark_no_show_transitions(self):
        pending = self.build_booking(room=None, status=Booking.Status.PENDING)
        pending.save()
        pending.cancel()
        self.assertEqual(pending.status, Booking.Status.CANCELLED)

        confirmed = self.build_booking(
            room=None,
            guest=self.other_guest,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.departure + timedelta(days=1),
            check_out_date=self.departure + timedelta(days=2),
        )
        confirmed.save()
        confirmed.mark_no_show()
        self.assertEqual(confirmed.status, Booking.Status.NO_SHOW)


class BookingNoShowCatchUpCommandTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="No Show Group", slug="no-show-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="No Show Hotel",
            code="NSH",
            slug="no-show-hotel",
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Late",
            phone="+221770030001",
        )
        self.other_guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Moussa",
            last_name="Today",
            phone="+221770030002",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="No Show Standard",
            code="NSH-STD",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=Decimal("45000.00"),
            base_price_day_use=Decimal("18000.00"),
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="N101",
            room_type=self.room_type,
            status=Room.Status.AVAILABLE,
        )
        self.today = timezone.localdate()

    def create_booking(self, **overrides):
        values = {
            "hotel": self.hotel,
            "guest": self.guest,
            "room_type": self.room_type,
            "room": None,
            "status": Booking.Status.CONFIRMED,
            "check_in_date": self.today - timedelta(days=1),
            "check_out_date": self.today + timedelta(days=1),
            "adults": 1,
            "children": 0,
        }
        values.update(overrides)
        return Booking.objects.create(**values)

    def test_command_marks_only_overdue_confirmed_bookings_no_show(self):
        overdue = self.create_booking(room=self.room)
        today_booking = self.create_booking(
            guest=self.other_guest,
            check_in_date=self.today + timedelta(days=1),
            check_out_date=self.today + timedelta(days=3),
        )
        pending = self.create_booking(
            status=Booking.Status.PENDING,
            check_in_date=self.today - timedelta(days=2),
            check_out_date=self.today - timedelta(days=1),
        )

        output = StringIO()
        call_command("mark_booking_no_shows", stdout=output)

        overdue.refresh_from_db()
        today_booking.refresh_from_db()
        pending.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(overdue.status, Booking.Status.NO_SHOW)
        self.assertEqual(today_booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(pending.status, Booking.Status.PENDING)
        self.assertEqual(self.room.status, Room.Status.AVAILABLE)
        self.assertIn("1 reservation(s) traitee(s)", output.getvalue())

    def test_command_dry_run_does_not_change_booking(self):
        overdue = self.create_booking(room=self.room)

        output = StringIO()
        call_command("mark_booking_no_shows", "--dry-run", stdout=output)

        overdue.refresh_from_db()
        self.assertEqual(overdue.status, Booking.Status.CONFIRMED)
        self.assertIn("Simulation", output.getvalue())


class DayUseRobustnessTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Day Use Group", slug="day-use-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Day Use Hotel",
            code="DAY",
            slug="day-use-hotel",
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Fatou",
            last_name="Day",
            phone="+221770020001",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Day Room",
            code="DAY-ROOM",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=Decimal("40000.00"),
            base_price_day_use=Decimal("15000.00"),
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="D101",
            room_type=self.room_type,
            status=Room.Status.AVAILABLE,
        )

    def test_day_use_clean_handles_missing_room_without_attribute_error(self):
        day_use = DayUse(
            hotel=self.hotel,
            guest=self.guest,
            package_price=Decimal("15000.00"),
            overtime_fee=Decimal("0.00"),
        )

        with self.assertRaises(ValidationError) as context:
            day_use.full_clean()

        self.assertIn("room", context.exception.message_dict)

    def test_day_use_rejects_out_of_service_room(self):
        self.room.status = Room.Status.OUT_OF_SERVICE
        self.room.save(update_fields=["status", "updated_at"])

        with self.assertRaises(ValidationError) as context:
            DayUse.objects.create(
                hotel=self.hotel,
                guest=self.guest,
                room=self.room,
                package_price=Decimal("15000.00"),
                overtime_fee=Decimal("0.00"),
            )

        self.assertIn("hors service", str(context.exception))

    def test_paid_amount_uses_paid_payments_only(self):
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            package_price=Decimal("15000.00"),
            overtime_fee=Decimal("0.00"),
        )
        Payment.objects.create(
            day_use=day_use,
            amount=Decimal("5000.00"),
            status=Payment.Status.PAID,
            payment_type=Payment.PaymentType.DAY_USE_PREPAYMENT,
        )
        Payment.objects.create(
            day_use=day_use,
            amount=Decimal("3000.00"),
            status=Payment.Status.CANCELLED,
            payment_type=Payment.PaymentType.DAY_USE_PREPAYMENT,
        )

        self.assertEqual(day_use.paid_amount, Decimal("5000.00"))
