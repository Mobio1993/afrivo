import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.billing.services import (
    create_booking_advance_invoice_payment,
    create_invoice_from_day_use,
    create_invoice_from_stay,
    get_billing_work_queue,
)
from apps.bookings.models import Booking, DayUse
from apps.consumptions.models import ClientConsumption, ServiceDepartment
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.tenancy.services import get_or_create_default_tenancy
from apps.stays.models import Stay
from apps.tenancy.models import Hotel, Organization


User = get_user_model()


class ClientInvoiceModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="billing", password="testpass123")
        self.guest = Guest.objects.create(first_name="Mariama", last_name="Fall", phone="+221771112233")
        self.room_type = RoomType.objects.create(
            name="Executive",
            code="EXE",
            capacity=3,
            max_adults=2,
            max_children=1,
            base_price_per_night=120000,
        )
        self.room = Room.objects.create(number="509", room_type=self.room_type)
        self.booking = Booking.objects.create(
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
        )
        self.stay = Stay.create_from_booking(self.booking, actor=self.user)
        self.department = ServiceDepartment.objects.create(code="spa", name="Spa")
        self.consumption = ClientConsumption.objects.create(
            client=self.guest,
            stay=self.stay,
            service_department=self.department,
            label="Massage premium",
            quantity=Decimal("2.00"),
            unit_price=Decimal("15000.00"),
        )

    def test_invoice_aggregates_lines_and_marks_consumption_as_billed(self):
        invoice = ClientInvoice.objects.create(
            client=self.guest,
            stay=self.stay,
            notes="Facture de test",
        )
        invoice.items.create(
            consumption=self.consumption,
            label="Massage premium",
            quantity=Decimal("2.00"),
            unit_price=Decimal("15000.00"),
        )
        invoice.refresh_from_db()
        self.consumption.refresh_from_db()

        self.assertEqual(invoice.subtotal_amount, Decimal("30000.00"))
        self.assertEqual(invoice.total_amount, Decimal("30000.00"))
        self.assertEqual(invoice.balance_due, Decimal("30000.00"))
        self.assertEqual(self.consumption.status, ClientConsumption.Status.BILLED)
        self.assertEqual(self.consumption.billing_reference, invoice.reference)

    def test_invoice_amount_paid_follows_paid_payments(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("50000.00"),
        )

        Payment.objects.create(
            invoice=invoice,
            stay=self.stay,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            amount=Decimal("20000.00"),
            paid_at=timezone.now(),
        )
        invoice.refresh_from_db()

        self.assertEqual(invoice.amount_paid, Decimal("20000.00"))
        self.assertEqual(invoice.balance_due, Decimal("30000.00"))
        self.assertEqual(invoice.status, ClientInvoice.Status.PARTIALLY_PAID)


class BillingWorkQueueTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Billing Queue Group", slug="billing-queue-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Billing Queue Hotel",
            slug="billing-queue-hotel",
            code="BQH",
        )
        self.user = User.objects.create_user(username="billing-queue", password="testpass123")
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Sow",
            phone="+221771110000",
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Standard Queue",
            code="STQ",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=50000,
        )
        self.room = Room.objects.create(hotel=self.hotel, number="610", room_type=self.room_type)
        self.booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() - timedelta(days=2),
            check_out_date=timezone.localdate() - timedelta(days=1),
            estimated_amount=Decimal("50000.00"),
        )
        self.stay = Stay.create_from_booking(self.booking, actor=self.user)
        self.stay.status = Stay.Status.COMPLETED
        self.stay.actual_check_out = timezone.now()
        self.stay.check_out_at = timezone.now()
        self.stay.save(update_fields=["status", "actual_check_out", "check_out_at", "updated_at"])
        self.department = ServiceDepartment.objects.create(code="minibar", name="Minibar")
        self.consumption = ClientConsumption.objects.create(
            hotel=self.hotel,
            client=self.guest,
            stay=self.stay,
            room=self.room,
            service_department=self.department,
            label="Mini bar",
            quantity=Decimal("1.00"),
            unit_price=Decimal("8000.00"),
            status=ClientConsumption.Status.POSTED,
        )

    def test_work_queue_lists_stays_and_unbilled_consumptions(self):
        queue = get_billing_work_queue(self.hotel)

        self.assertEqual(queue["stays_without_invoice_count"], 1)
        self.assertEqual(queue["unbilled_consumptions_count"], 1)
        self.assertEqual(queue["total_count"], 2)
        self.assertEqual(queue["items"][0]["type"], "stay")

    def test_work_queue_excludes_stay_when_active_invoice_exists(self):
        invoice = ClientInvoice.objects.create(hotel=self.hotel, client=self.guest, stay=self.stay)
        invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("50000.00"))

        queue = get_billing_work_queue(self.hotel)

        self.assertEqual(queue["stays_without_invoice_count"], 0)

    def test_work_queue_lists_issued_invoices_with_balance_due(self):
        invoice = ClientInvoice.objects.create(
            hotel=self.hotel,
            client=self.guest,
            status=ClientInvoice.Status.ISSUED,
        )
        invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("30000.00"))
        invoice.refresh_from_db()

        queue = get_billing_work_queue(self.hotel)

        self.assertEqual(queue["unpaid_invoices_count"], 1)
        self.assertTrue(any(item["type"] == "invoice_payment" and item["source_id"] == invoice.id for item in queue["items"]))

    def test_create_invoice_from_stay_generates_draft_with_consumptions(self):
        invoice = create_invoice_from_stay(self.stay, user=self.user)
        self.consumption.refresh_from_db()

        self.assertEqual(invoice.stay_id, self.stay.id)
        self.assertEqual(invoice.reservation_id, self.booking.id)
        self.assertEqual(invoice.status, ClientInvoice.Status.DRAFT)
        self.assertEqual(invoice.items.count(), 2)
        self.assertEqual(self.consumption.status, ClientConsumption.Status.BILLED)

    def test_create_invoice_from_stay_imputes_paid_booking_advance(self):
        advance_invoice, advance_payment = create_booking_advance_invoice_payment(
            self.booking,
            amount=Decimal("15000.00"),
            method=Payment.Method.CASH,
            user=self.user,
            external_reference="ADV-001",
        )

        invoice = create_invoice_from_stay(self.stay, user=self.user)
        advance_invoice.refresh_from_db()
        advance_payment.refresh_from_db()

        self.assertEqual(invoice.subtotal_amount, Decimal("58000.00"))
        self.assertEqual(invoice.discount_amount, Decimal("15000.00"))
        self.assertEqual(invoice.total_amount, Decimal("43000.00"))
        self.assertEqual(invoice.balance_due, Decimal("43000.00"))
        self.assertIn("Avance imputee automatiquement", invoice.notes)
        self.assertIn(advance_invoice.reference, invoice.notes)
        self.assertEqual(advance_invoice.status, ClientInvoice.Status.PAID)
        self.assertEqual(advance_payment.invoice_id, advance_invoice.id)

    def test_create_invoice_from_stay_imputes_paid_stay_advance_invoice(self):
        advance_invoice = ClientInvoice.objects.create(
            hotel=self.hotel,
            client=self.guest,
            reservation=self.booking,
            source=ClientInvoice.Source.OTHER,
            notes=f"Facture d'avance sejour {self.stay.reference}.",
        )
        advance_invoice.items.create(
            label=f"Avance sejour {self.stay.reference}",
            quantity=Decimal("1.00"),
            unit_price=Decimal("10000.00"),
            room=self.room,
        )
        advance_invoice.issue()
        Payment.objects.create(
            hotel=self.hotel,
            client=self.guest,
            booking=self.booking,
            stay=self.stay,
            invoice=advance_invoice,
            amount=Decimal("10000.00"),
            method=Payment.Method.CASH,
            payment_type=Payment.PaymentType.FULL,
            status=Payment.Status.PAID,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )

        invoice = create_invoice_from_stay(self.stay, user=self.user)

        self.assertEqual(invoice.subtotal_amount, Decimal("58000.00"))
        self.assertEqual(invoice.discount_amount, Decimal("10000.00"))
        self.assertEqual(invoice.total_amount, Decimal("48000.00"))
        self.assertIn("Avance imputee automatiquement", invoice.notes)
        self.assertIn(advance_invoice.reference, invoice.notes)

    def test_create_invoice_from_day_use_generates_draft(self):
        day_use = DayUse.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room=self.room,
            status=DayUse.Status.COMPLETED,
            package_price=Decimal("25000.00"),
            total_amount=Decimal("25000.00"),
            check_out_at=timezone.now(),
        )

        invoice = create_invoice_from_day_use(day_use, user=self.user)

        self.assertEqual(invoice.day_use_id, day_use.id)
        self.assertEqual(invoice.client_id, self.guest.id)
        self.assertEqual(invoice.items.count(), 1)


class ClientPaymentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="cashbox", password="testpass123")
        self.guest = Guest.objects.create(first_name="Mame", last_name="Ba", phone="+221771234000")
        self.room_type = RoomType.objects.create(
            name="Business",
            code="BUS",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=70000,
        )
        self.room = Room.objects.create(number="204", room_type=self.room_type)
        self.booking = Booking.objects.create(
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=1),
        )
        self.stay = Stay.create_from_booking(self.booking, actor=self.user)
        self.invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        self.invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("70000.00"))

    def test_payment_infers_client_and_type_from_invoice(self):
        payment = Payment.objects.create(
            invoice=self.invoice,
            amount=Decimal("20000.00"),
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )

        self.assertEqual(payment.client_id, self.guest.id)
        self.assertEqual(payment.stay_id, self.stay.id)
        self.assertEqual(payment.booking_id, self.booking.id)
        self.assertEqual(payment.payment_type, Payment.PaymentType.PARTIAL)

    def test_payment_refreshes_invoice_balance(self):
        Payment.objects.create(
            invoice=self.invoice,
            amount=Decimal("70000.00"),
            status=Payment.Status.PAID,
            method=Payment.Method.CARD,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )
        self.invoice.refresh_from_db()

        self.assertEqual(self.invoice.amount_paid, Decimal("70000.00"))
        self.assertEqual(self.invoice.balance_due, Decimal("0.00"))
        self.assertEqual(self.invoice.status, ClientInvoice.Status.PAID)

    def test_invoice_accepts_multiple_payments_without_double_counting(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("100000.00"))

        first_payment = Payment.objects.create(
            invoice=invoice,
            amount=Decimal("40000.00"),
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal("40000.00"))
        self.assertEqual(invoice.balance_due, Decimal("60000.00"))
        self.assertEqual(invoice.status, ClientInvoice.Status.PARTIALLY_PAID)

        Payment.objects.create(
            invoice=invoice,
            amount=Decimal("60000.00"),
            status=Payment.Status.PAID,
            method=Payment.Method.CARD,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal("100000.00"))
        self.assertEqual(invoice.balance_due, Decimal("0.00"))
        self.assertEqual(invoice.status, ClientInvoice.Status.PAID)

        first_payment.save()
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal("100000.00"))
        self.assertEqual(invoice.balance_due, Decimal("0.00"))

    def test_controlled_payment_without_invoice_is_allowed_with_trace(self):
        payment = Payment.objects.create(
            client=self.guest,
            booking=self.booking,
            amount=Decimal("25000.00"),
            payment_type=Payment.PaymentType.ADVANCE,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            notes="Avance reservation client.",
            paid_at=timezone.now(),
            recorded_by=self.user,
        )

        self.assertIsNone(payment.invoice_id)
        self.assertEqual(payment.payment_type, Payment.PaymentType.ADVANCE)

    def test_payment_without_invoice_and_valid_reason_is_rejected(self):
        with self.assertRaises(Exception):
            Payment.objects.create(
                client=self.guest,
                amount=Decimal("25000.00"),
                payment_type=Payment.PaymentType.PARTIAL,
                status=Payment.Status.PAID,
                method=Payment.Method.CASH,
                paid_at=timezone.now(),
                recorded_by=self.user,
            )

    def test_payment_cannot_cross_invoice_hotel_scope(self):
        organization = Organization.objects.create(name="AFRIVO Group", slug="afrivo-group")
        hotel_a = Hotel.objects.create(organization=organization, name="Hotel A", code="HA", slug="hotel-a")
        hotel_b = Hotel.objects.create(organization=organization, name="Hotel B", code="HB", slug="hotel-b")
        guest_a = Guest.objects.create(first_name="Hotel", last_name="A", hotel=hotel_a)
        invoice_a = ClientInvoice.objects.create(client=guest_a, hotel=hotel_a)
        invoice_a.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("10000.00"))

        with self.assertRaises(Exception):
            Payment.objects.create(
                client=guest_a,
                hotel=hotel_b,
                invoice=invoice_a,
                amount=Decimal("10000.00"),
                payment_type=Payment.PaymentType.INVOICE_PAYMENT,
                status=Payment.Status.PAID,
                method=Payment.Method.CASH,
                paid_at=timezone.now(),
                recorded_by=self.user,
            )


class ClientInvoiceApiTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.user = User.objects.create_user(
            username="cashier",
            password="testpass123",
            role=User.Role.CASHIER,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.client.force_login(self.user)

        self.guest = Guest.objects.create(hotel=self.hotel, first_name="Aida", last_name="Ndiaye", phone="+221770001122")
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Deluxe",
            code="DLX",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=90000,
        )
        self.room = Room.objects.create(hotel=self.hotel, number="310", room_type=self.room_type)
        self.booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=1),
        )
        self.stay = Stay.create_from_booking(self.booking, actor=self.user)
        self.department = ServiceDepartment.objects.create(code="bar", name="Bar")
        self.consumption = ClientConsumption.objects.create(
            client=self.guest,
            stay=self.stay,
            service_department=self.department,
            label="Cocktail lounge",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

    def test_create_invoice_with_consumption_line(self):
        response = self.client.post(
            "/api/billing/client-invoices/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "notes": "Facture sejour",
                    "items": [
                        {
                            "consumption": self.consumption.id,
                            "label": "Cocktail lounge",
                            "quantity": "1.00",
                            "unit_price": "12000.00",
                        }
                    ],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["client"], self.guest.id)
        self.assertEqual(payload["stay"], self.stay.id)
        self.assertEqual(payload["subtotal_amount"], "12000.00")
        self.assertEqual(payload["balance_due"], "12000.00")
        self.assertEqual(len(payload["items"]), 1)

    def test_eligible_consumptions_excludes_already_invoiced_lines(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            consumption=self.consumption,
            label="Cocktail lounge",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        response = self.client.get(f"/api/billing/client-invoices/eligible-consumptions/?client={self.guest.id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["results"], [])

    def test_add_payment_to_invoice_action_updates_invoice_balance(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        response = self.client.post(
            f"/api/billing/client-invoices/{invoice.id}/add-payment/",
            data=json.dumps(
                {
                    "amount": "12000.00",
                    "payment_method": "cash",
                    "payment_type": Payment.PaymentType.FULL,
                    "notes": "Paiement comptoir",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["payment"]["invoice"], invoice.id)
        self.assertEqual(payload["payment"]["status"], Payment.Status.PAID)
        self.assertEqual(payload["invoice"]["amount_paid"], "12000.00")
        self.assertEqual(payload["invoice"]["balance_due"], "0.00")

    def test_add_payment_to_paid_invoice_is_rejected(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )
        Payment.objects.create(
            invoice=invoice,
            amount=Decimal("12000.00"),
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )
        invoice.refresh_from_db()

        response = self.client.post(
            f"/api/billing/client-invoices/{invoice.id}/add-payment/",
            data=json.dumps({"amount": "1000.00", "payment_method": "cash"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("deja integralement payee", response.json()["detail"])

    def test_add_payment_to_invoice_rejects_overpayment(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        response = self.client.post(
            f"/api/billing/client-invoices/{invoice.id}/add-payment/",
            data=json.dumps({"amount": "15000.00", "payment_method": "cash"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("solde restant", response.json()["detail"])
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount_paid, Decimal("0.00"))
        self.assertEqual(invoice.balance_due, Decimal("12000.00"))

    def test_add_payment_to_invoice_infers_partial_or_full_type(self):
        invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        invoice.items.create(
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("12000.00"),
        )

        partial_response = self.client.post(
            f"/api/billing/client-invoices/{invoice.id}/add-payment/",
            data=json.dumps({"amount": "5000.00", "payment_method": "cash"}),
            content_type="application/json",
        )
        self.assertEqual(partial_response.status_code, 201)
        self.assertEqual(partial_response.json()["payment"]["payment_type"], Payment.PaymentType.PARTIAL)

        full_response = self.client.post(
            f"/api/billing/client-invoices/{invoice.id}/add-payment/",
            data=json.dumps({"amount": "7000.00", "payment_method": "cash"}),
            content_type="application/json",
        )
        self.assertEqual(full_response.status_code, 201)
        self.assertEqual(full_response.json()["payment"]["payment_type"], Payment.PaymentType.FULL)
        self.assertEqual(full_response.json()["invoice"]["balance_due"], "0.00")


class ClientPaymentApiTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.user = User.objects.create_user(
            username="cashier2",
            password="testpass123",
            role=User.Role.CASHIER,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.client.force_login(self.user)

        self.guest = Guest.objects.create(hotel=self.hotel, first_name="Kadi", last_name="Sarr", phone="+221770004455")
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Premium",
            code="PRE",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=110000,
        )
        self.room = Room.objects.create(hotel=self.hotel, number="415", room_type=self.room_type)
        self.booking = Booking.objects.create(
            hotel=self.hotel,
            guest=self.guest,
            room_type=self.room_type,
            room=self.room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
        )
        self.stay = Stay.create_from_booking(self.booking, actor=self.user)
        self.invoice = ClientInvoice.objects.create(client=self.guest, stay=self.stay)
        self.invoice.items.create(label="Hebergement", quantity=Decimal("1.00"), unit_price=Decimal("110000.00"))

    def test_create_client_payment_keeps_legacy_and_new_contract(self):
        response = self.client.post(
            "/api/billing/client-payments/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "invoice": self.invoice.id,
                    "booking": self.booking.id,
                    "payment_type": Payment.PaymentType.PARTIAL,
                    "payment_method": "bank_transfer",
                    "amount": "50000.00",
                    "paid_at": timezone.now().isoformat(),
                    "status": Payment.Status.PAID,
                    "source": "frontdesk",
                    "external_reference": "MM-4455",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["client"], self.guest.id)
        self.assertEqual(payload["invoice"], self.invoice.id)
        self.assertEqual(payload["booking"], self.booking.id)
        self.assertEqual(payload["payment_method"], "bank_transfer")
        self.assertEqual(payload["payment_type"], Payment.PaymentType.PARTIAL)
        self.assertEqual(payload["external_reference"], "MM-4455")

    def test_client_payment_filters_by_invoice(self):
        payment = Payment.objects.create(
            client=self.guest,
            stay=self.stay,
            invoice=self.invoice,
            booking=self.booking,
            payment_type=Payment.PaymentType.PARTIAL,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            amount=Decimal("25000.00"),
            paid_at=timezone.now(),
            recorded_by=self.user,
        )

        response = self.client.get(f"/api/billing/client-payments/?invoice={self.invoice.id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], payment.id)

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": True,
            "consumptions": False,
            "satisfaction": False,
            "guests": False,
            "operations": False,
            "history": False,
        }
    )
    def test_billing_api_can_be_switched_to_strict_mode(self):
        self.client.force_login(
            User.objects.create_user(
                username="billing-no-hotel",
                password="testpass123",
                role=User.Role.CASHIER,
            )
        )
        response = self.client.get("/api/billing/client-payments/")

        self.assertEqual(response.status_code, 403)

    def test_reception_cannot_create_client_payment_via_billing_api(self):
        self.client.force_login(
            User.objects.create_user(
                username="frontdesk-billing",
                password="testpass123",
                role=User.Role.RECEPTION,
                organization=self.organization,
                hotel=self.hotel,
            )
        )

        response = self.client.post(
            "/api/billing/client-payments/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "invoice": self.invoice.id,
                    "booking": self.booking.id,
                    "payment_type": Payment.PaymentType.PARTIAL,
                    "payment_method": "cash",
                    "amount": "10000.00",
                    "paid_at": timezone.now().isoformat(),
                    "status": Payment.Status.PAID,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
