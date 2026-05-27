from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.urls import reverse
from django.utils import timezone

from apps.billing.models import ClientInvoice, ClientInvoiceItem
from apps.bookings.models import Booking
from apps.bookings.services import mark_overdue_confirmed_bookings_no_show
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.tenancy.models import Hotel, HotelSettings, Organization
from apps.tenancy.utils import (
    attach_request_hotel,
    filter_for_active_hotel,
    get_user_hotel,
    scope_queryset_to_tenant,
    validate_objects_belong_to_hotel,
)
from apps.tenancy.services import get_or_create_default_tenancy


User = get_user_model()


def response_results(response):
    payload = response.json()
    if isinstance(payload, dict):
        return payload.get("results", [])
    return payload


class HotelSettingsApiTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.admin = User.objects.create_user(
            username="settings-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.reception = User.objects.create_user(
            username="settings-reception",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.manager = User.objects.create_user(
            username="settings-manager",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_hotel_admin_can_read_settings_for_active_hotel(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse("settings-hotel"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["hotel"], self.hotel.id)
        self.assertEqual(payload["currency"], "XOF")
        self.assertTrue(HotelSettings.objects.filter(hotel=self.hotel).exists())

    def test_hotel_admin_can_patch_settings(self):
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={
                "hotel_name_display": "AFRIVO Grand Hotel",
                "currency": "EUR",
                "deposit_required": True,
                "deposit_percentage": "30.00",
                "payment_methods": ["cash", "card"],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        settings = HotelSettings.objects.get(hotel=self.hotel)
        self.assertEqual(settings.hotel_name_display, "AFRIVO Grand Hotel")
        self.assertEqual(settings.currency, "EUR")
        self.assertTrue(settings.deposit_required)

    def test_reception_cannot_patch_settings(self):
        self.client.force_login(self.reception)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"hotel_name_display": "Blocked"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)

    def test_invalid_deposit_percentage_is_rejected(self):
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"deposit_required": True, "deposit_percentage": "0"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("deposit_percentage", response.json())

    def test_invalid_timezone_is_rejected(self):
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"timezone": "Africa/Atlantis"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("timezone", response.json())

    def test_invalid_payment_method_is_rejected(self):
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"payment_methods": ["cash", "crypto"]},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("payment_methods", response.json())

    def test_invalid_logo_upload_is_rejected(self):
        self.client.force_login(self.admin)
        upload = SimpleUploadedFile("logo.py", b"print('nope')", content_type="text/x-python")

        response = self.client.generic(
            "PATCH",
            reverse("settings-hotel"),
            data=encode_multipart(BOUNDARY, {"logo": upload}),
            content_type=MULTIPART_CONTENT,
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("logo", response.json())

    def test_checkout_boolean_updates_policy(self):
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"require_payment_before_checkout": False},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        settings = HotelSettings.objects.get(hotel=self.hotel)
        self.assertFalse(settings.require_payment_before_checkout)
        self.assertEqual(settings.checkout_payment_policy, HotelSettings.CheckoutPaymentPolicy.NON_BLOCKING)

    def test_manager_can_patch_billing_but_not_security(self):
        self.client.force_login(self.manager)

        billing_response = self.client.patch(
            reverse("settings-hotel"),
            data={"tax_rate": "7.50"},
            content_type="application/json",
        )
        security_response = self.client.patch(
            reverse("settings-hotel"),
            data={"session_timeout_minutes": 30},
            content_type="application/json",
        )

        self.assertEqual(billing_response.status_code, 200)
        self.assertEqual(security_response.status_code, 403)

    def test_invoice_prefix_locked_after_invoice_exists(self):
        settings = HotelSettings.objects.get(hotel=self.hotel)
        guest = Guest.objects.create(hotel=self.hotel, first_name="Awa", last_name="Kone", phone="01010101")
        ClientInvoice.objects.create(hotel=self.hotel, client=guest)
        self.client.force_login(self.admin)

        response = self.client.patch(
            reverse("settings-hotel"),
            data={"invoice_prefix": "FAC"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("invoice_prefix", response.json())
        settings.refresh_from_db()
        self.assertEqual(settings.invoice_prefix, "INV")

    def test_invoice_uses_hotel_settings_prefix_currency_and_tax(self):
        settings = HotelSettings.objects.get(hotel=self.hotel)
        settings.invoice_prefix = "FAC"
        settings.invoice_start_number = 50
        settings.currency = HotelSettings.Currency.EUR
        settings.tax_rate = Decimal("10.00")
        settings.save()
        guest = Guest.objects.create(hotel=self.hotel, first_name="Jean", last_name="Ble", phone="02020202")

        invoice = ClientInvoice.objects.create(hotel=self.hotel, client=guest)
        ClientInvoiceItem.objects.create(
            invoice=invoice,
            label="Hebergement",
            quantity=Decimal("1.00"),
            unit_price=Decimal("100.00"),
        )
        invoice.refresh_from_db()

        self.assertEqual(invoice.reference, "FAC-000050")
        self.assertEqual(invoice.currency, "EUR")
        self.assertEqual(invoice.tax_amount, Decimal("10.00"))
        self.assertEqual(invoice.total_amount, Decimal("110.00"))

    def test_no_show_policy_disabled_skips_booking(self):
        settings = HotelSettings.objects.get(hotel=self.hotel)
        settings.no_show_policy = HotelSettings.NoShowPolicy.DISABLED
        settings.save()
        self._create_confirmed_booking("101")

        result = mark_overdue_confirmed_bookings_no_show(reference_date=timezone.localdate())

        self.assertEqual(result["processed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)

    def test_no_show_auto_after_grace_marks_overdue_booking(self):
        settings = HotelSettings.objects.get(hotel=self.hotel)
        settings.no_show_policy = HotelSettings.NoShowPolicy.AUTO_AFTER_GRACE
        settings.grace_period_minutes = 0
        settings.save()
        booking = self._create_confirmed_booking("102")

        result = mark_overdue_confirmed_bookings_no_show(reference_date=timezone.localdate())
        booking.refresh_from_db()

        self.assertEqual(result["processed_count"], 1)
        self.assertEqual(booking.status, Booking.Status.NO_SHOW)

    def _create_confirmed_booking(self, room_number):
        guest = Guest.objects.create(
            hotel=self.hotel,
            first_name=f"Client {room_number}",
            last_name="Test",
            phone=f"07{room_number}",
        )
        room_type = RoomType.objects.create(
            hotel=self.hotel,
            name=f"Standard {room_number}",
            code=f"STD{room_number}",
            capacity=2,
            max_adults=2,
            base_price_per_night=Decimal("25000.00"),
        )
        room = Room.objects.create(
            hotel=self.hotel,
            number=room_number,
            room_type=room_type,
            status=Room.Status.AVAILABLE,
        )
        return Booking.objects.create(
            hotel=self.hotel,
            guest=guest,
            room_type=room_type,
            room=room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() - timedelta(days=1),
            check_out_date=timezone.localdate() + timedelta(days=1),
            estimated_amount=Decimal("50000.00"),
        )


class TenantStrictIsolationTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Tenant A", slug="tenant-a")
        self.hotel = Hotel.objects.create(organization=self.organization, name="Hotel A", code="A", slug="hotel-a")
        self.other_org = Organization.objects.create(name="Tenant B", slug="tenant-b")
        self.other_hotel = Hotel.objects.create(organization=self.other_org, name="Hotel B", code="B", slug="hotel-b")
        RoomType.objects.create(hotel=self.hotel, name="Standard A", code="STD-A", base_price_per_night=Decimal("10000.00"))
        RoomType.objects.create(hotel=self.other_hotel, name="Standard B", code="STD-B", base_price_per_night=Decimal("12000.00"))

    def test_filter_for_active_hotel_is_fail_closed_without_hotel(self):
        queryset = filter_for_active_hotel(RoomType.objects.all(), hotel=None)

        self.assertEqual(queryset.count(), 0)

    def test_filter_for_active_hotel_returns_only_current_hotel_data(self):
        queryset = filter_for_active_hotel(RoomType.objects.all(), hotel=self.hotel)

        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.get().hotel_id, self.hotel.id)

    def test_inactive_organization_blocks_active_hotel_context(self):
        self.organization.is_active = False
        self.organization.save(update_fields=["is_active"])
        user = User.objects.create_user(
            username="inactive-org-user",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )

        self.assertIsNone(get_user_hotel(user))

    def test_user_hotel_organization_mismatch_has_no_active_hotel(self):
        user = User.objects.create_user(
            username="mismatch-tenant-user",
            password="testpass123",
            role=User.Role.ADMIN,
            hotel=self.other_hotel,
        )
        User.objects.filter(pk=user.pk).update(organization=self.organization)
        user.refresh_from_db()

        self.assertIsNone(get_user_hotel(user))

        request = type("Request", (), {"user": user})()
        attach_request_hotel(request)

        self.assertFalse(request.tenant_is_valid)
        self.assertIsNone(request.active_hotel)

    def test_scope_queryset_to_tenant_is_fail_closed_for_invalid_tenant(self):
        user = User.objects.create_user(
            username="invalid-scope-user",
            password="testpass123",
            role=User.Role.ADMIN,
            hotel=self.other_hotel,
        )
        User.objects.filter(pk=user.pk).update(organization=self.organization)
        user.refresh_from_db()
        request = type("Request", (), {"user": user})()

        queryset = scope_queryset_to_tenant(RoomType.objects.all(), request)

        self.assertEqual(queryset.count(), 0)

    def test_scope_queryset_to_tenant_returns_only_current_hotel_data(self):
        user = User.objects.create_user(
            username="valid-scope-user",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        request = type("Request", (), {"user": user})()

        queryset = scope_queryset_to_tenant(RoomType.objects.all(), request)

        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.get().hotel_id, self.hotel.id)

    def test_validate_objects_belong_to_hotel_rejects_cross_hotel_fk(self):
        other_room_type = RoomType.objects.get(hotel=self.other_hotel)

        with self.assertRaises(ValidationError):
            validate_objects_belong_to_hotel(self.hotel, room_type=other_room_type)

    def test_new_hotel_interface_starts_without_other_hotel_data(self):
        source_room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Suite source",
            code="SRC",
            base_price_per_night=Decimal("50000.00"),
        )
        Room.objects.create(hotel=self.hotel, number="501", room_type=source_room_type)
        Guest.objects.create(hotel=self.hotel, first_name="Client", last_name="Source")

        new_org = Organization.objects.create(name="New Tenant", slug="new-tenant")
        new_hotel = Hotel.objects.create(
            organization=new_org,
            name="New Hotel",
            code="NEW",
            slug="new-hotel",
        )
        new_admin = User.objects.create_user(
            username="new-hotel-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=new_org,
            hotel=new_hotel,
        )

        self.client.force_login(new_admin)

        dashboard_response = self.client.get("/api/dashboard/summary/")
        rooms_response = self.client.get("/api/rooms/?is_active=true&page_size=200")
        clients_response = self.client.get("/api/clients/")

        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(rooms_response.status_code, 200)
        self.assertEqual(clients_response.status_code, 200)

        dashboard_payload = dashboard_response.json()
        self.assertEqual(dashboard_payload["spotlight_cards"][0]["value"], 0)
        self.assertEqual(dashboard_payload["spotlight_cards"][1]["value"], 0)
        self.assertEqual(response_results(rooms_response), [])
        self.assertEqual(response_results(clients_response), [])
