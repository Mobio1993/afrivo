import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.bookings.models import Booking
from apps.consumptions.models import ClientConsumption, ServiceDepartment
from apps.guests.models import Guest
from apps.guests.serializers import ClientDetailSerializer, ClientSerializer
from apps.rooms.models import Room, RoomType
from apps.satisfaction.models import ClientSatisfaction
from apps.stays.models import Stay


User = get_user_model()


class GuestSerializerTests(TestCase):
    def test_build_client_code_uses_expected_format(self):
        self.assertEqual(Guest.build_client_code(12, 2026), "AFR-CL-2026-000012")

    def test_guest_generates_client_code_on_create(self):
        guest = Guest.objects.create(
            first_name="Awa",
            last_name="Ba",
            phone="+221770001122",
        )

        guest.refresh_from_db()

        self.assertTrue(guest.client_code)
        self.assertEqual(guest.client_code, f"AFR-CL-{guest.created_at.year}-{guest.id:06d}")

    def test_validate_rejects_invalid_document_dates(self):
        result = ClientSerializer.validate(
            {
                "first_name": "Amina",
                "last_name": "Diallo",
                "phone": "+221771234567",
                "document_type": "passport",
                "document_number": "P1234567",
                "document_issue_date": "2026-04-20",
                "document_expiry_date": "2026-04-19",
            }
        )

        self.assertIn("errors", result)
        self.assertIn("document_expiry_date", result["errors"])

    def test_validate_returns_duplicate_warnings_without_blocking(self):
        Guest.objects.create(
            first_name="Amina",
            last_name="Diallo",
            phone="+221771234567",
            date_of_birth=timezone.localdate() - timedelta(days=365 * 30),
            email="amina.old@example.com",
        )

        result = ClientSerializer.validate(
            {
                "first_name": "Amina",
                "last_name": "Diallo",
                "secondary_phone": "+221770000000",
                "email": "amina.new@example.com",
                "date_of_birth": (timezone.localdate() - timedelta(days=365 * 30)).isoformat(),
            }
        )

        self.assertIn("data", result)
        self.assertIn("warnings", result)
        self.assertEqual(len(result["warnings"]), 1)
        self.assertEqual(result["warnings"][0]["full_name"], "Amina Diallo")

    def test_detail_serializer_preserves_legacy_fields_and_exposes_new_fields(self):
        guest = Guest.objects.create(
            first_name="Fatou",
            middle_name="Aminata",
            last_name="Ndiaye",
            client_type=Guest.ClientType.VIP,
            gender=Guest.Gender.FEMALE,
            phone="+221780000001",
            nationality="Senegalaise",
            country="Senegal",
            identity_document_type=Guest.IdentityDocumentType.PASSPORT,
            identity_document_number="AA998877",
            place_of_birth="Dakar",
            profession="Consultante",
        )

        payload = ClientDetailSerializer.serialize(guest)

        self.assertEqual(payload["nationality"], "Senegalaise")
        self.assertEqual(payload["country"], "Senegal")
        self.assertEqual(payload["document_type"], Guest.IdentityDocumentType.PASSPORT)
        self.assertEqual(payload["document_number"], "AA998877")
        self.assertEqual(payload["client_type"], Guest.ClientType.VIP)
        self.assertEqual(payload["client_status"], "vip")
        self.assertEqual(payload["place_of_birth"], "Dakar")
        self.assertEqual(payload["client_code"], guest.client_code)

    def test_detail_serializer_exposes_stay_portfolio_and_stay_financials(self):
        guest = Guest.objects.create(
            first_name="Fatou",
            last_name="Diallo",
            phone="+221780000009",
        )
        room_type = RoomType.objects.create(
            name="Suite",
            code="STE",
            capacity=3,
            max_adults=2,
            max_children=1,
            base_price_per_night=100000,
        )
        room = Room.objects.create(number="301", room_type=room_type)
        booking = Booking.objects.create(
            guest=guest,
            room_type=room_type,
            room=room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=2),
        )
        stay = Stay.create_from_booking(booking)
        department = ServiceDepartment.objects.create(
            code="bar",
            name="Bar",
            department_type=ServiceDepartment.DepartmentType.BAR,
        )
        Payment.objects.create(
            stay=stay,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            amount=50000,
            paid_at=timezone.now(),
        )
        ClientConsumption.objects.create(
            client=guest,
            stay=stay,
            service_department=department,
            label="Cocktail",
            quantity=1,
            unit_price=12500,
        )
        invoice = ClientInvoice.objects.create(
            client=guest,
            stay=stay,
            notes="Facture folio",
        )
        invoice.items.create(
            label="Hebergement",
            quantity=1,
            unit_price=85000,
        )
        ClientSatisfaction.objects.create(
            client=guest,
            stay=stay,
            overall_rating=4,
            recommendation_score=8,
            would_recommend=True,
            positive_points="Accueil professionnel",
        )

        payload = ClientDetailSerializer.serialize(guest)

        self.assertIn("stay_portfolio", payload)
        self.assertIn("payment_portfolio", payload)
        self.assertIn("consumption_portfolio", payload)
        self.assertIn("invoice_portfolio", payload)
        self.assertIn("satisfaction_portfolio", payload)
        self.assertIn("timeline_portfolio", payload)
        self.assertEqual(payload["stay_portfolio"]["active_count"], 1)
        self.assertEqual(payload["payment_portfolio"]["confirmed_count"], 1)
        self.assertEqual(payload["stay_history"][0]["payment_count"], 1)
        self.assertEqual(payload["stay_history"][0]["payment_total"], "50000.00")
        self.assertEqual(payload["stay_history"][0]["consumption_count"], 1)
        self.assertEqual(payload["stay_history"][0]["invoice_count"], 1)
        self.assertEqual(payload["stay_history"][0]["booking_reference"], booking.reference)
        self.assertEqual(payload["payment_history"][0]["payment_type_code"], Payment.PaymentType.PARTIAL)
        self.assertTrue(payload["timeline_history"])
        self.assertEqual(payload["consumption_history"][0]["service"], "Bar")
        self.assertEqual(payload["invoice_history"][0]["reference"], invoice.reference)
        self.assertEqual(payload["satisfaction_history"][0]["overall_rating"], 4)


class GuestApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reception",
            password="testpass123",
            role=User.Role.RECEPTION,
        )
        self.client.force_login(self.user)

    def test_create_client_endpoint_keeps_contract_and_returns_warnings(self):
        Guest.objects.create(
            first_name="Jean",
            last_name="Kouame",
            phone="+2250102030405",
            date_of_birth=timezone.localdate() - timedelta(days=365 * 28),
        )

        response = self.client.post(
            reverse("api-clients"),
            data=json.dumps(
                {
                    "first_name": "Jean",
                    "last_name": "Kouame",
                    "secondary_phone": "+225999999999",
                    "date_of_birth": (timezone.localdate() - timedelta(days=365 * 28)).isoformat(),
                    "nationality": "Ivoirienne",
                    "client_type": "individual",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertIn("message", payload)
        self.assertIn("client", payload)
        self.assertIn("warnings", payload)
        self.assertTrue(payload["client"]["client_code"])
        self.assertEqual(payload["client"]["nationality"], "Ivoirienne")
        self.assertEqual(payload["client"]["client_type"], "individual")
        self.assertTrue(payload["warnings"])

    def test_update_client_endpoint_accepts_new_fields_without_breaking_existing_payload(self):
        guest = Guest.objects.create(
            first_name="Moussa",
            last_name="Traore",
            phone="+22370000000",
            email="moussa@example.com",
            identity_document_type=Guest.IdentityDocumentType.NATIONAL_ID,
            identity_document_number="CNI-7788",
        )

        response = self.client.put(
            reverse("api-client-detail", kwargs={"client_id": guest.id}),
            data=json.dumps(
                {
                    "first_name": "Moussa",
                    "last_name": "Traore",
                    "phone": "+22370000000",
                    "email": "moussa@example.com",
                    "identity_document_type": "national_id",
                    "identity_document_number": "CNI-7788",
                    "middle_name": "Ibrahim",
                    "client_type": "corporate",
                    "place_of_birth": "Bamako",
                    "emergency_contact_name": "Awa Traore",
                    "emergency_contact_phone": "+22371111111",
                    "notes": "Client entreprise",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["client"]
        self.assertEqual(payload["client_code"], guest.client_code)
        self.assertEqual(payload["middle_name"], "Ibrahim")
        self.assertEqual(payload["client_type"], "corporate")
        self.assertEqual(payload["place_of_birth"], "Bamako")
        self.assertEqual(payload["emergency_contact_name"], "Awa Traore")
        self.assertEqual(payload["identity_document_number"], "CNI-7788")

    def test_clients_api_search_matches_client_code_partially(self):
        matching_guest = Guest.objects.create(
            first_name="Kadi",
            last_name="Sow",
            phone="+221770000123",
        )
        Guest.objects.create(
            first_name="Mariam",
            last_name="Fall",
            phone="+221770000124",
        )

        response = self.client.get(
            reverse("api-clients"),
            {"search": matching_guest.client_code[-6:]},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], matching_guest.id)
        self.assertEqual(payload["results"][0]["client_code"], matching_guest.client_code)

    def test_client_history_endpoint_returns_filtered_timeline(self):
        guest = Guest.objects.create(first_name="Sira", last_name="Keita", phone="+22371000000")
        room_type = RoomType.objects.create(
            name="Classic",
            code="CLS",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=50000,
        )
        room = Room.objects.create(number="105", room_type=room_type)
        booking = Booking.objects.create(
            guest=guest,
            room_type=room_type,
            room=room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=1),
        )
        stay = Stay.create_from_booking(booking, actor=self.user)
        Payment.objects.create(
            client=guest,
            stay=stay,
            booking=booking,
            payment_type=Payment.PaymentType.PARTIAL,
            status=Payment.Status.PAID,
            method=Payment.Method.CASH,
            amount=25000,
            paid_at=timezone.now(),
            recorded_by=self.user,
        )
        ClientSatisfaction.objects.create(
            client=guest,
            stay=stay,
            overall_rating=2,
            recommendation_score=3,
            would_recommend=False,
            negative_points="Accueil lent",
        )

        response = self.client.get(
            reverse("api-client-history", kwargs={"client_id": guest.id}),
            {"event_type": "satisfaction_recorded"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["client_id"], guest.id)
        self.assertTrue(payload["results"])
        self.assertEqual(payload["results"][0]["event_type"], "satisfaction_recorded")

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": False,
            "consumptions": False,
            "satisfaction": False,
            "guests": True,
            "operations": False,
            "history": False,
        }
    )
    def test_guests_api_can_be_switched_to_strict_mode(self):
        response = self.client.get(reverse("api-clients"))

        self.assertEqual(response.status_code, 403)


class GuestPermissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="housekeeper",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
        )
        self.client.force_login(self.user)

    def test_housekeeping_cannot_access_clients_module(self):
        response = self.client.get(reverse("api-clients"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["module"], "clients")
        self.assertEqual(response.json()["action"], "view")
