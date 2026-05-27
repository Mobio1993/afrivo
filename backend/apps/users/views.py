from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Count, Q
from django.urls import reverse_lazy
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.audit_logs.models import ActivityLog
from apps.audit_logs.services import AuditLogService
from apps.iam.models import User
from apps.iam.services.permission_service import PermissionService
from apps.users.forms import HotelAuthenticationForm
from apps.users.permissions import UserManagementPermission
from apps.users.serializers import UserSerializer


log_activity = AuditLogService.log_activity


def user_audit_snapshot(user):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
        "is_platform_admin": user.is_platform_admin,
        "platform_role": user.platform_role,
        "organization_id": user.organization_id,
        "hotel_id": user.hotel_id,
    }


class HotelLoginView(LoginView):
    template_name = "auth/login.html"
    authentication_form = HotelAuthenticationForm
    redirect_authenticated_user = True

    def form_valid(self, form):
        response = super().form_valid(form)
        if not form.cleaned_data.get("remember_me"):
            self.request.session.set_expiry(0)
        return response

    def get_success_url(self):
        return self.get_redirect_url() or str(reverse_lazy("dashboard"))


class HotelLogoutView(LogoutView):
    next_page = reverse_lazy("login")


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [UserManagementPermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related("organization", "hotel").order_by("username")

        if getattr(user, "is_superuser", False) or getattr(user, "is_platform_admin", False):
            scoped_queryset = queryset
        elif PermissionService.user_can_access(user, "users", "view"):
            if user.hotel_id:
                scoped_queryset = queryset.filter(hotel=user.hotel)
            elif user.organization_id:
                scoped_queryset = queryset.filter(organization=user.organization)
            else:
                scoped_queryset = queryset
        else:
            scoped_queryset = queryset.filter(pk=user.pk)

        role = self.request.query_params.get("role")
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")

        if role and role != "all":
            scoped_queryset = scoped_queryset.filter(role=role)
        if status_filter == "active":
            scoped_queryset = scoped_queryset.filter(is_active=True)
        elif status_filter == "inactive":
            scoped_queryset = scoped_queryset.filter(is_active=False)
        if search:
            role_values = [
                value
                for value, label in User.Role.choices
                if search.lower() in value.lower() or search.lower() in label.lower()
            ]
            scoped_queryset = scoped_queryset.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(role__icontains=search)
                | Q(role__in=role_values)
                | Q(hotel__name__icontains=search)
            )

        return scoped_queryset.order_by("username")

    def stats(self, request):
        queryset = self.get_queryset()
        role_counts = queryset.values("role").annotate(count=Count("id"))
        return Response(
            {
                "total": queryset.count(),
                "active": queryset.filter(is_active=True).count(),
                "admins": queryset.filter(role=User.Role.ADMIN).count(),
                "by_role": {item["role"]: item["count"] for item in role_counts},
            }
        )

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            request=self.request,
            user=self.request.user,
            hotel=getattr(user, "hotel", None),
            action=ActivityLog.Action.CREATE,
            module="users",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=f"Utilisateur cree : {user.username}.",
            new_values=user_audit_snapshot(user),
            severity=ActivityLog.Severity.INFO,
            metadata={"security_event": "user_created", "target_user_id": user.id},
        )

    def perform_update(self, serializer):
        target = self.get_object()
        old_values = user_audit_snapshot(target)
        user = serializer.save()
        new_values = user_audit_snapshot(user)
        role_changed = old_values.get("role") != new_values.get("role")
        platform_role_changed = old_values.get("platform_role") != new_values.get("platform_role")
        log_activity(
            request=self.request,
            user=self.request.user,
            hotel=getattr(user, "hotel", None),
            action=ActivityLog.Action.PERMISSION_CHANGE if role_changed or platform_role_changed else ActivityLog.Action.UPDATE,
            module="users",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=(
                f"Role utilisateur modifie : {user.username}."
                if role_changed or platform_role_changed
                else f"Utilisateur modifie : {user.username}."
            ),
            old_values=old_values,
            new_values=new_values,
            severity=ActivityLog.Severity.WARNING if role_changed or platform_role_changed else ActivityLog.Severity.INFO,
            metadata={
                "security_event": "user_role_changed" if role_changed or platform_role_changed else "user_updated",
                "target_user_id": user.id,
                "role_changed": role_changed,
                "platform_role_changed": platform_role_changed,
            },
        )

    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get("password")
        if not password or len(password) < 8:
            return Response(
                {"password": ["Mot de passe trop court (min 8 caracteres)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PermissionService.can_manage_user(request.user, user):
            return Response(
                {"detail": "Vous ne pouvez pas reinitialiser un compte de niveau egal ou superieur."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not PermissionService.can_perform_action(request.user, "users.reset_password", strict=True):
            return Response(
                {"detail": "Permission de reinitialisation mot de passe insuffisante."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.set_password(password)
        user.save(update_fields=["password"])
        log_activity(
            request=request,
            user=request.user,
            hotel=getattr(user, "hotel", None),
            action=ActivityLog.Action.PASSWORD_CHANGE,
            module="users",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=f"Mot de passe reinitialise par un administrateur pour {user.username}.",
            severity=ActivityLog.Severity.WARNING,
            metadata={"security_event": "admin_password_reset", "target_user_id": user.id},
        )
        return Response({"detail": "Mot de passe mis a jour."})

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "Un administrateur ne peut pas se desactiver lui-meme depuis cette API."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PermissionService.can_manage_user(request.user, user):
            return Response(
                {"detail": "Vous ne pouvez pas desactiver un compte de niveau egal ou superieur."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not PermissionService.can_perform_action(request.user, "users.deactivate", strict=True):
            return Response(
                {"detail": "Permission de desactivation utilisateur insuffisante."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        log_activity(
            request=request,
            user=request.user,
            hotel=getattr(user, "hotel", None),
            action=ActivityLog.Action.DELETE,
            module="users",
            object_type="User",
            object_id=user.id,
            object_reference=user.username,
            description=f"Utilisateur desactive : {user.username}.",
            old_values={"is_active": True},
            new_values={"is_active": False},
            severity=ActivityLog.Severity.WARNING,
            metadata={"security_event": "user_deactivated", "target_user_id": user.id},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
