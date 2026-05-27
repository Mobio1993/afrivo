import json

from django.db import transaction
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from apps.audit_logs.models import ActivityLog
from apps.audit_logs.services import AuditLogService
from apps.core.api_responses import api_error, api_success
from apps.iam.models import IAMPermission, IAMRole, IAMRolePermission, User, UserHotelRole, UserOrganizationRole
from apps.iam.services.permission_service import PermissionService
from apps.iam.services.token_service import resolve_api_user
from apps.tenants.hotels.models import Hotel
from apps.tenants.organizations.models import Organization


log_activity = AuditLogService.log_activity


CRITICAL_IAM_ROLES = {User.IamRole.SUPER_ROOT, User.IamRole.SUPER_ADMIN_PLATFORM}


def _parse_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _require_platform_or_root(request):
    user = resolve_api_user(request)
    if user is None:
        return None, api_error(detail="Authentification requise.", http_status=401, code="auth_required")
    if not (getattr(user, "is_platform_admin", False) or getattr(user, "is_super_root", False)):
        return None, api_error(detail="Permission IAM insuffisante.", http_status=403, code="iam_permission_denied")
    if not PermissionService.user_can_access(user, "platform_security", "manage"):
        return None, api_error(detail="Gestion IAM reservee aux administrateurs securite.", http_status=403, code="iam_manage_required")
    request.user = user
    return user, None


def _is_super_root(user):
    return bool(getattr(user, "is_super_root", False))


def _can_manage_role(actor, role_code):
    if role_code == User.IamRole.SUPER_ROOT:
        return _is_super_root(actor)
    if role_code in CRITICAL_IAM_ROLES:
        return _is_super_root(actor)
    return True


def _audit_iam_change(request, *, action, target_user=None, role_code="", scope="", target=None, metadata=None):
    actor = getattr(request, "user", None)
    target_label = getattr(target, "name", "") or str(getattr(target, "pk", "") or "")
    target_id = getattr(target, "pk", "")
    log_activity(
        request=request,
        user=actor,
        hotel=getattr(target_user, "hotel", None) if target_user is not None else None,
        action=ActivityLog.Action.PERMISSION_CHANGE,
        module="iam",
        object_type="User",
        object_id=getattr(target_user, "id", "") or "",
        object_reference=getattr(target_user, "username", "") or "",
        description=f"Role IAM {role_code} {action} pour {getattr(target_user, 'username', '')}.",
        metadata={
            "iam_action": action,
            "role_code": role_code,
            "scope": scope,
            "target_id": target_id,
            "target_label": target_label,
            **(metadata or {}),
        },
    )


def _audit_iam_role_change(request, *, action, role, old_values=None, new_values=None, metadata=None):
    actor = getattr(request, "user", None)
    log_activity(
        request=request,
        user=actor,
        hotel=None,
        action=ActivityLog.Action.PERMISSION_CHANGE,
        module="iam",
        object_type="IAMRole",
        object_id=role.id,
        object_reference=role.code,
        description=f"Role IAM {role.code} {action}.",
        old_values=old_values,
        new_values=new_values,
        severity=ActivityLog.Severity.WARNING if role.code in CRITICAL_IAM_ROLES else ActivityLog.Severity.INFO,
        metadata={
            "security_event": f"iam_role_{action}",
            "role_code": role.code,
            **(metadata or {}),
        },
    )


def _role_payload(role, include_permissions=False):
    payload = {
        "id": role.id,
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "is_active": role.is_active,
    }
    if include_permissions:
        permissions = [
            _permission_payload(role_permission.permission)
            for role_permission in role.role_permissions.select_related("permission").all()
            if role_permission.permission.is_active
        ]
        payload["permissions"] = permissions
        payload["permission_codes"] = [permission["code"] for permission in permissions]
    return payload


def _assignment_payload(assignment, scope):
    user = assignment.user
    target = assignment.hotel if scope == "hotel" else assignment.organization
    return {
        "id": assignment.id,
        "scope": scope,
        "role_code": assignment.role_code,
        "is_active": assignment.is_active,
        "created_at": assignment.created_at.isoformat() if assignment.created_at else "",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.get_full_name() or user.username,
        },
        "target": {
            "id": target.id,
            "name": target.name,
        },
    }


def _permission_payload(permission):
    return {
        "id": permission.id,
        "code": permission.code,
        "module_code": permission.module_code,
        "action": permission.action,
        "description": permission.description,
        "is_active": permission.is_active,
    }


@require_GET
def iam_roles_api(request):
    _, error = _require_platform_or_root(request)
    if error is not None:
        return error
    roles = IAMRole.objects.filter(is_active=True).prefetch_related("role_permissions__permission").order_by("code")
    return api_success(results=[_role_payload(role, include_permissions=True) for role in roles])


@require_GET
def iam_permissions_api(request):
    _, error = _require_platform_or_root(request)
    if error is not None:
        return error
    permissions = IAMPermission.objects.filter(is_active=True).order_by("code")
    return api_success(results=[_permission_payload(permission) for permission in permissions])


@require_POST
def iam_role_create_api(request):
    actor, error = _require_platform_or_root(request)
    if error is not None:
        return error
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    code = str(payload.get("code") or "").strip().upper()
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    permission_codes = payload.get("permission_codes") or []
    if not code or not code.replace("_", "").isalnum():
        return api_error(detail="Code role invalide.", code="invalid_role_code")
    if code in CRITICAL_IAM_ROLES and not _is_super_root(actor):
        return api_error(detail="Seul le Super Root peut creer ou gerer un role IAM critique.", http_status=403, code="critical_role_forbidden")
    if not name:
        return api_error(detail="Le nom du role est requis.", code="role_name_required")
    if IAMRole.objects.filter(code=code).exists():
        return api_error(detail="Ce role existe deja.", code="role_already_exists")

    with transaction.atomic():
        role = IAMRole.objects.create(code=code, name=name, description=description, is_system=False)
        permissions = IAMPermission.objects.filter(code__in=permission_codes, is_active=True)
        IAMRolePermission.objects.bulk_create(
            [IAMRolePermission(role=role, permission=permission) for permission in permissions],
            ignore_conflicts=True,
        )
    role = IAMRole.objects.prefetch_related("role_permissions__permission").get(pk=role.pk)
    _audit_iam_role_change(
        request,
        action="created",
        role=role,
        new_values=_role_payload(role, include_permissions=True),
        metadata={"permission_codes": sorted(permission_codes)},
    )
    return api_success(http_status=201, message="Role IAM cree.", role=_role_payload(role, include_permissions=True))


@require_http_methods(["PATCH"])
def iam_role_detail_api(request, role_id):
    actor, error = _require_platform_or_root(request)
    if error is not None:
        return error
    role = IAMRole.objects.filter(pk=role_id).first()
    if role is None:
        return api_error(detail="Role introuvable.", http_status=404, code="role_not_found")
    if role.code in CRITICAL_IAM_ROLES and not _is_super_root(actor):
        return api_error(detail="Seul le Super Root peut modifier un role IAM critique.", http_status=403, code="critical_role_forbidden")
    old_values = _role_payload(role, include_permissions=True)
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    name = payload.get("name")
    description = payload.get("description")
    is_active = payload.get("is_active")
    permission_codes = payload.get("permission_codes")
    if name is not None:
        cleaned_name = str(name).strip()
        if not cleaned_name:
            return api_error(detail="Le nom du role est requis.", code="role_name_required")
        role.name = cleaned_name
    if description is not None:
        role.description = str(description).strip()
    if is_active is not None:
        role.is_active = bool(is_active)

    with transaction.atomic():
        role.save(update_fields=["name", "description", "is_active", "updated_at"])
        if permission_codes is not None:
            permissions = list(IAMPermission.objects.filter(code__in=permission_codes, is_active=True))
            IAMRolePermission.objects.filter(role=role).delete()
            IAMRolePermission.objects.bulk_create(
                [IAMRolePermission(role=role, permission=permission) for permission in permissions],
                ignore_conflicts=True,
            )
    role = IAMRole.objects.prefetch_related("role_permissions__permission").get(pk=role.pk)
    _audit_iam_role_change(
        request,
        action="updated",
        role=role,
        old_values=old_values,
        new_values=_role_payload(role, include_permissions=True),
        metadata={"permission_codes_updated": permission_codes is not None},
    )
    return api_success(message="Role IAM mis a jour.", role=_role_payload(role, include_permissions=True))


@require_GET
def iam_assignments_api(request):
    _, error = _require_platform_or_root(request)
    if error is not None:
        return error
    organization_roles = UserOrganizationRole.objects.select_related("user", "organization").filter(is_active=True)
    hotel_roles = UserHotelRole.objects.select_related("user", "hotel").filter(is_active=True)
    results = [
        *[_assignment_payload(assignment, "organization") for assignment in organization_roles],
        *[_assignment_payload(assignment, "hotel") for assignment in hotel_roles],
    ]
    results.sort(key=lambda item: (item["user"]["full_name"], item["scope"], item["target"]["name"]))
    return api_success(results=results)


@require_POST
def iam_assign_role_api(request):
    actor, error = _require_platform_or_root(request)
    if error is not None:
        return error
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    user = User.objects.filter(pk=payload.get("user_id")).first()
    role_code = payload.get("role_code")
    organization_id = payload.get("organization_id")
    hotel_id = payload.get("hotel_id")
    if user is None:
        return api_error(detail="Utilisateur introuvable.", http_status=404, code="user_not_found")
    if role_code not in User.IamRole.values:
        return api_error(detail="Role IAM invalide.", code="invalid_role")
    if not _can_manage_role(actor, role_code):
        return api_error(detail="Seul le Super Root peut assigner ce role IAM critique.", http_status=403, code="critical_role_forbidden")
    if hotel_id:
        hotel = Hotel.objects.filter(pk=hotel_id).first()
        if hotel is None:
            return api_error(detail="Hotel introuvable.", http_status=404, code="hotel_not_found")
        if not PermissionService.can_assign_role(actor, user, role_code, hotel):
            return api_error(
                detail="Vous ne pouvez pas assigner un role de niveau egal ou superieur.",
                http_status=403,
                code="role_hierarchy_denied",
            )
        assignment, _ = UserHotelRole.objects.update_or_create(
            user=user,
            hotel=hotel,
            role_code=role_code,
            defaults={"is_active": True},
        )
        _audit_iam_change(request, action="assigne", target_user=user, role_code=role_code, scope="hotel", target=hotel)
        return api_success(message="Role hotel assigne.", assignment_id=assignment.id)
    if organization_id:
        organization = Organization.objects.filter(pk=organization_id).first()
        if organization is None:
            return api_error(detail="Organisation introuvable.", http_status=404, code="organization_not_found")
        if not PermissionService.can_assign_role(actor, user, role_code, organization):
            return api_error(
                detail="Vous ne pouvez pas assigner un role de niveau egal ou superieur.",
                http_status=403,
                code="role_hierarchy_denied",
            )
        assignment, _ = UserOrganizationRole.objects.update_or_create(
            user=user,
            organization=organization,
            role_code=role_code,
            defaults={"is_active": True},
        )
        _audit_iam_change(request, action="assigne", target_user=user, role_code=role_code, scope="organization", target=organization)
        return api_success(message="Role organisation assigne.", assignment_id=assignment.id)
    return api_error(detail="Une organisation ou un hotel est requis.", code="scope_required")


@require_POST
def iam_revoke_role_api(request):
    actor, error = _require_platform_or_root(request)
    if error is not None:
        return error
    payload = _parse_body(request)
    if payload is None:
        return api_error(detail="Requete invalide.", code="invalid_request")

    user_id = payload.get("user_id")
    role_code = payload.get("role_code")
    organization_id = payload.get("organization_id")
    hotel_id = payload.get("hotel_id")
    if role_code not in User.IamRole.values:
        return api_error(detail="Role IAM invalide.", code="invalid_role")
    if not _can_manage_role(actor, role_code):
        return api_error(detail="Seul le Super Root peut revoquer ce role IAM critique.", http_status=403, code="critical_role_forbidden")
    target_user = User.objects.filter(pk=user_id).first()
    if target_user is None:
        return api_error(detail="Utilisateur introuvable.", http_status=404, code="user_not_found")
    if hotel_id:
        hotel = Hotel.objects.filter(pk=hotel_id).first()
        if hotel is None:
            return api_error(detail="Hotel introuvable.", http_status=404, code="hotel_not_found")
        if not PermissionService.can_assign_role(actor, target_user, role_code, hotel):
            return api_error(
                detail="Vous ne pouvez pas revoquer un role de niveau egal ou superieur.",
                http_status=403,
                code="role_hierarchy_denied",
            )
        updated = UserHotelRole.objects.filter(
            user_id=user_id,
            hotel_id=hotel_id,
            role_code=role_code,
            is_active=True,
        ).update(is_active=False)
        target = hotel
        scope = "hotel"
    elif organization_id:
        organization = Organization.objects.filter(pk=organization_id).first()
        if organization is None:
            return api_error(detail="Organisation introuvable.", http_status=404, code="organization_not_found")
        if not PermissionService.can_assign_role(actor, target_user, role_code, organization):
            return api_error(
                detail="Vous ne pouvez pas revoquer un role de niveau egal ou superieur.",
                http_status=403,
                code="role_hierarchy_denied",
            )
        updated = UserOrganizationRole.objects.filter(
            user_id=user_id,
            organization_id=organization_id,
            role_code=role_code,
            is_active=True,
        ).update(is_active=False)
        target = organization
        scope = "organization"
    else:
        return api_error(detail="Une organisation ou un hotel est requis.", code="scope_required")
    if not updated:
        return api_error(detail="Role non trouve.", http_status=404, code="role_assignment_not_found")
    _audit_iam_change(request, action="revoque", target_user=target_user, role_code=role_code, scope=scope, target=target)
    return api_success(message="Role revoque.")
