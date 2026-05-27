from django.test import TestCase

from apps.licensing.services.license_service import LicenseService
from apps.platform_admin.models import PlatformLicense, PlatformModule
from apps.tenancy.models import Hotel, Organization


class LicensingSecurityRegressionTests(TestCase):
    """Phase 8 security tests for module licensing gates."""

    def setUp(self):
        self.organization = Organization.objects.create(name="Licensing Security Org", slug="licensing-security-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Licensing Security Hotel",
            code="LIC",
            slug="licensing-security-hotel",
        )
        self.module = PlatformModule.objects.create(code="secure-module", name="Secure Module")

    def test_inactive_license_blocks_module_access(self):
        PlatformLicense.objects.create(
            module=self.module,
            organization=self.organization,
            status=PlatformLicense.Status.SUSPENDED,
        )

        self.assertFalse(
            LicenseService.module_allowed(module_code=self.module.code, organization_id=self.organization.id)
        )
        self.assertFalse(
            LicenseService.module_allowed(module_code=self.module.code, hotel_id=self.hotel.id)
        )

    def test_active_organization_license_allows_hotel_module_access(self):
        PlatformLicense.objects.create(
            module=self.module,
            organization=self.organization,
            status=PlatformLicense.Status.ACTIVE,
        )

        self.assertTrue(
            LicenseService.module_allowed(module_code=self.module.code, organization_id=self.organization.id)
        )
        self.assertTrue(
            LicenseService.module_allowed(module_code=self.module.code, hotel_id=self.hotel.id)
        )
