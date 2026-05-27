from datetime import timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.history.models import ActivityLog
from apps.history.serializers import ActivityLogSerializer, RolePermissionHistorySerializer
from apps.tenancy.drf import AuthenticatedHotelPermission
from apps.tenants.services.tenant_service import TenantService


class ActivityLogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ActivityLogPermission(AuthenticatedHotelPermission):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        user = request.user
        if getattr(user, "is_platform_admin", False):
            return True
        if getattr(user, "is_hotel_admin", False):
            return True
        self.message = "Vous n'avez pas les droits suffisants pour consulter le journal d'activite."
        return False


class ActivityLogViewSet(ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer
    pagination_class = ActivityLogPagination
    permission_classes = [ActivityLogPermission]
    permission_module = "history"
    hotel_scope_module = "history"
    allow_platform_without_hotel = True

    def _base_queryset(self):
        queryset = ActivityLog.objects.select_related("hotel", "user").order_by("-created_at", "-id")
        user = self.request.user
        if getattr(user, "is_platform_admin", False):
            return queryset

        queryset = TenantService.scope_queryset_to_hotel(queryset, self.request, field_name="hotel")
        return queryset

    def get_queryset(self):
        queryset = self._base_queryset()
        params = self.request.query_params

        user_id = params.get("user")
        role = params.get("role")
        hotel_id = params.get("hotel")
        module = params.get("module")
        action_name = params.get("action")
        severity = params.get("severity")
        date_start = params.get("date_start")
        date_end = params.get("date_end")
        search = (params.get("search") or "").strip()

        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if role:
            queryset = queryset.filter(user_role=role)
        if hotel_id and getattr(self.request.user, "is_platform_admin", False):
            queryset = queryset.filter(hotel_id=hotel_id)
        if module:
            queryset = queryset.filter(module=module)
        if action_name:
            queryset = queryset.filter(action=action_name)
        if severity:
            queryset = queryset.filter(severity=severity)
        if date_start:
            queryset = queryset.filter(created_at__date__gte=date_start)
        if date_end:
            queryset = queryset.filter(created_at__date__lte=date_end)
        if search:
            queryset = queryset.filter(
                Q(description__icontains=search)
                | Q(object_reference__icontains=search)
                | Q(object_type__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(hotel__name__icontains=search)
            )
        return queryset

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()
        today_queryset = queryset.filter(created_at__date=today)
        sensitive_actions = [
            ActivityLog.Action.CANCEL,
            ActivityLog.Action.REFUND,
            ActivityLog.Action.PERMISSION_CHANGE,
            ActivityLog.Action.PASSWORD_CHANGE,
            ActivityLog.Action.DELETE,
        ]
        payload = {
            "operations_today": today_queryset.count(),
            "logins_today": today_queryset.filter(action=ActivityLog.Action.LOGIN).count(),
            "sensitive_actions": queryset.filter(action__in=sensitive_actions).count(),
            "payments_recorded": queryset.filter(action=ActivityLog.Action.PAYMENT).count(),
            "critical_alerts": queryset.filter(severity__in=[ActivityLog.Severity.DANGER, ActivityLog.Severity.CRITICAL]).count(),
            "by_module": list(queryset.values("module").annotate(count=Count("id")).order_by("-count")[:8]),
            "by_action": list(queryset.values("action").annotate(count=Count("id")).order_by("-count")[:8]),
        }
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="role-permission-history")
    def role_permission_history(self, request):
        queryset = self.get_queryset().filter(
            Q(module__in=["iam", "users"]),
            Q(action=ActivityLog.Action.PERMISSION_CHANGE)
            | Q(metadata__security_event__in=["user_role_changed", "iam_role_created", "iam_role_updated"])
            | Q(metadata__iam_action__in=["assigne", "revoque"]),
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = RolePermissionHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = RolePermissionHistorySerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="security-alerts")
    def security_alerts(self, request):
        queryset = self.get_queryset()
        now = timezone.now()
        recent_24h = queryset.filter(created_at__gte=now - timedelta(hours=24))
        alerts = []

        failed_login_groups = (
            recent_24h.filter(
                module="auth",
                action=ActivityLog.Action.LOGIN,
                severity=ActivityLog.Severity.WARNING,
                metadata__reason__in=["invalid_credentials", "missing_tenant_scope"],
                created_at__gte=now - timedelta(minutes=15),
            )
            .values("object_reference", "ip_address")
            .annotate(count=Count("id"), last_seen=Max("created_at"))
            .filter(count__gte=3)
            .order_by("-count", "-last_seen")
        )
        for item in failed_login_groups[:8]:
            username = item.get("object_reference") or "compte inconnu"
            count = item.get("count") or 0
            severity = "critical" if count >= 5 else "warning"
            alerts.append(
                {
                    "type": "failed_login_burst",
                    "severity": severity,
                    "title": "Tentatives de connexion repetees",
                    "message": f"{count} echec(s) de connexion en 15 minutes pour {username}.",
                    "count": count,
                    "actor_name": "Systeme",
                    "target": username,
                    "ip_address": item.get("ip_address") or "",
                    "user_agent": "",
                    "created_at": item.get("last_seen").isoformat() if item.get("last_seen") else "",
                }
            )

        sensitive_events = recent_24h.filter(
            Q(action__in=[ActivityLog.Action.PERMISSION_CHANGE, ActivityLog.Action.PASSWORD_CHANGE, ActivityLog.Action.DELETE])
            | Q(severity__in=[ActivityLog.Severity.DANGER, ActivityLog.Severity.CRITICAL])
        ).order_by("-created_at", "-id")[:20]

        for log in sensitive_events:
            event_type = log.metadata.get("security_event") or log.metadata.get("iam_action") or log.action.lower()
            severity = "critical" if log.severity in [ActivityLog.Severity.DANGER, ActivityLog.Severity.CRITICAL] else "warning"
            if log.action == ActivityLog.Action.PERMISSION_CHANGE:
                title = "Changement role ou permission"
            elif log.action == ActivityLog.Action.PASSWORD_CHANGE:
                title = "Mot de passe modifie"
            elif log.action == ActivityLog.Action.DELETE:
                title = "Compte desactive"
            else:
                title = log.get_action_display()
            alerts.append(
                {
                    "type": event_type,
                    "severity": severity,
                    "title": title,
                    "message": log.description,
                    "count": 1,
                    "actor_name": log.user.get_full_name() or log.user.username if log.user_id else "Systeme",
                    "target": log.object_reference or log.object_type or "",
                    "ip_address": log.ip_address or "",
                    "user_agent": log.user_agent or "",
                    "created_at": log.created_at.isoformat() if log.created_at else "",
                    "source_log_id": log.id,
                }
            )

        alerts.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        summary = {
            "total": len(alerts),
            "critical": sum(1 for item in alerts if item["severity"] == "critical"),
            "warning": sum(1 for item in alerts if item["severity"] == "warning"),
            "failed_login_bursts": sum(1 for item in alerts if item["type"] == "failed_login_burst"),
            "sensitive_changes_24h": recent_24h.filter(
                action__in=[
                    ActivityLog.Action.PERMISSION_CHANGE,
                    ActivityLog.Action.PASSWORD_CHANGE,
                    ActivityLog.Action.DELETE,
                ]
            ).count(),
        }
        return Response({"summary": summary, "results": alerts[:30]})

    @action(detail=False, methods=["get"], url_path="integrity")
    def integrity(self, request):
        queryset = list(self.get_queryset().order_by("created_at", "id")[:1000])
        total = len(queryset)
        sealed = 0
        invalid = 0
        chain_breaks = 0
        previous_hash = ""
        latest_hash = ""

        for log in queryset:
            if not log.integrity_hash:
                continue
            sealed += 1
            latest_hash = log.integrity_hash
            if not log.verify_integrity():
                invalid += 1
            if log.previous_integrity_hash != previous_hash:
                chain_breaks += 1
            previous_hash = log.integrity_hash

        return Response(
            {
                "total_checked": total,
                "sealed": sealed,
                "unsealed": total - sealed,
                "invalid": invalid,
                "chain_breaks": chain_breaks,
                "latest_hash": latest_hash,
                "status": "valid" if total == sealed and invalid == 0 and chain_breaks == 0 else "warning",
            }
        )
