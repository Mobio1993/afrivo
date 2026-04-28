import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.bookings.models import Booking
from apps.consumptions.models import ClientConsumption, ServiceDepartment
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay


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


class ClientInvoiceApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cashier",
            password="testpass123",
            role=User.Role.CASHIER,
        )
        self.client.force_login(self.user)

        self.guest = Guest.objects.create(first_name="Aida", last_name="Ndiaye", phone="+221770001122")
        self.room_type = RoomType.objects.create(
            name="Deluxe",
            code="DLX",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=90000,
        )
        self.room = Room.objects.create(number="310", room_type=self.room_type)
        self.booking = Booking.objects.create(
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


class ClientPaymentApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cashier2",
            password="testpass123",
            role=User.Role.CASHIER,
        )
        self.client.force_login(self.user)

        self.guest = Guest.objects.create(first_name="Kadi", last_name="Sarr", phone="+221770004455")
        self.room_type = RoomType.objects.create(
            name="Premium",
            code="PRE",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=110000,
        )
        self.room = Room.objects.create(number="415", room_type=self.room_type)
        self.booking = Booking.objects.create(
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
        response = self.client.get("/api/billing/client-payments/")

        self.assertEqual(response.status_code, 403)

    def test_reception_cannot_create_client_payment_via_billing_api(self):
        self.client.force_login(
            User.objects.create_user(
                username="frontdesk-billing",
                password="testpass123",
                role=User.Role.RECEPTION,
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
