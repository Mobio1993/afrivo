from io import StringIO
import hashlib

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.tenancy.models import Hotel, Organization
from apps.tenancy.services import assign_default_hotel_to_users, get_or_create_default_tenancy
from apps.history.models import ActivityLog
from apps.iam.services.permission_service import PermissionService
from apps.users.jwt_auth import generate_jwt
from apps.users.models import (
    BlacklistedToken,
    IAMPermission,
    IAMRole,
    IAMRolePermission,
    UserModulePermission,
    UserOrganizationRole,
    UserSession,
)
from apps.platform_admin.permissions import IsPlatformAdmin


User = get_user_model()
build_user_permission_map = PermissionService.build_permission_map
can_assign_role = PermissionService.can_assign_role
can_manage_user = PermissionService.can_manage_user
can_perform_action = PermissionService.can_perform_action
get_user_role_level = PermissionService.get_user_role_level
user_can_access = PermissionService.user_can_access


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
        log = ActivityLog.objects.filter(
            module="users",
            action=ActivityLog.Action.CREATE,
            object_id=str(created_user.id),
            metadata__security_event="user_created",
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user_id, self.admin.id)

    def test_admin_user_sensitive_actions_are_audited(self):
        target = User.objects.create_user(
            username="audited-cashier",
            password="testpass123",
            role=User.Role.CASHIER,
            organization=self.organization,
            hotel=self.hotel,
        )

        role_response = self.client.patch(
            reverse("api-user-detail", kwargs={"pk": target.id}),
            data='{"role":"reception"}',
            content_type="application/json",
        )
        password_response = self.client.post(
            reverse("api-user-set-password", kwargs={"pk": target.id}),
            data={"password": "newpass12345"},
        )
        deactivate_response = self.client.delete(reverse("api-user-detail", kwargs={"pk": target.id}))

        self.assertEqual(role_response.status_code, 200)
        self.assertEqual(password_response.status_code, 200)
        self.assertEqual(deactivate_response.status_code, 204)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="users",
                action=ActivityLog.Action.PERMISSION_CHANGE,
                object_id=str(target.id),
                metadata__security_event="user_role_changed",
            ).exists()
        )
        self.assertTrue(
            ActivityLog.objects.filter(
                module="users",
                action=ActivityLog.Action.PASSWORD_CHANGE,
                object_id=str(target.id),
                metadata__security_event="admin_password_reset",
            ).exists()
        )
        self.assertTrue(
            ActivityLog.objects.filter(
                module="users",
                action=ActivityLog.Action.DELETE,
                object_id=str(target.id),
                metadata__security_event="user_deactivated",
            ).exists()
        )

    def test_admin_cannot_create_equal_hotel_admin_via_api(self):
        response = self.client.post(
            reverse("api-users"),
            data={
                "username": "blocked-admin",
                "password": "testpass123",
                "role": User.Role.ADMIN,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="blocked-admin").exists())

    def test_non_admin_cannot_list_users(self):
        self.client.force_login(self.reception)

        response = self.client.get(reverse("api-users"))

        self.assertEqual(response.status_code, 403)

    def test_users_permission_override_does_not_allow_non_admin_api_access(self):
        UserModulePermission.objects.create(
            user=self.reception,
            module_code=UserModulePermission.ModuleCode.USERS,
            can_view=True,
            can_manage=True,
        )
        self.client.force_login(self.reception)
        response = self.client.get(reverse("api-users"))

        self.assertEqual(response.status_code, 403)

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
        self.assertTrue(permissions["operations"]["manage"])
        self.assertFalse(permissions["history"]["view"])
        self.assertFalse(permissions["users"]["view"])
        self.assertFalse(permissions["users"]["manage"])

    def test_canonical_iam_defaults_replace_legacy_by_covered_module(self):
        staff = User.objects.create_user(
            username="staff-transition",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
            organization=self.organization,
            hotel=self.hotel,
        )

        permissions = build_user_permission_map(staff)

        self.assertTrue(permissions["rooms"]["update"])
        self.assertTrue(permissions["operations"]["view"])
        self.assertFalse(permissions["operations"]["create"])
        self.assertFalse(permissions["operations"]["update"])

    def test_history_permission_override_is_ignored_for_non_admin_roles(self):
        UserModulePermission.objects.create(
            user=self.manager,
            module_code=UserModulePermission.ModuleCode.HISTORY,
            can_view=True,
            can_manage=True,
        )

        permissions = build_user_permission_map(self.manager)

        self.assertFalse(permissions["history"]["view"])
        self.assertFalse(user_can_access(self.manager, "history", "manage"))

    def test_users_permission_override_is_ignored_for_non_admin_roles(self):
        UserModulePermission.objects.create(
            user=self.manager,
            module_code=UserModulePermission.ModuleCode.USERS,
            can_view=True,
            can_manage=True,
        )

        permissions = build_user_permission_map(self.manager)

        self.assertFalse(permissions["users"]["view"])
        self.assertFalse(user_can_access(self.manager, "users", "manage"))

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

    def test_super_admin_platform_gets_full_access_to_platform_modules(self):
        platform_admin = User.objects.create_user(
            username="platform-root",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.SUPER_ADMIN,
        )

        permissions = build_user_permission_map(platform_admin)

        self.assertTrue(permissions["platform_hotels"]["manage"])
        self.assertTrue(user_can_access(platform_admin, "platform_security", "view"))

    def test_platform_admin_gets_limited_access_to_platform_modules(self):
        platform_admin = User.objects.create_user(
            username="platform-limited",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )

        permissions = build_user_permission_map(platform_admin)

        self.assertTrue(permissions["platform_hotels"]["update"])
        self.assertFalse(permissions["platform_hotels"]["delete"])
        self.assertFalse(user_can_access(platform_admin, "platform_security", "manage"))

    def test_role_hierarchy_blocks_equal_or_higher_user_management(self):
        hotel_admin = User.objects.create_user(
            username="hotel-admin-target",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        manager = User.objects.create_user(
            username="manager-target",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )

        self.assertTrue(can_manage_user(hotel_admin, manager))
        self.assertFalse(can_manage_user(hotel_admin, hotel_admin))
        self.assertFalse(can_manage_user(manager, hotel_admin))

    def test_role_assignment_hierarchy_blocks_equal_or_higher_roles(self):
        hotel_admin = User.objects.create_user(
            username="hotel-admin-assign",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        reception = User.objects.create_user(
            username="reception-assign",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

        self.assertTrue(can_assign_role(hotel_admin, reception, User.IamRole.RECEPTIONIST, self.hotel))
        self.assertFalse(can_assign_role(hotel_admin, reception, User.IamRole.HOTEL_ADMIN, self.hotel))
        self.assertFalse(can_assign_role(reception, hotel_admin, User.IamRole.RECEPTIONIST, self.hotel))

    def test_canonical_phase_two_iam_roles_exist(self):
        role_codes = set(IAMRole.objects.values_list("code", flat=True))

        self.assertIn(User.IamRole.HOTEL_MANAGER, role_codes)
        self.assertIn(User.IamRole.STAFF, role_codes)
        self.assertTrue(
            IAMRolePermission.objects.filter(
                role__code=User.IamRole.HOTEL_MANAGER,
                permission__code="operations.manage",
            ).exists()
        )

    def test_legacy_roles_map_to_canonical_iam_levels(self):
        manager = User.objects.create_user(
            username="canonical-manager",
            password="testpass123",
            role=User.Role.MANAGER,
            organization=self.organization,
            hotel=self.hotel,
        )
        staff = User.objects.create_user(
            username="canonical-staff",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
            organization=self.organization,
            hotel=self.hotel,
        )

        self.assertEqual(get_user_role_level(manager), 400)
        self.assertEqual(get_user_role_level(staff), 100)

    def test_iam_role_permissions_are_merged_into_effective_permissions(self):
        role, _ = IAMRole.objects.get_or_create(
            code=User.IamRole.ORGANIZATION_ADMIN,
            defaults={"name": "Admin organisation", "is_system": True},
        )
        permission, _ = IAMPermission.objects.get_or_create(
            code="users.create",
            defaults={
                "module_code": "users",
                "action": "create",
                "description": "Creer des utilisateurs",
            },
        )
        IAMRolePermission.objects.get_or_create(role=role, permission=permission)
        UserOrganizationRole.objects.create(
            user=self.manager,
            organization=self.organization,
            role_code=User.IamRole.ORGANIZATION_ADMIN,
        )

        permissions = build_user_permission_map(self.manager)

        self.assertTrue(permissions["users"]["view"])
        self.assertTrue(permissions["users"]["create"])
        self.assertTrue(user_can_access(self.manager, "users", "create"))

    def test_business_action_permissions_are_role_specific(self):
        reception = User.objects.create_user(
            username="business-reception",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        accountant = User.objects.create_user(
            username="business-accountant",
            password="testpass123",
            role=User.Role.CASHIER,
            organization=self.organization,
            hotel=self.hotel,
        )
        staff = User.objects.create_user(
            username="business-staff",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
            organization=self.organization,
            hotel=self.hotel,
        )

        self.assertTrue(can_perform_action(reception, "operations.check_in"))
        self.assertTrue(can_perform_action(reception, "dayuse.check_out"))
        self.assertTrue(can_perform_action(reception, "payments.record"))
        self.assertFalse(can_perform_action(reception, "operations.cancel"))
        self.assertFalse(can_perform_action(reception, "payments.refund"))

        self.assertTrue(can_perform_action(accountant, "payments.refund"))
        self.assertTrue(can_perform_action(accountant, "payments.cancel"))
        self.assertFalse(can_perform_action(accountant, "operations.check_in"))

        self.assertFalse(can_perform_action(staff, "operations.check_in"))


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
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, settings.AUTH_LOGIN_THROTTLE_ATTEMPTS)
        self.assertIsNotNone(self.user.locked_until)


class AuthLoginContractTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.user = User.objects.create_user(
            username="email-login-user",
            email="email-login@afrivo.test",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )

    def test_user_can_login_with_email_identifier(self):
        response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login@afrivo.test","password":"testpass123"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["authenticated"])
        self.assertEqual(payload["user"]["username"], self.user.username)

    def test_remember_me_true_creates_persistent_refresh_cookie(self):
        response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        refresh_cookie = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        self.assertEqual(int(refresh_cookie["max-age"]), settings.JWT_REFRESH_LIFETIME_SECONDS)

    def test_remember_me_false_creates_session_refresh_cookie(self):
        response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123","remember_me":false}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        refresh_cookie = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        self.assertEqual(refresh_cookie["max-age"], "")

    def test_login_updates_last_login(self):
        self.assertIsNone(self.user.last_login)

        response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_login_creates_tracked_user_session(self):
        response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
            HTTP_USER_AGENT="Mozilla/5.0 Chrome/120.0 Windows",
        )

        self.assertEqual(response.status_code, 200)
        session = UserSession.objects.get(user=self.user)
        self.assertTrue(session.is_active)
        self.assertIn("Chrome", session.device_name)
        self.assertEqual(session.browser, "Chrome")
        self.assertEqual(session.os, "Windows")

    def test_non_platform_user_without_hotel_cannot_login(self):
        orphan = User.objects.create_user(
            username="orphan-user",
            password="testpass123",
            role=User.Role.RECEPTION,
        )

        response = self.client.post(
            reverse("api-login"),
            data='{"username":"orphan-user","password":"testpass123"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "hotel_required")
        orphan.refresh_from_db()
        self.assertIsNone(orphan.hotel_id)

    def test_change_password_revokes_sessions(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )

        response = self.client.post(
            reverse("api-auth-change-password"),
            data='{"current_password":"testpass123","new_password":"Newpass12345!","new_password_confirm":"Newpass12345!"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Newpass12345!"))
        self.assertFalse(UserSession.objects.filter(user=self.user, is_active=True).exists())

    def test_change_password_requires_confirmation(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )

        response = self.client.post(
            reverse("api-auth-change-password"),
            data='{"current_password":"testpass123","new_password":"Newpass12345!"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid_password")
        self.assertIn("confirmation", " ".join(response.json()["errors"]).lower())

    def test_change_password_rejects_weak_password_terms(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )

        response = self.client.post(
            reverse("api-auth-change-password"),
            data='{"current_password":"testpass123","new_password":"Admin12345!","new_password_confirm":"Admin12345!"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid_password")

    def test_change_password_rejects_username_in_password(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )

        response = self.client.post(
            reverse("api-auth-change-password"),
            data='{"current_password":"testpass123","new_password":"Email-login-user123!","new_password_confirm":"Email-login-user123!"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "invalid_password")

    def test_password_reset_flow_uses_signed_token(self):
        forgot = self.client.post(
            reverse("api-auth-forgot-password"),
            data='{"email":"email-login@afrivo.test"}',
            content_type="application/json",
        )
        token = cache.get(f"auth:password-reset:{self.user.pk}")

        response = self.client.post(
            reverse("api-auth-reset-password"),
            data=f'{{"token":"{token}","new_password":"resetpass12345"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("resetpass12345"))

    def test_email_verification_flow_sets_flag(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )
        request_response = self.client.post(reverse("api-auth-email-verify-request"))
        token = cache.get(f"auth:email-verify:{self.user.pk}")

        response = self.client.post(
            reverse("api-auth-email-verify-confirm"),
            data=f'{{"token":"{token}"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_2fa_email_otp_preparation_and_verify(self):
        self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123"}',
            content_type="application/json",
        )

        setup = self.client.post(reverse("api-auth-2fa-setup"))
        otp = cache.get(f"auth:2fa:{self.user.pk}")
        response = self.client.post(
            reverse("api-auth-2fa-verify"),
            data=f'{{"code":"{otp}"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.two_factor_enabled)

    def test_enabled_2fa_requires_login_challenge(self):
        self.user.two_factor_enabled = True
        self.user.two_factor_enabled_at = timezone.now()
        self.user.save(update_fields=["two_factor_enabled", "two_factor_enabled_at"])

        login_response = self.client.post(
            reverse("api-login"),
            data='{"username":"email-login-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 200)
        payload = login_response.json()
        self.assertFalse(payload["authenticated"])
        self.assertTrue(payload["two_factor_required"])
        self.assertNotIn(settings.JWT_ACCESS_COOKIE_NAME, login_response.cookies)
        otp = cache.get(f"auth:2fa-login-code:{payload['challenge_id']}")

        verify_response = self.client.post(
            reverse("api-auth-2fa-login-verify"),
            data=f'{{"challenge_id":"{payload["challenge_id"]}","code":"{otp}"}}',
            content_type="application/json",
        )
        self.assertEqual(verify_response.status_code, 200)
        self.assertTrue(verify_response.json()["authenticated"])
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, verify_response.cookies)


class AuthTokenBlacklistTests(TestCase):
    def setUp(self):
        cache.clear()
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
        self.assertTrue(BlacklistedToken.objects.filter(token_hash=hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()).exists())
        self.assertFalse(BlacklistedToken.objects.get().token)

    def test_refresh_rejects_blacklisted_token(self):
        refresh_token = generate_jwt(self.user, "refresh")
        BlacklistedToken.objects.create(token_hash=hashlib.sha256(refresh_token.encode("utf-8")).hexdigest())
        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_token

        response = self.client.post(reverse("api-refresh"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "refresh_revoked")

    def test_refresh_blacklists_previous_refresh_token(self):
        login_response = self.client.post(
            reverse("api-login"),
            data='{"username":"blacklist-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        refresh_token = login_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_token

        response = self.client.post(reverse("api-refresh"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(BlacklistedToken.objects.filter(token_hash=hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()).exists())
        self.assertEqual(UserSession.objects.filter(user=self.user, is_active=True).count(), 1)

    def test_revoked_session_cannot_refresh(self):
        login_response = self.client.post(
            reverse("api-login"),
            data='{"username":"blacklist-user","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        refresh_token = login_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
        UserSession.objects.filter(user=self.user).update(is_active=False)
        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_token

        response = self.client.post(reverse("api-refresh"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "session_revoked")


class AuthIamEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.platform_admin = User.objects.create_user(
            username="iam-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )

    def login(self):
        response = self.client.post(
            reverse("api-login"),
            data='{"username":"iam-admin","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        if response.json().get("two_factor_required"):
            payload = response.json()
            otp = cache.get(f"auth:2fa-login-code:{payload['challenge_id']}")
            response = self.client.post(
                reverse("api-auth-2fa-login-verify"),
                data=f'{{"challenge_id":"{payload["challenge_id"]}","code":"{otp}"}}',
                content_type="application/json",
            )
        return response

    def test_me_endpoint_returns_public_identity(self):
        self.login()

        response = self.client.get(reverse("api-auth-me"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["user"]["username"], self.platform_admin.username)
        self.assertIn("public_id", payload["user"])

    def test_sessions_endpoint_lists_active_sessions(self):
        self.login()

        response = self.client.get(reverse("api-auth-sessions"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 1)

    def test_session_delete_revokes_session(self):
        self.login()
        session = UserSession.objects.get(user=self.platform_admin)

        response = self.client.delete(reverse("api-auth-session-detail", args=[session.id]))

        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertFalse(session.is_active)

    def test_delete_all_sessions_revokes_sessions(self):
        self.login()

        response = self.client.delete(reverse("api-auth-sessions-all"))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(UserSession.objects.filter(user=self.platform_admin, is_active=True).exists())

    def test_iam_roles_are_exposed_to_platform_admin(self):
        self.login()

        response = self.client.get(reverse("api-iam-roles"))

        self.assertEqual(response.status_code, 200)
        role_codes = {item["code"] for item in response.json()["results"]}
        self.assertTrue(role_codes)
        self.assertTrue(IAMRole.objects.filter(code__in=role_codes).exists())
        self.assertIn("permission_codes", response.json()["results"][0])

    def test_platform_admin_can_create_and_update_custom_iam_role(self):
        self.login()
        permission, _ = IAMPermission.objects.get_or_create(
            code="dayuse.create",
            defaults={
                "module_code": "dayuse",
                "action": "create",
                "description": "Creer un day use",
            },
        )

        create_response = self.client.post(
            reverse("api-iam-role-create"),
            data='{"code":"FRONT_DESK_LEAD","name":"Chef reception","permission_codes":["dayuse.create"]}',
            content_type="application/json",
        )

        self.assertEqual(create_response.status_code, 201)
        role_id = create_response.json()["role"]["id"]
        role = IAMRole.objects.get(pk=role_id)
        self.assertFalse(role.is_system)
        self.assertTrue(IAMRolePermission.objects.filter(role=role, permission=permission).exists())

        update_response = self.client.patch(
            reverse("api-iam-role-detail", args=[role_id]),
            data='{"name":"Responsable reception","permission_codes":[]}',
            content_type="application/json",
        )

        self.assertEqual(update_response.status_code, 200)
        role.refresh_from_db()
        self.assertEqual(role.name, "Responsable reception")
        self.assertFalse(IAMRolePermission.objects.filter(role=role).exists())
        self.assertTrue(
            ActivityLog.objects.filter(
                module="iam",
                action=ActivityLog.Action.PERMISSION_CHANGE,
                object_type="IAMRole",
                object_id=str(role.id),
                metadata__security_event="iam_role_created",
            ).exists()
        )
        self.assertTrue(
            ActivityLog.objects.filter(
                module="iam",
                action=ActivityLog.Action.PERMISSION_CHANGE,
                object_type="IAMRole",
                object_id=str(role.id),
                metadata__security_event="iam_role_updated",
            ).exists()
        )

    def test_platform_admin_cannot_assign_critical_iam_role(self):
        self.login()
        organization, _ = get_or_create_default_tenancy()
        target = User.objects.create_user(username="target-critical", password="testpass123")

        response = self.client.post(
            reverse("api-iam-assign-role"),
            data=f'{{"user_id":{target.id},"organization_id":{organization.id},"role_code":"SUPER_ROOT"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(UserOrganizationRole.objects.filter(user=target, role_code=User.IamRole.SUPER_ROOT).exists())

    def test_platform_admin_cannot_assign_equal_super_admin_role(self):
        self.login()
        organization, _ = get_or_create_default_tenancy()
        target = User.objects.create_user(
            username="target-super-admin-role",
            password="testpass123",
            organization=organization,
        )

        response = self.client.post(
            reverse("api-iam-assign-role"),
            data=f'{{"user_id":{target.id},"organization_id":{organization.id},"role_code":"SUPER_ADMIN_PLATFORM"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(UserOrganizationRole.objects.filter(user=target, role_code=User.IamRole.SUPER_ADMIN_PLATFORM).exists())

    def test_limited_platform_admin_cannot_assign_iam_roles(self):
        limited_admin = User.objects.create_user(
            username="limited-platform-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )
        self.client.force_login(limited_admin)
        organization, _ = get_or_create_default_tenancy()
        target = User.objects.create_user(
            username="target-platform-peer",
            password="testpass123",
            organization=organization,
        )

        response = self.client.post(
            reverse("api-iam-assign-role"),
            data=f'{{"user_id":{target.id},"organization_id":{organization.id},"role_code":"ORGANIZATION_ADMIN"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(UserOrganizationRole.objects.filter(user=target, role_code=User.IamRole.ORGANIZATION_ADMIN).exists())

    def test_iam_assign_and_revoke_are_audited(self):
        self.login()
        organization, _ = get_or_create_default_tenancy()
        target = User.objects.create_user(username="target-audit", password="testpass123")

        assign_response = self.client.post(
            reverse("api-iam-assign-role"),
            data=f'{{"user_id":{target.id},"organization_id":{organization.id},"role_code":"ORGANIZATION_ADMIN"}}',
            content_type="application/json",
        )
        revoke_response = self.client.post(
            reverse("api-iam-revoke-role"),
            data=f'{{"user_id":{target.id},"organization_id":{organization.id},"role_code":"ORGANIZATION_ADMIN"}}',
            content_type="application/json",
        )

        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(revoke_response.status_code, 200)
        self.assertEqual(ActivityLog.objects.filter(module="iam", object_id=str(target.id)).count(), 2)


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

    def test_django_superuser_option_does_not_create_platform_admin(self):
        call_command(
            "create_hotel_admin",
            username="django-superuser-admin",
            password="testpass123",
            organization_id=self.organization.id,
            hotel_id=self.hotel.id,
            django_superuser=True,
        )

        user = User.objects.get(username="django-superuser-admin")
        self.assertTrue(user.is_superuser)
        self.assertFalse(user.is_platform_admin)
        self.assertEqual(user.organization_id, self.organization.id)
        self.assertEqual(user.hotel_id, self.hotel.id)


class CreatePlatformAdminCommandTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_command_creates_platform_admin_without_tenancy(self):
        out = StringIO()

        call_command(
            "create_platform_admin",
            username="platform-root",
            password="testpass123",
            first_name="Root",
            last_name="Platform",
            email="root@afrivo.test",
            stdout=out,
        )

        user = User.objects.get(username="platform-root")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.is_platform_admin)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.platform_role, User.PlatformRole.SUPER_ADMIN)
        self.assertTrue(user.is_active)
        self.assertIsNone(user.organization_id)
        self.assertIsNone(user.hotel_id)
        self.assertTrue(user.check_password("testpass123"))
        self.assertIn("Admin plateforme AFRIVO cree avec succes", out.getvalue())

    def test_created_platform_admin_can_login_and_access_platform_dashboard(self):
        call_command(
            "create_platform_admin",
            username="platform-login",
            password="testpass123",
        )

        login_response = self.client.post(
            reverse("api-login"),
            data='{"username":"platform-login","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        if login_response.json().get("two_factor_required"):
            payload = login_response.json()
            otp = cache.get(f"auth:2fa-login-code:{payload['challenge_id']}")
            login_response = self.client.post(
                reverse("api-auth-2fa-login-verify"),
                data=f'{{"challenge_id":"{payload["challenge_id"]}","code":"{otp}"}}',
                content_type="application/json",
            )

        self.assertEqual(login_response.status_code, 200)
        login_payload = login_response.json()
        self.assertTrue(login_payload["authenticated"])
        self.assertTrue(login_payload["user"]["is_platform_admin"])
        self.assertIsNone(login_payload["user"]["organization_id"])
        self.assertIsNone(login_payload["user"]["hotel_id"])

        dashboard_response = self.client.get(reverse("api-platform-dashboard"))

        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.json()["title"], "Console plateforme AFRIVO")

    def test_command_rejects_duplicate_username(self):
        call_command(
            "create_platform_admin",
            username="duplicate-platform",
            password="testpass123",
        )

        with self.assertRaisesMessage(Exception, "Ce nom d'utilisateur existe deja."):
            call_command(
                "create_platform_admin",
                username="duplicate-platform",
                password="testpass123",
            )
