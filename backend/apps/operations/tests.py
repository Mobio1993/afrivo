import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.bookings.models import Booking, DayUse
from apps.guests.models import Guest
from apps.operations.models import RoomRelocation
from apps.platform_admin.models import PlatformModule
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenancy.models import Hotel, HotelSettings, Organization

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

    def test_modularized_operations_routes_keep_public_paths(self):
        self.assertEqual(reverse("api-operations-planning"), "/api/operations/planning/")
        self.assertEqual(reverse("api-operations-board"), "/api/operations/board/")
        self.assertEqual(reverse("api-create-booking"), "/api/operations/bookings/create/")


class OperationsPermissionTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Permission Group", slug="permission-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Permission Hotel",
            code="PERM",
            slug="permission-hotel",
        )
        self.user = User.objects.create_user(
            username="cashier-ops",
            password="testpass123",
            role=User.Role.CASHIER,
            organization=self.organization,
            hotel=self.hotel,
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

    def test_planning_is_limited_to_active_hotel(self):
        today = timezone.localdate()
        booking_a = Booking.objects.create(
            hotel=self.hotel_a,
            guest=self.guest_a,
            room_type=self.room_type_a,
            room=self.available_room_a,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=1),
            adults=1,
            children=0,
        )
        booking_b = Booking.objects.create(
            hotel=self.hotel_b,
            guest=self.guest_b,
            room_type=self.room_type_b,
            room=self.day_use_room_b,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=1),
            adults=1,
            children=0,
        )

        response = self.client.get(reverse("api-operations-planning"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        reservation_refs = {item["reference"] for item in payload["reservations"]}
        room_ids = {item["id"] for item in payload["rooms"]}
        self.assertIn(booking_a.reference, reservation_refs)
        self.assertNotIn(booking_b.reference, reservation_refs)
        self.assertIn(self.available_room_a.id, room_ids)
        self.assertNotIn(self.day_use_room_b.id, room_ids)

    def test_all_operations_is_limited_to_active_hotel(self):
        today = timezone.localdate()
        booking_a = Booking.objects.create(
            hotel=self.hotel_a,
            guest=self.guest_a,
            room_type=self.room_type_a,
            room=self.available_room_a,
            status=Booking.Status.CONFIRMED,
            check_in_date=today + timedelta(days=1),
            check_out_date=today + timedelta(days=2),
            adults=1,
            children=0,
            estimated_amount=Decimal("25000.00"),
        )
        booking_b = Booking.objects.create(
            hotel=self.hotel_b,
            guest=self.guest_b,
            room_type=self.room_type_b,
            room=self.day_use_room_b,
            status=Booking.Status.CONFIRMED,
            check_in_date=today + timedelta(days=4),
            check_out_date=today + timedelta(days=5),
            adults=1,
            children=0,
            estimated_amount=Decimal("45000.00"),
        )
        payment_a = Payment.objects.create(
            hotel=self.hotel_a,
            client=self.guest_a,
            booking=booking_a,
            amount=Decimal("10000.00"),
            payment_type=Payment.PaymentType.ADVANCE,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            notes="Avance reservation hotel A.",
        )
        payment_b = Payment.objects.create(
            hotel=self.hotel_b,
            client=self.guest_b,
            booking=booking_b,
            amount=Decimal("12000.00"),
            payment_type=Payment.PaymentType.ADVANCE,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            notes="Avance reservation hotel B.",
        )

        response = self.client.get(reverse("api-operations-all"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        references = {item["reference"] for item in payload["results"]}
        self.assertIn(booking_a.reference, references)
        self.assertIn(payment_a.reference, references)
        self.assertIn(self.stay_a.reference, references)
        self.assertIn(self.day_use_a.reference, references)
        self.assertNotIn(booking_b.reference, references)
        self.assertNotIn(payment_b.reference, references)
        self.assertNotIn(self.stay_b.reference, references)
        self.assertNotIn(self.day_use_b.reference, references)

    def test_all_operations_filters_type_and_payment_status(self):
        today = timezone.localdate()
        booking = Booking.objects.create(
            hotel=self.hotel_a,
            guest=self.guest_a,
            room_type=self.room_type_a,
            room=self.available_room_a,
            status=Booking.Status.CONFIRMED,
            check_in_date=today + timedelta(days=3),
            check_out_date=today + timedelta(days=4),
            adults=1,
            children=0,
            estimated_amount=Decimal("30000.00"),
        )
        Payment.objects.create(
            hotel=self.hotel_a,
            client=self.guest_a,
            booking=booking,
            amount=Decimal("30000.00"),
            payment_type=Payment.PaymentType.ADVANCE,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            notes="Avance reservation.",
        )

        response = self.client.get(
            reverse("api-operations-all"),
            {
                "type": "booking",
                "payment_status": "paid",
                "search": booking.reference,
                "ordering": "-amount",
                "room": self.available_room_a.number,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        item = payload["results"][0]
        self.assertEqual(item["entity_type"], "bookings")
        self.assertEqual(item["reference"], booking.reference)
        self.assertEqual(item["payment_status"], "paid")
        self.assertEqual(item["detail_url"], f"/operations/bookings/{booking.id}")

    def test_all_operations_denies_explicit_unlicensed_module_type(self):
        PlatformModule.objects.create(
            code="day-use",
            name="Day Use",
            monthly_license_price=Decimal("1000.00"),
            is_active=True,
        )

        response = self.client.get(reverse("api-operations-all"), {"type": "day-uses"})

        self.assertEqual(response.status_code, 403)
        payload = response.json()
        self.assertEqual(payload["code"], "module_license_denied")


class OperationsRelocationTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Relocation Group", slug="relocation-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Relocation Hotel",
            code="REL",
            slug="relocation-hotel",
        )
        self.other_hotel = Hotel.objects.create(
            organization=self.organization,
            name="Other Relocation Hotel",
            code="REL2",
            slug="other-relocation-hotel",
        )
        self.user = User.objects.create_user(
            username="relocation-agent",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.client.force_login(self.user)
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Standard Relocation",
            code="REL-STD",
            base_price_per_night=25000,
        )
        self.other_room_type = RoomType.objects.create(
            hotel=self.other_hotel,
            name="Other Standard Relocation",
            code="REL2-STD",
            base_price_per_night=30000,
        )
        self.old_room = Room.objects.create(hotel=self.hotel, number="501", room_type=self.room_type)
        self.new_room = Room.objects.create(hotel=self.hotel, number="502", room_type=self.room_type)
        self.stay_new_room = Room.objects.create(hotel=self.hotel, number="503", room_type=self.room_type)
        self.other_hotel_room = Room.objects.create(hotel=self.other_hotel, number="601", room_type=self.other_room_type)
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Relogement",
            last_name="Client",
            phone="+225070000001",
        )

    def test_relocate_booking_updates_room_and_creates_history(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.old_room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() + timedelta(days=1),
            check_out_date=timezone.localdate() + timedelta(days=3),
            estimated_amount=50000,
        )

        response = self.client.post(
            reverse("api-relocate-booking", kwargs={"booking_id": booking.id}),
            data=json.dumps({"new_room_id": self.new_room.id, "reason": "Demande client"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        self.new_room.refresh_from_db()
        self.assertEqual(booking.room_id, self.new_room.id)
        self.assertEqual(RoomRelocation.objects.filter(booking=booking).count(), 1)
        self.assertEqual(self.new_room.status, Room.Status.RESERVED)

    def test_relocate_booking_requires_reason(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.old_room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() + timedelta(days=1),
            check_out_date=timezone.localdate() + timedelta(days=3),
        )

        response = self.client.post(
            reverse("api-relocate-booking", kwargs={"booking_id": booking.id}),
            data=json.dumps({"new_room_id": self.new_room.id}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.json()["errors"])

    def test_relocate_booking_rejects_room_from_other_hotel(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.old_room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() + timedelta(days=1),
            check_out_date=timezone.localdate() + timedelta(days=3),
        )

        response = self.client.post(
            reverse("api-relocate-booking", kwargs={"booking_id": booking.id}),
            data=json.dumps({"new_room_id": self.other_hotel_room.id, "reason": "Test hotel"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    def test_relocate_active_stay_updates_stay_booking_and_room_statuses(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.old_room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
            estimated_amount=50000,
        )
        stay = Stay.create_from_booking(booking, actor=self.user)

        response = self.client.post(
            reverse("api-relocate-stay", kwargs={"stay_id": stay.id}),
            data=json.dumps({"new_room_id": self.stay_new_room.id, "reason": "Climatisation defectueuse"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        stay.refresh_from_db()
        booking.refresh_from_db()
        self.old_room.refresh_from_db()
        self.stay_new_room.refresh_from_db()
        self.assertEqual(stay.room_id, self.stay_new_room.id)
        self.assertEqual(booking.room_id, self.stay_new_room.id)
        self.assertEqual(self.stay_new_room.status, Room.Status.OCCUPIED)
        self.assertEqual(self.old_room.status, Room.Status.CLEANING)
        self.assertEqual(RoomRelocation.objects.filter(stay=stay).count(), 1)


class ReservationWorkflowRobustnessTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Workflow Group", slug="workflow-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Workflow Hotel",
            code="WFH",
            slug="workflow-hotel",
        )
        self.settings = HotelSettings.objects.create(hotel=self.hotel)
        self.user = User.objects.create_user(
            username="workflow-agent",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.client.force_login(self.user)
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Workflow",
            phone="+221770000901",
        )
        self.other_guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Moussa",
            last_name="Workflow",
            phone="+221770000902",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Workflow Suite",
            code="WF-SUITE",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=100,
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="501",
            room_type=self.room_type,
            status=Room.Status.AVAILABLE,
        )
        self.arrival = timezone.localdate() + timedelta(days=3)
        self.departure = self.arrival + timedelta(days=3)

    def _booking_payload(self, *, guest=None, check_in_date=None, check_out_date=None, estimated_amount="300.00"):
        return {
            "guest_id": (guest or self.guest).id,
            "room_type_id": self.room_type.id,
            "room_id": self.room.id,
            "source": Booking.BookingSource.PHONE,
            "check_in_date": (check_in_date or self.arrival).isoformat(),
            "check_out_date": (check_out_date or self.departure).isoformat(),
            "adults": 1,
            "children": 0,
            "estimated_amount": estimated_amount,
            "notes": "",
        }

    def test_create_booking_rejects_overlapping_room_period(self):
        Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.post(
            reverse("api-create-booking"),
            data=json.dumps(
                self._booking_payload(
                    guest=self.other_guest,
                    check_in_date=self.arrival + timedelta(days=1),
                    check_out_date=self.departure + timedelta(days=1),
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Cette chambre est déjà réservée sur cette période.", str(response.json()))

    def test_create_booking_rejects_past_arrival_date(self):
        response = self.client.post(
            reverse("api-create-booking"),
            data=json.dumps(
                self._booking_payload(
                    check_in_date=timezone.localdate() - timedelta(days=1),
                    check_out_date=timezone.localdate() + timedelta(days=1),
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("ne peut pas etre anterieure a aujourd'hui", str(response.json()))

    def test_create_booking_with_advance_creates_invoice_and_payment(self):
        response = self.client.post(
            reverse("api-create-booking"),
            data=json.dumps(
                {
                    **self._booking_payload(estimated_amount="300.00"),
                    "advance_amount": "90.00",
                    "advance_method": Payment.Method.CASH,
                    "advance_reference": "RECU-AV-001",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        booking = Booking.objects.get(pk=payload["booking"]["id"])
        invoice = ClientInvoice.objects.get(reservation=booking)
        payment = Payment.objects.get(booking=booking)

        self.assertEqual(invoice.status, ClientInvoice.Status.PAID)
        self.assertEqual(invoice.total_amount, Decimal("90.00"))
        self.assertEqual(invoice.amount_paid, Decimal("90.00"))
        self.assertEqual(payment.invoice_id, invoice.id)
        self.assertEqual(payment.amount, Decimal("90.00"))
        self.assertEqual(payload["advance_invoice"]["id"], invoice.id)
        self.assertEqual(payload["advance_payment"]["id"], payment.id)

    def test_update_booking_rejects_overlapping_room_period(self):
        existing = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        edited = Booking.objects.create(
            hotel=self.hotel,
            guest=self.other_guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.PENDING,
            check_in_date=self.departure + timedelta(days=1),
            check_out_date=self.departure + timedelta(days=2),
            adults=1,
            children=0,
        )

        response = self.client.post(
            reverse("api-update-booking", kwargs={"booking_id": edited.id}),
            data=json.dumps(
                self._booking_payload(
                    guest=self.other_guest,
                    check_in_date=existing.check_in_date + timedelta(days=1),
                    check_out_date=existing.check_out_date + timedelta(days=1),
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Cette chambre est déjà réservée sur cette période.", str(response.json()))

    def test_update_booking_rejects_past_arrival_date(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.PENDING,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.post(
            reverse("api-update-booking", kwargs={"booking_id": booking.id}),
            data=json.dumps(
                self._booking_payload(
                    check_in_date=timezone.localdate() - timedelta(days=1),
                    check_out_date=timezone.localdate() + timedelta(days=1),
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("ne peut pas etre anterieure a aujourd'hui", str(response.json()))

    def test_confirm_booking_rechecks_room_availability(self):
        target = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.PENDING,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        self.room.status = Room.Status.OUT_OF_SERVICE
        self.room.save(update_fields=["status", "updated_at"])

        response = self.client.post(reverse("api-confirm-booking", kwargs={"booking_id": target.id}))

        self.assertEqual(response.status_code, 400)
        self.assertIn("hors service", str(response.json()))

    def test_mark_booking_no_show_api_updates_confirmed_booking(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.post(reverse("api-booking-no-show", kwargs={"booking_id": booking.id}))

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.NO_SHOW)
        self.assertEqual(self.room.status, Room.Status.AVAILABLE)

    def test_mark_booking_no_show_api_rejects_pending_booking(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.PENDING,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.post(reverse("api-booking-no-show", kwargs={"booking_id": booking.id}))

        self.assertEqual(response.status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.PENDING)
        self.assertIn("Seule une reservation confirmee", str(response.json()))

    def test_booking_check_in_rejects_before_arrival_date(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.post(
            reverse("api-booking-check-in", kwargs={"booking_id": booking.id}),
            data=json.dumps({}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("avant la date d'arrivee prevue", str(response.json()))
        self.assertFalse(Stay.objects.filter(booking=booking).exists())

    def test_booking_detail_disables_check_in_before_arrival_date(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.get(reverse("api-booking-detail", kwargs={"booking_id": booking.id}))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        check_in_action = next(item for item in payload["context_actions"] if item["label"] == "Effectuer le check-in")
        self.assertFalse(check_in_action["enabled"])
        self.assertEqual(payload["workflow_forms"], [])

    def test_blocking_checkout_policy_requires_full_payment(self):
        today = timezone.localdate()
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=3),
            adults=1,
            children=0,
            estimated_amount="300.00",
        )
        stay = Stay.create_from_booking(booking, actor=self.user)

        response = self.client.post(reverse("api-stay-check-out", kwargs={"stay_id": stay.id}))

        self.assertEqual(response.status_code, 400)
        self.assertIn("Check-out impossible : le séjour n’est pas entièrement payé.", str(response.json()))

    def test_non_blocking_checkout_policy_allows_unpaid_balance(self):
        self.settings.checkout_payment_policy = HotelSettings.CheckoutPaymentPolicy.NON_BLOCKING
        self.settings.save(update_fields=["checkout_payment_policy", "updated_at"])
        today = timezone.localdate()
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=3),
            adults=1,
            children=0,
            estimated_amount="300.00",
        )
        stay = Stay.create_from_booking(booking, actor=self.user)

        response = self.client.post(reverse("api-stay-check-out", kwargs={"stay_id": stay.id}))

        self.assertEqual(response.status_code, 200)
        stay.refresh_from_db()
        self.assertEqual(stay.status, Stay.Status.COMPLETED)
        self.assertEqual(stay.get_financial_totals()["unpaid_balance"], Decimal("300.00"))

    def test_planning_excludes_cancelled_and_no_show_bookings(self):
        visible = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        cancelled = Booking.objects.create(
            hotel=self.hotel,
            guest=self.other_guest,
            room_type=self.room_type,
            room=None,
            status=Booking.Status.CANCELLED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )
        no_show = Booking.objects.create(
            hotel=self.hotel,
            guest=self.other_guest,
            room_type=self.room_type,
            room=None,
            status=Booking.Status.NO_SHOW,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
        )

        response = self.client.get(
            reverse("api-operations-planning"),
            {"start_date": self.arrival.isoformat(), "end_date": self.departure.isoformat()},
        )

        self.assertEqual(response.status_code, 200)
        references = {item["reference"] for item in response.json()["reservations"]}
        self.assertIn(visible.reference, references)
        self.assertNotIn(cancelled.reference, references)
        self.assertNotIn(no_show.reference, references)

    def test_create_payment_rejects_client_booking_mismatch(self):
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=self.arrival,
            check_out_date=self.departure,
            adults=1,
            children=0,
            estimated_amount="300.00",
        )

        response = self.client.post(
            reverse("api-create-payment"),
            data=json.dumps(
                {
                    "client_id": self.other_guest.id,
                    "booking_id": booking.id,
                    "status": Payment.Status.PAID,
                    "payment_type": Payment.PaymentType.ADVANCE,
                    "method": Payment.Method.CASH,
                    "amount": "50.00",
                    "paid_at": timezone.now().isoformat(),
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("meme client", str(response.json()))

    def test_create_payment_for_stay_attaches_active_invoice(self):
        today = timezone.localdate()
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=2),
            adults=1,
            children=0,
            estimated_amount="300.00",
        )
        stay = Stay.create_from_booking(booking, actor=self.user)
        invoice = ClientInvoice.objects.create(hotel=self.hotel, client=self.guest, stay=stay, reservation=booking)
        invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("300.00"))

        response = self.client.post(
            reverse("api-create-payment"),
            data=json.dumps(
                {
                    "stay_id": stay.id,
                    "status": Payment.Status.PAID,
                    "method": Payment.Method.CASH,
                    "amount": "100.00",
                    "paid_at": timezone.now().isoformat(),
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payment = Payment.objects.get(id=response.json()["payment"]["id"])
        invoice.refresh_from_db()
        self.assertEqual(payment.invoice_id, invoice.id)
        self.assertEqual(payment.payment_type, Payment.PaymentType.PARTIAL)
        self.assertEqual(invoice.amount_paid, Decimal("100.00"))
        self.assertEqual(invoice.balance_due, Decimal("200.00"))

    def test_create_payment_for_stay_without_invoice_creates_advance_invoice(self):
        today = timezone.localdate()
        booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=today,
            check_out_date=today + timedelta(days=2),
            adults=1,
            children=0,
            estimated_amount="300.00",
        )
        stay = Stay.create_from_booking(booking, actor=self.user)

        response = self.client.post(
            reverse("api-create-payment"),
            data=json.dumps(
                {
                    "stay_id": stay.id,
                    "status": Payment.Status.PAID,
                    "method": Payment.Method.CASH,
                    "amount": "100.00",
                    "paid_at": timezone.now().isoformat(),
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payment = Payment.objects.select_related("invoice").get(id=response.json()["payment"]["id"])
        self.assertIsNotNone(payment.invoice_id)
        self.assertEqual(payment.invoice.status, ClientInvoice.Status.PAID)
        self.assertEqual(payment.invoice.reservation_id, booking.id)
        self.assertIsNone(payment.invoice.stay_id)
        self.assertTrue(payment.invoice.items.filter(label__icontains="Avance sejour").exists())
