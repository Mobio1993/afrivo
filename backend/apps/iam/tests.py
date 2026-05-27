import json

from django.test import TestCase
from django.urls import reverse

from apps.iam.models import User
from apps.iam.services.permission_service import PermissionService
from apps.tenancy.models import Hotel, Organization


class IamSecurityRegressionTests(TestCase):
    """Phase 8 security tests for high-risk IAM boundaries."""

    def setUp(self):
        self.organization = Organization.objects.create(name="Security Org", slug="security-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Security Hotel",
            code="SEC",
            slug="security-hotel",
        )
        self.reception = User.objects.create_user(
            username="iam-reception",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.hotel_admin = User.objects.create_user(
            username="iam-hotel-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.platform_admin = User.objects.create_user(
            username="iam-platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )

    def test_receptionist_cannot_create_hotel_admin(self):
        self.client.force_login(self.reception)

        response = self.client.post(
            reverse("api-users"),
            data={
                "username": "blocked-hotel-admin",
                "password": "testpass123",
                "role": User.Role.ADMIN,
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="blocked-hotel-admin").exists())
        self.assertFalse(PermissionService.can_assign_role(self.reception, self.reception, User.IamRole.HOTEL_ADMIN, self.hotel))

    def test_hotel_admin_cannot_create_platform_admin(self):
        self.client.force_login(self.hotel_admin)

        response = self.client.post(
            reverse("api-platform-users"),
            data=json.dumps(
                {
                    "username": "blocked-platform-admin",
                    "password": "testpass123",
                    "admin_scope": "platform",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="blocked-platform-admin").exists())
        candidate = User(role=User.Role.ADMIN, is_platform_admin=True, platform_role=User.PlatformRole.PLATFORM_ADMIN)
        self.assertFalse(PermissionService.can_manage_user(self.hotel_admin, candidate))

    def test_platform_admin_cannot_modify_super_root(self):
        super_root = User.objects.create_superuser(username="iam-super-root", password="testpass123")
        self.client.force_login(self.platform_admin)

        response = self.client.patch(
            reverse("api-platform-user-detail", kwargs={"user_id": super_root.id}),
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )

        self.assertIn(response.status_code, {400, 403})
        super_root.refresh_from_db()
        self.assertTrue(super_root.is_active)
        self.assertFalse(PermissionService.can_manage_user(self.platform_admin, super_root))
