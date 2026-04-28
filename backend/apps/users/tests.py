from io import StringIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from apps.tenancy.models import Hotel, Organization
from apps.tenancy.services import assign_default_hotel_to_users, get_or_create_default_tenancy
from apps.users.access import build_user_permission_map, user_can_access
from apps.users.jwt_auth import generate_jwt
from apps.users.models import BlacklistedToken, UserModulePermission
from apps.platform_admin.permissions import IsPlatformAdmin


User = get_user_model()


class UserTenancyAssignmentTests(TestCase):
    def test_assign_default_hotel_to_users_only_updates_unassigned_users(self):
        organization, hotel = get_or_create_default_tenancy()
        user_without_hotel = User.objects.create_user(
            username="missing-hotel",
            password="testpass123",
            role=User.Role.RECEPTION,
        )
        user_with_hotel = User.objects.create_user(
            username="already-assigned",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=organization,
            hotel=hotel,
        )

        result = assign_default_hotel_to_users(User.objects.filter(id__in=[user_without_hotel.id, user_with_hotel.id]))

        user_without_hotel.refresh_from_db()
        user_with_hotel.refresh_from_db()

        self.assertEqual(result["assigned"], 1)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual(user_without_hotel.hotel_id, hotel.id)
        self.assertEqual(user_without_hotel.organization_id, organization.id)
        self.assertEqual(user_with_hotel.hotel_id, hotel.id)


class UserApiTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.admin = User.objects.create_user(
            username="admin-user",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.reception = User.objects.create_user(
            username="reception-user",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.client.force_login(self.admin)

    def test_admin_can_create_user_via_api(self):
        response = self.client.post(
            reverse("api-users"),
            data={
                "username": "cashier-user",
                "password": "testpass123",
                "first_name": "Awa",
                "last_name": "Diop",
                "role": User.Role.CASHIER,
                "phone": "+221770000500",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["username"], "cashier-user")
        self.assertEqual(payload["role"], User.Role.CASHIER)
        self.assertNotIn("password", payload)

        created_user = User.objects.get(username="cashier-user")
        self.assertTrue(created_user.check_password("testpass123"))
        self.assertEqual(created_user.hotel_id, self.hotel.id)
        self.assertEqual(created_user.organization_id, self.organization.id)

    def test_non_admin_can_only_list_own_profile(self):
        self.client.force_login(self.reception)

        response = self.client.get(reverse("api-users"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], self.reception.id)

    def test_non_admin_cannot_create_user(self):
        self.client.force_login(self.reception)

        response = self.client.post(
            reverse("api-users"),
            data={"username": "blocked-user", "password": "testpass123", "role": User.Role.RECEPTION},
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_delete_is_soft_delete(self):
        target = User.objects.create_user(
            username="restaurant-user",
            password="testpass123",
            role=User.Role.RESTAURANT,
            organization=self.organization,
            hotel=self.hotel,
        )

        response = self.client.delete(reverse("api-user-detail", kwargs={"pk": target.id}))

        self.assertEqual(response.status_code, 204)
        target.refresh_from_db()
        self.assertFalse(target.is_active)

    def test_platform_admin_can_view_all_users(self):
        platform_admin = User.objects.create_user(
            username="platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )
        self.client.force_login(platform_admin)

        response = self.client.get(reverse("api-users"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(len(payload), 2)


class UserPermissionModelTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.manager = User.objects.create_user(
            username="manager-user",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_default_permissions_are_generated_from_role(self):
        permissions = build_user_permission_map(self.manager)

        self.assertTrue(permissions["rooms"]["manage"])
        self.assertFalse(permissions["users"]["manage"])

    def test_module_override_can_reduce_permissions(self):
        UserModulePermission.objects.create(
            user=self.manager,
            module_code=UserModulePermission.ModuleCode.ROOMS,
            can_view=True,
            can_create=False,
            can_update=False,
            can_delete=False,
            can_manage=False,
        )

        self.assertFalse(user_can_access(self.manager, "rooms", "manage"))
        self.assertFalse(user_can_access(self.manager, "rooms", "update"))
        self.assertTrue(user_can_access(self.manager, "rooms", "view"))

    def test_platform_modules_are_denied_to_hotel_admin_by_default(self):
        hotel_admin = User.objects.create_user(
            username="hotel-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )

        permissions = build_user_permission_map(hotel_admin)

        self.assertFalse(permissions["platform_hotels"]["view"])
        self.assertFalse(user_can_access(hotel_admin, "platform_hotels", "manage"))

    def test_platform_admin_gets_full_access_to_platform_modules(self):
        platform_admin = User.objects.create_user(
            username="platform-root",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )

        permissions = build_user_permission_map(platform_admin)

        self.assertTrue(permissions["platform_hotels"]["manage"])
        self.assertTrue(user_can_access(platform_admin, "platform_security", "view"))


class PlatformAdminPermissionTests(TestCase):
    def test_is_platform_admin_permission_accepts_only_platform_admins(self):
        organization, hotel = get_or_create_default_tenancy()
        hotel_admin = User.objects.create_user(
            username="hotel-admin-perm",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=organization,
            hotel=hotel,
        )
        platform_admin = User.objects.create_user(
            username="platform-admin-perm",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )

        permission = IsPlatformAdmin()

        hotel_request = type("Request", (), {"user": hotel_admin})()
        platform_request = type("Request", (), {"user": platform_admin})()

        self.assertFalse(permission.has_permission(hotel_request, view=None))
        self.assertTrue(permission.has_permission(platform_request, view=None))


class AuthSessionIsolationTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.admin = User.objects.create_user(
            username="admin-user",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.postgres_user = User.objects.create_user(
            username="postgres",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_session_api_prefers_active_jwt_over_existing_django_session(self):
        self.client.force_login(self.postgres_user)
        self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = generate_jwt(self.admin, "access")

        response = self.client.get(reverse("api-session"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["user"]["username"], self.admin.username)
        self.assertEqual(payload["user"]["role_code"], User.Role.ADMIN)

    def test_session_api_rejects_invalid_jwt_even_if_django_session_exists(self):
        self.client.force_login(self.postgres_user)
        self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = "invalid-token"

        response = self.client.get(reverse("api-session"))

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertFalse(payload["authenticated"])


class AuthThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.user = User.objects.create_user(
            username="throttle-user",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_login_is_throttled_after_repeated_failures(self):
        for _ in range(settings.AUTH_LOGIN_THROTTLE_ATTEMPTS):
            response = self.client.post(
                reverse("api-login"),
                data='{"username":"throttle-user","password":"bad-pass"}',
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)

        throttled = self.client.post(
            reverse("api-login"),
            data='{"username":"throttle-user","password":"bad-pass"}',
            content_type="application/json",
        )

        self.assertEqual(throttled.status_code, 429)
        self.assertEqual(throttled.json()["code"], "login_throttled")


class AuthTokenBlacklistTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.user = User.objects.create_user(
            username="blacklist-user",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_logout_blacklists_refresh_token(self):
        refresh_token = generate_jwt(self.user, "refresh")
        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_token
        self.client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = generate_jwt(self.user, "access")

        response = self.client.post(reverse("api-logout"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(BlacklistedToken.objects.filter(token=refresh_token).exists())

    def test_refresh_rejects_blacklisted_token(self):
        refresh_token = generate_jwt(self.user, "refresh")
        BlacklistedToken.objects.create(token=refresh_token)
        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_token

        response = self.client.post(reverse("api-refresh"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "refresh_revoked")


class CreateHotelAdminCommandTests(TestCase):
    def setUp(self):
        cache.clear()
        self.organization = Organization.objects.create(name="AFRIVO Group", slug="afrivo-group")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="AFRIVO Dakar",
            code="DKR-01",
            slug="afrivo-dakar",
        )

    def test_command_creates_hotel_admin_with_explicit_tenancy(self):
        out = StringIO()

        call_command(
            "create_hotel_admin",
            username="hotel-admin",
            password="testpass123",
            first_name="Awa",
            last_name="Diop",
            email="awa@afrivo.test",
            phone="+221770001111",
            organization_id=self.organization.id,
            hotel_id=self.hotel.id,
            stdout=out,
        )

        user = User.objects.get(username="hotel-admin")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertEqual(user.organization_id, self.organization.id)
        self.assertEqual(user.hotel_id, self.hotel.id)
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertIn("Admin AFRIVO cree avec succes", out.getvalue())

    def test_command_rejects_mismatched_hotel_and_organization(self):
        other_org = Organization.objects.create(name="Autre Group", slug="autre-group")

        with self.assertRaisesMessage(Exception, "L'hotel selectionne doit appartenir a l'organisation fournie."):
            call_command(
                "create_hotel_admin",
                username="bad-admin",
                password="testpass123",
                organization_id=other_org.id,
                hotel_id=self.hotel.id,
            )

    def test_created_admin_can_login_via_api(self):
        call_command(
            "create_hotel_admin",
            username="login-admin",
            password="testpass123",
            organization_id=self.organization.id,
            hotel_id=self.hotel.id,
        )

        response = self.client.post(
            reverse("api-login"),
            data='{"username":"login-admin","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["authenticated"])
        self.assertEqual(payload["user"]["role_code"], User.Role.ADMIN)
        self.assertEqual(payload["user"]["organization_id"], self.organization.id)
        self.assertEqual(payload["user"]["hotel_id"], self.hotel.id)

    def test_command_can_use_default_tenancy_when_explicitly_requested(self):
        call_command(
            "create_hotel_admin",
            username="default-admin",
            password="testpass123",
            use_default_tenancy=True,
        )

        user = User.objects.get(username="default-admin")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertIsNotNone(user.organization_id)
        self.assertIsNotNone(user.hotel_id)
