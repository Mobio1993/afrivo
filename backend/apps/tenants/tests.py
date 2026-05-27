from django.test import TestCase

from apps.iam.models import User
from apps.tenancy.models import Hotel, Organization
from apps.tenants.services.tenant_service import TenantService


class TenantSecurityRegressionTests(TestCase):
    """Phase 8 security tests for tenant isolation."""

    def setUp(self):
        self.organization_a = Organization.objects.create(name="Tenant Security A", slug="tenant-security-a")
        self.hotel_a = Hotel.objects.create(
            organization=self.organization_a,
            name="Tenant Hotel A",
            code="THA",
            slug="tenant-hotel-a",
        )
        self.organization_b = Organization.objects.create(name="Tenant Security B", slug="tenant-security-b")
        self.hotel_b = Hotel.objects.create(
            organization=self.organization_b,
            name="Tenant Hotel B",
            code="THB",
            slug="tenant-hotel-b",
        )

    def test_hotel_a_user_cannot_access_hotel_b(self):
        user = User.objects.create_user(
            username="tenant-hotel-a-user",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization_a,
            hotel=self.hotel_a,
        )

        self.assertTrue(TenantService.user_can_access_hotel(user, self.hotel_a))
        self.assertFalse(TenantService.user_can_access_hotel(user, self.hotel_b))

        accessible_ids = set(TenantService.get_accessible_hotels(user).values_list("id", flat=True))
        self.assertIn(self.hotel_a.id, accessible_ids)
        self.assertNotIn(self.hotel_b.id, accessible_ids)
