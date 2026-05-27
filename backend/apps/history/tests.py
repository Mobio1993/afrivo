from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.history.models import ActivityLog
from apps.history.services import log_activity
from apps.tenancy.models import Hotel, Organization
from apps.users.models import UserModulePermission


User = get_user_model()


class ActivityLogApiTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", slug="org")
        self.hotel = Hotel.objects.create(organization=self.organization, name="Hotel A", code="A", slug="hotel-a")
        self.other_hotel = Hotel.objects.create(organization=self.organization, name="Hotel B", code="B", slug="hotel-b")
        self.admin = User.objects.create_user(
            username="admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.reception = User.objects.create_user(
            username="reception",
            password="testpass123",
            role=User.Role.RECEPTION,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.platform_admin = User.objects.create_user(
            username="platform",
            password="testpass123",
            role=User.Role.ADMIN,
            is_platform_admin=True,
        )

    def test_log_activity_creates_entry(self):
        entry = log_activity(
            user=self.admin,
            hotel=self.hotel,
            action=ActivityLog.Action.CREATE,
            module="bookings",
            object_type="Booking",
            object_id=12,
            description="Creation d'une reservation",
            new_values={"status": "pending"},
            severity=ActivityLog.Severity.SUCCESS,
        )

        self.assertEqual(entry.hotel, self.hotel)
        self.assertEqual(entry.user, self.admin)
        self.assertEqual(entry.action, ActivityLog.Action.CREATE)
        self.assertEqual(entry.new_values["status"], "pending")
        self.assertTrue(entry.integrity_hash)
        self.assertTrue(entry.verify_integrity())

    def test_activity_log_integrity_chain_detects_tampering(self):
        first = log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.CREATE, module="bookings", description="First")
        second = log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.UPDATE, module="bookings", description="Second")

        self.assertEqual(second.previous_integrity_hash, first.integrity_hash)
        self.assertTrue(second.verify_integrity())

        ActivityLog.objects.filter(pk=second.pk).update(description="Second altered")
        second.refresh_from_db()
        self.assertFalse(second.verify_integrity())

    def test_integrity_endpoint_reports_invalid_logs(self):
        log = log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.CREATE, module="bookings", description="Sealed")
        ActivityLog.objects.filter(pk=log.pk).update(description="Tampered")

        self.client.force_login(self.platform_admin)
        response = self.client.get(reverse("activity-log-integrity"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total_checked"], 1)
        self.assertEqual(payload["invalid"], 1)
        self.assertEqual(payload["status"], "warning")

    def test_hotel_user_sees_only_own_hotel_logs(self):
        own = log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.CREATE, module="bookings", description="Own")
        log_activity(user=self.admin, hotel=self.other_hotel, action=ActivityLog.Action.CREATE, module="bookings", description="Other")

        self.client.force_login(self.admin)
        response = self.client.get(reverse("activity-log-list"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertIn(own.id, ids)
        self.assertEqual(len(ids), 1)

    def test_platform_admin_can_see_multiple_hotels(self):
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.CREATE, module="bookings", description="Own")
        log_activity(user=self.admin, hotel=self.other_hotel, action=ActivityLog.Action.CREATE, module="bookings", description="Other")

        self.client.force_login(self.platform_admin)
        response = self.client.get(reverse("activity-log-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 2)

    def test_filters_and_pagination(self):
        for index in range(3):
            log_activity(
                user=self.admin,
                hotel=self.hotel,
                action=ActivityLog.Action.PAYMENT,
                module="billing",
                description=f"Paiement {index}",
                severity=ActivityLog.Severity.SUCCESS,
            )
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.CANCEL, module="bookings", description="Annulation")

        self.client.force_login(self.admin)
        response = self.client.get(reverse("activity-log-list"), {"module": "billing", "page_size": 2})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 3)
        self.assertEqual(len(payload["results"]), 2)
        self.assertTrue(all(item["module"] == "billing" for item in payload["results"]))

    def test_access_refused_without_permission(self):
        self.client.force_login(self.reception)
        response = self.client.get(reverse("activity-log-list"))

        self.assertEqual(response.status_code, 403)

    def test_explicit_permission_does_not_allow_non_admin(self):
        UserModulePermission.objects.create(user=self.reception, module_code="history", can_view=True)
        log_activity(user=self.reception, hotel=self.hotel, action=ActivityLog.Action.VIEW, module="clients", description="Consultation")

        self.client.force_login(self.reception)
        response = self.client.get(reverse("activity-log-list"))

        self.assertEqual(response.status_code, 403)

    def test_summary_endpoint(self):
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.LOGIN, module="auth", description="Login")
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.PAYMENT, module="billing", description="Payment")
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.REFUND, module="billing", description="Refund", severity=ActivityLog.Severity.DANGER)

        self.client.force_login(self.admin)
        response = self.client.get(reverse("activity-log-summary"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["logins_today"], 1)
        self.assertEqual(payload["payments_recorded"], 1)
        self.assertEqual(payload["critical_alerts"], 1)

    def test_role_permission_history_endpoint_projects_iam_events(self):
        role_change = log_activity(
            user=self.admin,
            hotel=self.hotel,
            action=ActivityLog.Action.PERMISSION_CHANGE,
            module="users",
            object_type="User",
            object_id=self.reception.id,
            object_reference=self.reception.username,
            description="Role utilisateur modifie.",
            old_values={"role": "staff", "platform_role": ""},
            new_values={"role": "reception", "platform_role": "RECEPTIONIST"},
            metadata={"security_event": "user_role_changed", "target_user_id": self.reception.id},
        )
        log_activity(
            user=self.platform_admin,
            hotel=None,
            action=ActivityLog.Action.PERMISSION_CHANGE,
            module="iam",
            object_type="IAMRole",
            object_id=77,
            object_reference="HOTEL_MANAGER",
            description="Role IAM HOTEL_MANAGER updated.",
            old_values={"code": "HOTEL_MANAGER", "permission_codes": ["rooms.view"]},
            new_values={"code": "HOTEL_MANAGER", "permission_codes": ["rooms.view", "bookings.view"]},
            metadata={"security_event": "iam_role_updated", "role_code": "HOTEL_MANAGER"},
        )
        log_activity(user=self.admin, hotel=self.hotel, action=ActivityLog.Action.UPDATE, module="rooms", description="Ignored")

        self.client.force_login(self.platform_admin)
        response = self.client.get(reverse("activity-log-role-permission-history"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 2)
        user_event = next(item for item in payload["results"] if item["id"] == role_change.id)
        self.assertEqual(user_event["event_type"], "user_role_changed")
        self.assertEqual(user_event["target_reference"], self.reception.username)
        self.assertEqual(user_event["old_role"], "staff")
        self.assertEqual(user_event["new_role"], "RECEPTIONIST")

    def test_role_permission_history_keeps_hotel_scope(self):
        own = log_activity(
            user=self.admin,
            hotel=self.hotel,
            action=ActivityLog.Action.PERMISSION_CHANGE,
            module="users",
            object_type="User",
            object_reference="own-user",
            description="Own role update.",
            metadata={"security_event": "user_role_changed"},
        )
        log_activity(
            user=self.admin,
            hotel=self.other_hotel,
            action=ActivityLog.Action.PERMISSION_CHANGE,
            module="users",
            object_type="User",
            object_reference="other-user",
            description="Other role update.",
            metadata={"security_event": "user_role_changed"},
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse("activity-log-role-permission-history"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertEqual(ids, [own.id])

    def test_security_alerts_detect_failed_login_burst_and_sensitive_changes(self):
        for _ in range(3):
            log_activity(
                user=None,
                hotel=None,
                action=ActivityLog.Action.LOGIN,
                module="auth",
                object_type="User",
                object_reference="victim@example.com",
                description="Tentative de connexion echouee.",
                severity=ActivityLog.Severity.WARNING,
                metadata={"reason": "invalid_credentials"},
            )
        permission_log = log_activity(
            user=self.platform_admin,
            hotel=None,
            action=ActivityLog.Action.PERMISSION_CHANGE,
            module="iam",
            object_type="IAMRole",
            object_reference="ACCOUNTANT",
            description="Role IAM ACCOUNTANT updated.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"security_event": "iam_role_updated", "role_code": "ACCOUNTANT"},
        )

        self.client.force_login(self.platform_admin)
        response = self.client.get(reverse("activity-log-security-alerts"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(payload["summary"]["total"], 2)
        self.assertEqual(payload["summary"]["failed_login_bursts"], 1)
        self.assertTrue(any(item["type"] == "failed_login_burst" for item in payload["results"]))
        self.assertTrue(any(item.get("source_log_id") == permission_log.id for item in payload["results"]))

    def test_security_alerts_keep_hotel_scope(self):
        own = log_activity(
            user=self.admin,
            hotel=self.hotel,
            action=ActivityLog.Action.DELETE,
            module="users",
            object_type="User",
            object_reference="own-user",
            description="Own account disabled.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"security_event": "user_deactivated"},
        )
        log_activity(
            user=self.admin,
            hotel=self.other_hotel,
            action=ActivityLog.Action.DELETE,
            module="users",
            object_type="User",
            object_reference="other-user",
            description="Other account disabled.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"security_event": "user_deactivated"},
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse("activity-log-security-alerts"))

        self.assertEqual(response.status_code, 200)
        source_ids = [item.get("source_log_id") for item in response.json()["results"]]
        self.assertEqual(source_ids, [own.id])
