from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.cache import cache
from django.conf import settings

from apps.audit_logs.models import ActivityLog
from apps.iam.models import User, UserSession
from apps.iam.services.token_service import decode_jwt
from apps.platform_admin.models import HotelSubscription, SubscriptionPlan
from apps.super_root.services.dashboard_service import SuperRootDashboardService
from apps.super_root.services.security_policy_service import SuperRootSecurityPolicyService
from apps.users.services import create_hotel_admin_user
from apps.tenancy.models import Hotel, Organization


class SuperRootSecurityRegressionTests(TestCase):
    """Phase 8 security tests for Super Root dashboard and access boundaries."""

    def setUp(self):
        self.organization = Organization.objects.create(name="Super Root Security Org", slug="super-root-security-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Super Root Security Hotel",
            code="SRS",
            slug="super-root-security-hotel",
        )
        self.plan = SubscriptionPlan.objects.create(code="quota-two", name="Quota Two", max_users=2, max_hotels=1)
        HotelSubscription.objects.create(
            organization=self.organization,
            hotel=self.hotel,
            plan=self.plan,
            status=HotelSubscription.Status.ACTIVE,
        )
        for index in range(2):
            User.objects.create_user(
                username=f"quota-user-{index}",
                password="testpass123",
                role=User.Role.RECEPTION,
                organization=self.organization,
                hotel=self.hotel,
            )

    def test_quota_critical_is_reported_in_super_root_dashboard(self):
        dashboard = SuperRootDashboardService.build()

        risk = next(item for item in dashboard["quota_risks"] if item["hotel_id"] == self.hotel.id)
        self.assertEqual(risk["used"], 2)
        self.assertEqual(risk["quota"], 2)
        self.assertEqual(risk["pct"], 100)
        self.assertEqual(risk["status"], "critique")

    def test_super_root_dashboard_api_requires_super_root(self):
        platform_admin = User.objects.create_user(
            username="not-super-root",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.SUPER_ADMIN,
        )
        self.client.force_login(platform_admin)

        response = self.client.get(reverse("api-super-root-dashboard"))

        self.assertEqual(response.status_code, 403)


class SuperRootFacadeRouteTests(TestCase):
    def setUp(self):
        self.super_root = User.objects.create_superuser(username="facade-root", password="testpass123")
        self.organization = Organization.objects.create(name="Facade Org", slug="facade-org")
        self.hotel = Hotel.objects.create(
            organization=self.organization,
            name="Facade Hotel",
            code="FAC",
            slug="facade-hotel",
        )

    def test_requested_super_root_facade_routes_exist_for_super_root(self):
        self.client.force_login(self.super_root)
        route_names = [
            "api-super-root-dashboard",
            "api-super-root-platforms",
            "api-super-root-organizations",
            "api-super-root-hotels",
            "api-super-root-users",
            "api-super-root-roles",
            "api-super-root-permissions",
            "api-super-root-licenses",
            "api-super-root-modules",
            "api-super-root-audit-logs",
            "api-super-root-security-alerts",
            "api-super-root-system-settings",
            "api-super-root-maintenance",
            "api-super-root-backups",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["success"])

    def test_super_root_auth_login_accepts_only_super_root(self):
        response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertFalse(response.json()["authenticated"])
        self.assertTrue(response.json()["two_factor_required"])
        self.assertIn("challenge_id", response.json())
        self.assertNotIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        challenge = cache.get(f"auth:2fa-login:{response.json()['challenge_id']}")
        self.assertIsNotNone(challenge)
        self.assertTrue(challenge["super_root"])
        self.assertFalse(challenge["remember_me"])

        hotel_user = User.objects.create_user(
            username="facade-hotel-user",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        response = self.client.post(
            reverse("api-super-root-auth-login"),
            data=f'{{"username":"{hotel_user.username}","password":"testpass123"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.json()["success"])

    def test_super_root_auth_login_forces_mfa_even_when_user_2fa_is_disabled(self):
        self.super_root.two_factor_enabled = False
        self.super_root.save(update_fields=["two_factor_enabled"])

        response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["two_factor_required"])
        self.assertFalse(payload["authenticated"])
        self.assertEqual(payload["session_age_seconds"], SuperRootSecurityPolicyService.session_age_seconds())
        challenge = cache.get(f"auth:2fa-login:{payload['challenge_id']}")
        self.assertFalse(challenge["remember_me"])
        self.assertEqual(challenge["session_age_seconds"], SuperRootSecurityPolicyService.session_age_seconds())

    def test_super_root_auth_login_audits_attempt_success_failure_and_mfa_required(self):
        before = ActivityLog.objects.filter(module="super_root_security").count()

        self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"wrong"}',
            content_type="application/json",
        )
        self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123"}',
            content_type="application/json",
        )

        descriptions = list(
            ActivityLog.objects.filter(module="super_root_security")
            .order_by("id")
            .values_list("description", flat=True)[before:]
        )
        self.assertTrue(any("login.attempt" in description for description in descriptions))
        self.assertTrue(any("login.failed" in description for description in descriptions))
        self.assertTrue(any("login.credentials_accepted" in description for description in descriptions))
        self.assertTrue(any("mfa_required" in description for description in descriptions))

    @override_settings(SUPER_ROOT_SESSION_AGE_SECONDS=60)
    def test_super_root_mfa_verification_creates_short_non_remembered_session(self):
        login_response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123","remember_me":true}',
            content_type="application/json",
        )
        challenge_id = login_response.json()["challenge_id"]
        otp = cache.get(f"auth:2fa-login-code:{challenge_id}")

        verify_response = self.client.post(
            reverse("api-auth-2fa-login-verify"),
            data=f'{{"challenge_id":"{challenge_id}","code":"{otp}"}}',
            content_type="application/json",
        )

        self.assertEqual(verify_response.status_code, 200)
        access_token = verify_response.cookies[settings.JWT_ACCESS_COOKIE_NAME].value
        refresh_cookie = verify_response.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        payload = decode_jwt(access_token, expected_type="access")
        self.assertLessEqual(payload["exp"] - payload["iat"], 60)
        self.assertFalse(payload["rmb"])
        self.assertEqual(refresh_cookie["max-age"], "")
        self.assertTrue(
            UserSession.objects.filter(
                user=self.super_root,
                refresh_token_jti=decode_jwt(refresh_cookie.value, expected_type="refresh")["jti"],
                is_active=True,
            ).exists()
        )

    def test_super_root_login_records_ip_and_device_after_mfa(self):
        login_response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123","remember_me":true}',
            content_type="application/json",
            REMOTE_ADDR="172.16.1.42",
            HTTP_USER_AGENT="SecurityBrowser/10.0",
        )
        challenge_id = login_response.json()["challenge_id"]
        otp = cache.get(f"auth:2fa-login-code:{challenge_id}")

        verify_response = self.client.post(
            reverse("api-auth-2fa-login-verify"),
            data=f'{{"challenge_id":"{challenge_id}","code":"{otp}"}}',
            content_type="application/json",
            REMOTE_ADDR="172.16.1.42",
            HTTP_USER_AGENT="SecurityBrowser/10.0",
        )

        self.assertEqual(verify_response.status_code, 200)
        session = UserSession.objects.filter(user=self.super_root, is_active=True).latest("id")
        self.assertEqual(session.ip_address, "172.16.1.42")
        self.assertEqual(session.user_agent, "SecurityBrowser/10.0")
        self.assertTrue(session.device_name)

    def test_super_root_cannot_access_dashboard_before_mfa_validation(self):
        self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123"}',
            content_type="application/json",
        )

        response = self.client.get(reverse("api-super-root-dashboard"))

        self.assertEqual(response.status_code, 401)

    def test_super_root_mfa_success_and_failure_are_audited(self):
        login_response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123"}',
            content_type="application/json",
        )
        first_challenge_id = login_response.json()["challenge_id"]

        failed_response = self.client.post(
            reverse("api-auth-2fa-login-verify"),
            data=f'{{"challenge_id":"{first_challenge_id}","code":"000000"}}',
            content_type="application/json",
        )

        self.assertEqual(failed_response.status_code, 400)

        login_response = self.client.post(
            reverse("api-super-root-auth-login"),
            data='{"username":"facade-root","password":"testpass123"}',
            content_type="application/json",
        )
        second_challenge_id = login_response.json()["challenge_id"]
        otp = cache.get(f"auth:2fa-login-code:{second_challenge_id}")
        success_response = self.client.post(
            reverse("api-auth-2fa-login-verify"),
            data=f'{{"challenge_id":"{second_challenge_id}","code":"{otp}"}}',
            content_type="application/json",
        )

        self.assertEqual(success_response.status_code, 200)
        descriptions = list(
            ActivityLog.objects.filter(module="super_root_security")
            .order_by("id")
            .values_list("description", flat=True)
        )
        self.assertTrue(any("mfa_failed" in description for description in descriptions))
        self.assertTrue(any("mfa_success" in description for description in descriptions))


class SuperRootSecurityPolicyServiceTests(TestCase):
    def setUp(self):
        self.super_root = User.objects.create_superuser(username="policy-root", password="testpass123")
        self.platform_admin = User.objects.create_user(
            username="policy-platform",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )

    def test_detects_super_root_only(self):
        self.assertTrue(SuperRootSecurityPolicyService.is_super_root(self.super_root))
        self.assertFalse(SuperRootSecurityPolicyService.is_super_root(self.platform_admin))
        self.assertFalse(SuperRootSecurityPolicyService.is_super_root(None))

    def test_requires_super_root(self):
        self.assertTrue(SuperRootSecurityPolicyService.require_super_root(self.super_root))
        with self.assertRaises(PermissionDenied):
            SuperRootSecurityPolicyService.require_super_root(self.platform_admin)

    def test_super_root_always_requires_mfa(self):
        self.super_root.two_factor_enabled = False
        self.super_root.save(update_fields=["two_factor_enabled"])

        self.assertTrue(SuperRootSecurityPolicyService.mfa_required(self.super_root))
        self.assertFalse(SuperRootSecurityPolicyService.mfa_required(self.platform_admin))

    @override_settings(SUPER_ROOT_SESSION_AGE_SECONDS=900)
    def test_session_age_uses_super_root_setting(self):
        self.assertEqual(SuperRootSecurityPolicyService.session_age_seconds(), 900)

    def test_default_super_root_session_age_is_thirty_minutes(self):
        self.assertEqual(settings.SUPER_ROOT_SESSION_AGE_SECONDS, 1800)

    def test_critical_actions_are_declared(self):
        self.assertTrue(
            SuperRootSecurityPolicyService.is_critical_action(
                SuperRootSecurityPolicyService.ACTION_MAINTENANCE
            )
        )
        self.assertTrue(
            SuperRootSecurityPolicyService.is_critical_action(
                SuperRootSecurityPolicyService.ACTION_BACKUP_RESTORE
            )
        )
        self.assertTrue(
            SuperRootSecurityPolicyService.is_critical_action(
                SuperRootSecurityPolicyService.ACTION_MFA_DISABLE
            )
        )
        self.assertFalse(SuperRootSecurityPolicyService.is_critical_action("ordinary.read"))

    def test_critical_confirmation_requires_expected_phrase(self):
        action = SuperRootSecurityPolicyService.ACTION_MFA_DISABLE

        with self.assertRaises(ValidationError):
            SuperRootSecurityPolicyService.validate_confirmation(action, {})
        with self.assertRaises(ValidationError):
            SuperRootSecurityPolicyService.validate_confirmation(
                action,
                {"confirmed": True, "phrase": "CONFIRMER"},
            )

        self.assertTrue(
            SuperRootSecurityPolicyService.validate_confirmation(
                action,
                {"confirmed": True, "phrase": "DESACTIVER MFA"},
            )
        )

    def test_second_super_root_is_blocked_by_default(self):
        target = User.objects.create_user(username="policy-target", password="testpass123")

        self.assertFalse(
            SuperRootSecurityPolicyService.can_create_or_elevate_super_root(
                self.super_root,
                target_user=target,
            )
        )
        with self.assertRaises(PermissionDenied):
            SuperRootSecurityPolicyService.validate_super_root_creation_or_elevation(
                self.super_root,
                target_user=target,
            )

    @override_settings(ALLOW_SUPER_ROOT_BOOTSTRAP=True)
    def test_second_super_root_requires_confirmation_when_bootstrap_enabled(self):
        target = User.objects.create_user(username="policy-target-bootstrap", password="testpass123")

        with self.assertRaises(ValidationError):
            SuperRootSecurityPolicyService.validate_super_root_creation_or_elevation(
                self.super_root,
                target_user=target,
                confirmation={"confirmed": True, "phrase": "CONFIRMER"},
            )

        self.assertTrue(
            SuperRootSecurityPolicyService.validate_super_root_creation_or_elevation(
                self.super_root,
                target_user=target,
                confirmation={"confirmed": True, "phrase": "SUPER ROOT"},
            )
        )

    def test_direct_second_super_root_creation_is_blocked_without_bootstrap_flag(self):
        with self.assertRaises(ValidationError):
            User.objects.create_superuser(username="second-root-blocked", password="testpass123")

        self.assertFalse(User.objects.filter(username="second-root-blocked").exists())
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="Creation ou elevation Super Root bloquee",
            ).exists()
        )

    @override_settings(ALLOW_SUPER_ROOT_BOOTSTRAP=True)
    def test_second_super_root_creation_can_only_bypass_with_bootstrap_flag(self):
        second = User.objects.create_superuser(username="second-root-bootstrap", password="testpass123")

        self.assertTrue(second.is_super_root)
        self.assertEqual(
            User.objects.filter(is_superuser=True, is_platform_admin=False, is_active=True).count(),
            2,
        )

    def test_service_refuses_hotel_admin_superuser_when_super_root_exists(self):
        org = Organization.objects.create(name="Guard Org", slug="guard-org")
        hotel = Hotel.objects.create(organization=org, name="Guard Hotel", code="GHD", slug="guard-hotel")

        with self.assertRaises(PermissionDenied):
            create_hotel_admin_user(
                username="guarded-superuser-admin",
                password="testpass123",
                organization_id=org.id,
                hotel_id=hotel.id,
                is_superuser=True,
            )

        self.assertFalse(User.objects.filter(username="guarded-superuser-admin").exists())


class SuperRootMandatoryAuditTests(TestCase):
    def setUp(self):
        self.super_root = User.objects.create_superuser(username="audit-root", password="testpass123")
        self.platform_admin = User.objects.create_user(
            username="audit-platform",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
            platform_role=User.PlatformRole.PLATFORM_ADMIN,
        )

    def test_dashboard_access_is_audited_with_security_metadata(self):
        self.client.force_login(self.super_root)
        response = self.client.get(
            reverse("api-super-root-dashboard"),
            HTTP_USER_AGENT="AuditBrowser/1.0",
            REMOTE_ADDR="10.10.10.10",
        )

        self.assertEqual(response.status_code, 200)
        log = ActivityLog.objects.filter(
            module="super_root_security",
            description__contains="dashboard.access",
        ).latest("id")
        self.assertEqual(log.user, self.super_root)
        self.assertEqual(log.metadata["action"], "dashboard.access")
        self.assertEqual(log.metadata["ip_address"], "10.10.10.10")
        self.assertEqual(log.metadata["user_agent"], "AuditBrowser/1.0")
        self.assertEqual(log.metadata["portal"], "super_root")
        self.assertIn("device_session_id", log.metadata)

    def test_audit_log_consultation_is_audited(self):
        self.client.force_login(self.super_root)
        response = self.client.get(reverse("api-super-root-audit-logs"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="audit_logs.view",
            ).exists()
        )

    def test_forbidden_attempt_is_audited(self):
        self.client.force_login(self.platform_admin)
        response = self.client.get(reverse("api-super-root-dashboard"))

        self.assertEqual(response.status_code, 403)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="access.denied",
                metadata__reason="super_root_required",
            ).exists()
        )

    def test_maintenance_run_requires_backend_confirmation_for_real_action(self):
        self.client.force_login(self.super_root)
        response = self.client.post(
            reverse("api-super-root-maintenance-run"),
            data='{"action":"healthcheck","dry_run":false}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "critical_confirmation_required")
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="critical_confirmation.failed.maintenance.system",
            ).exists()
        )

    def test_maintenance_run_with_confirmation_is_audited_as_critical_operation(self):
        self.client.force_login(self.super_root)
        response = self.client.post(
            reverse("api-super-root-maintenance-run"),
            data='{"action":"healthcheck","dry_run":false,"confirmation":{"confirmed":true,"phrase":"CONFIRMER"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="maintenance.run",
                severity=ActivityLog.Severity.CRITICAL,
            ).exists()
        )

    def test_logout_is_audited_for_super_root(self):
        self.client.force_login(self.super_root)
        response = self.client.post(reverse("api-super-root-auth-logout"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="logout",
                user=self.super_root,
            ).exists()
        )

    def test_super_root_security_exposes_active_device_sessions(self):
        UserSession.objects.create(
            user=self.super_root,
            refresh_token_jti="audit-session-one",
            device_name="Chrome sur Windows",
            browser="Chrome",
            os="Windows",
            ip_address="10.0.0.5",
            user_agent="AuditAgent/1.0",
        )
        self.client.force_login(self.super_root)

        response = self.client.get(reverse("api-super-root-security"))

        self.assertEqual(response.status_code, 200)
        sessions = response.json()["security"]["active_super_root_sessions"]
        self.assertTrue(any(session["device_name"] == "Chrome sur Windows" for session in sessions))
        self.assertTrue(any(session["ip_address"] == "10.0.0.5" for session in sessions))

    def test_super_root_can_revoke_active_super_root_session(self):
        session = UserSession.objects.create(
            user=self.super_root,
            refresh_token_jti="audit-session-revoke",
            device_name="Firefox sur Linux",
            browser="Firefox",
            os="Linux",
            ip_address="10.0.0.9",
            user_agent="AuditAgent/2.0",
        )
        self.client.force_login(self.super_root)

        response = self.client.delete(
            reverse("api-super-root-security-session-revoke", args=[session.id]),
            data='{"confirmation":{"confirmed":true,"phrase":"CONFIRMER"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertFalse(session.is_active)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="security.session_revoke",
                metadata__session_id=session.id,
            ).exists()
        )

    def test_super_root_revoke_session_requires_backend_confirmation(self):
        session = UserSession.objects.create(
            user=self.super_root,
            refresh_token_jti="audit-session-revoke-no-confirm",
            device_name="Firefox sur Linux",
            browser="Firefox",
            os="Linux",
            ip_address="10.0.0.9",
            user_agent="AuditAgent/2.0",
        )
        self.client.force_login(self.super_root)

        response = self.client.delete(reverse("api-super-root-security-session-revoke", args=[session.id]))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "critical_confirmation_required")
        session.refresh_from_db()
        self.assertTrue(session.is_active)
        self.assertTrue(
            ActivityLog.objects.filter(
                module="super_root_security",
                description__contains="critical_confirmation.failed.security.session_revoke",
            ).exists()
        )

    def test_super_root_revoke_session_refuses_non_super_root_session(self):
        hotel_user = User.objects.create_user(username="audit-hotel-session", password="testpass123")
        session = UserSession.objects.create(
            user=hotel_user,
            refresh_token_jti="audit-session-non-root",
            device_name="Safari sur macOS",
            browser="Safari",
            os="macOS",
            ip_address="10.0.0.10",
            user_agent="AuditAgent/3.0",
        )
        self.client.force_login(self.super_root)

        response = self.client.delete(reverse("api-super-root-security-session-revoke", args=[session.id]))

        self.assertEqual(response.status_code, 404)
        session.refresh_from_db()
        self.assertTrue(session.is_active)
