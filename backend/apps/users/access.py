from apps.users.models import User


MODULES = (
    "dashboard",
    "clients",
    "rooms",
    "operations",
    "billing",
    "payments",
    "reports",
    "history",
    "users",
    "settings",
    "satisfaction",
    "platform_organizations",
    "platform_hotels",
    "platform_modules",
    "platform_licenses",
    "platform_subscriptions",
    "platform_users",
    "platform_security",
)

PLATFORM_MODULES = {
    "platform_organizations",
    "platform_hotels",
    "platform_modules",
    "platform_licenses",
    "platform_subscriptions",
    "platform_users",
    "platform_security",
}

ACTIONS = ("view", "create", "update", "delete", "manage")
ROLE_LEVELS = {
    "SUPER_ROOT": 900,
    "SUPER_ADMIN_PLATFORM": 800,
    "PLATFORM_ADMIN": 700,
    "ORGANIZATION_ADMIN": 600,
    "HOTEL_ADMIN": 500,
    "HOTEL_MANAGER": 400,
    "MANAGER": 400,
    "RECEPTIONIST": 300,
    "ACCOUNTANT": 300,
    "RECEPTION": 300,
    "CASHIER": 300,
    "STAFF": 100,
    "HOUSEKEEPING": 100,
    "RESTAURANT": 100,
    "CLIENT": 0,
}
IAM_ROLE_LABELS = {
    "SUPER_ROOT": "Super Root",
    "SUPER_ADMIN_PLATFORM": "Super Admin Plateforme",
    "PLATFORM_ADMIN": "Admin Plateforme",
    "ORGANIZATION_OWNER": "Proprietaire Organisation",
    "ORGANIZATION_ADMIN": "Admin Organisation",
    "HOTEL_ADMIN": "Admin Hotel",
    "HOTEL_MANAGER": "Manager Hotel",
    "RECEPTIONIST": "Receptionniste",
    "ACCOUNTANT": "Comptable",
    "STAFF": "Personnel",
    "HOUSEKEEPING": "Housekeeping",
    "CLIENT": "Client",
}
LEGACY_ROLE_TO_IAM_ROLE = {
    User.Role.ADMIN: "HOTEL_ADMIN",
    User.Role.MANAGER: "HOTEL_MANAGER",
    User.Role.RECEPTION: "RECEPTIONIST",
    User.Role.CASHIER: "ACCOUNTANT",
    User.Role.HOUSEKEEPING: "STAFF",
    User.Role.RESTAURANT: "STAFF",
}
DEFAULT_IAM_ROLE_PERMISSION_CODES = {
    "SUPER_ROOT": ("*.*",),
    "SUPER_ADMIN_PLATFORM": ("*.*",),
    "PLATFORM_ADMIN": (
        "platform_organizations.read",
        "platform_organizations.create",
        "platform_organizations.update",
        "platform_hotels.read",
        "platform_hotels.create",
        "platform_hotels.update",
        "platform_modules.read",
        "platform_licenses.read",
        "platform_subscriptions.read",
        "platform_subscriptions.create",
        "platform_subscriptions.update",
        "platform_users.read",
        "platform_security.read",
    ),
    "ORGANIZATION_ADMIN": (
        "dashboard.read",
        "clients.read",
        "rooms.read",
        "operations.read",
        "billing.read",
        "payments.read",
        "reports.read",
        "users.read",
        "users.create",
        "users.update",
        "settings.read",
        "settings.update",
    ),
    "HOTEL_ADMIN": (
        "dashboard.read",
        "clients.manage",
        "rooms.manage",
        "rooms.block",
        "rooms.unblock",
        "rooms.maintenance",
        "rooms.cleaning_complete",
        "operations.manage",
        "operations.check_in",
        "operations.check_out",
        "operations.cancel",
        "operations.no_show",
        "operations.relocate",
        "dayuse.check_in",
        "dayuse.check_out",
        "dayuse.cancel",
        "billing.manage",
        "billing.issue_invoice",
        "billing.cancel_invoice",
        "billing.validate_invoice",
        "payments.manage",
        "payments.record",
        "payments.correct",
        "payments.refund",
        "payments.cancel",
        "reports.manage",
        "reports.view_financial",
        "reports.view_occupancy",
        "reports.view_dayuse",
        "reports.export",
        "history.manage",
        "users.manage",
        "users.change_role",
        "users.reset_password",
        "users.deactivate",
        "settings.manage",
        "settings.update_hotel",
        "settings.update_security",
        "settings.update_modules",
        "satisfaction.manage",
        "housekeeping.assign",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
        "maintenance.create",
        "maintenance.resolve",
    ),
    "HOTEL_MANAGER": (
        "dashboard.read",
        "clients.read",
        "clients.create",
        "clients.update",
        "rooms.manage",
        "rooms.block",
        "rooms.unblock",
        "rooms.maintenance",
        "rooms.cleaning_complete",
        "operations.manage",
        "operations.check_in",
        "operations.check_out",
        "operations.cancel",
        "operations.no_show",
        "operations.relocate",
        "dayuse.check_in",
        "dayuse.check_out",
        "dayuse.cancel",
        "billing.read",
        "payments.read",
        "payments.record",
        "reports.read",
        "reports.view_occupancy",
        "reports.view_dayuse",
        "satisfaction.read",
        "settings.update_hotel",
        "housekeeping.assign",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
        "maintenance.create",
        "maintenance.resolve",
    ),
    "RECEPTIONIST": (
        "dashboard.read",
        "clients.read",
        "clients.create",
        "clients.update",
        "rooms.read",
        "rooms.cleaning_complete",
        "operations.read",
        "operations.create",
        "operations.update",
        "operations.check_in",
        "operations.check_out",
        "operations.relocate",
        "dayuse.check_in",
        "dayuse.check_out",
        "payments.read",
        "payments.create",
        "payments.update",
        "payments.record",
        "reports.read",
        "reports.view_occupancy",
        "reports.view_dayuse",
        "satisfaction.read",
    ),
    "ACCOUNTANT": (
        "dashboard.read",
        "clients.read",
        "rooms.read",
        "operations.read",
        "billing.read",
        "billing.create",
        "billing.update",
        "billing.issue_invoice",
        "billing.cancel_invoice",
        "billing.validate_invoice",
        "payments.read",
        "payments.create",
        "payments.update",
        "payments.record",
        "payments.correct",
        "payments.refund",
        "payments.cancel",
        "reports.read",
        "reports.view_financial",
        "reports.export",
    ),
    "STAFF": (
        "dashboard.read",
        "rooms.read",
        "rooms.update",
        "rooms.cleaning_complete",
        "operations.read",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
    ),
    "HOUSEKEEPING": (
        "dashboard.read",
        "rooms.read",
        "rooms.update",
        "rooms.cleaning_complete",
        "operations.read",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
    ),
}
IAM_MODULE_ALIASES = {
    "dayuse": "operations",
    "day_use": "operations",
    "day-use": "operations",
    "reservations": "operations",
    "bookings": "operations",
    "guests": "clients",
    "licenses": "platform_licenses",
    "hotels": "platform_hotels",
    "modules": "platform_modules",
}
IAM_ACTION_ALIASES = {
    "read": "view",
    "write": "update",
}

BUSINESS_ACTION_FALLBACKS = {
    "rooms.block": ("rooms", "manage"),
    "rooms.unblock": ("rooms", "manage"),
    "rooms.maintenance": ("rooms", "manage"),
    "rooms.cleaning_complete": ("rooms", "update"),
    "operations.check_in": ("operations", "update"),
    "operations.check_out": ("operations", "update"),
    "operations.cancel": ("operations", "update"),
    "operations.no_show": ("operations", "update"),
    "operations.relocate": ("operations", "update"),
    "dayuse.check_in": ("operations", "update"),
    "dayuse.check_out": ("operations", "update"),
    "dayuse.cancel": ("operations", "update"),
    "payments.record": ("payments", "create"),
    "payments.correct": ("payments", "update"),
    "payments.refund": ("payments", "update"),
    "payments.cancel": ("payments", "update"),
    "billing.issue_invoice": ("billing", "update"),
    "billing.cancel_invoice": ("billing", "delete"),
    "billing.validate_invoice": ("billing", "update"),
    "reports.view_financial": ("reports", "view"),
    "reports.view_occupancy": ("reports", "view"),
    "reports.view_dayuse": ("reports", "view"),
    "reports.export": ("reports", "manage"),
    "housekeeping.assign": ("rooms", "update"),
    "housekeeping.start": ("rooms", "update"),
    "housekeeping.complete": ("rooms", "update"),
    "housekeeping.report_problem": ("rooms", "update"),
    "maintenance.create": ("rooms", "update"),
    "maintenance.resolve": ("rooms", "update"),
    "settings.update_hotel": ("settings", "update"),
    "settings.update_security": ("settings", "manage"),
    "settings.update_modules": ("settings", "manage"),
    "users.change_role": ("users", "update"),
    "users.reset_password": ("users", "manage"),
    "users.deactivate": ("users", "delete"),
}


def _module_permissions(view=False, create=False, update=False, delete=False, manage=False):
    return {
        "view": view,
        "create": create,
        "update": update,
        "delete": delete,
        "manage": manage,
    }


PLATFORM_ADMIN_DEFAULT_PERMISSIONS = {
    "platform_organizations": _module_permissions(True, True, True),
    "platform_hotels": _module_permissions(True, True, True),
    "platform_modules": _module_permissions(True),
    "platform_licenses": _module_permissions(True),
    "platform_subscriptions": _module_permissions(True, True, True),
    "platform_users": _module_permissions(True),
    "platform_security": _module_permissions(True),
}


DEFAULT_ROLE_PERMISSIONS = {
    User.Role.ADMIN: {
        "dashboard": _module_permissions(True, True, True, True, True),
        "clients": _module_permissions(True, True, True, True, True),
        "rooms": _module_permissions(True, True, True, True, True),
        "operations": _module_permissions(True, True, True, True, True),
        "billing": _module_permissions(True, True, True, True, True),
        "payments": _module_permissions(True, True, True, True, True),
        "reports": _module_permissions(True, True, True, True, True),
        "history": _module_permissions(True, False, False, False, True),
        "users": _module_permissions(True, True, True, True, True),
        "settings": _module_permissions(True, False, True, False, True),
        "satisfaction": _module_permissions(True, True, True, True, True),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
    User.Role.MANAGER: {
        "dashboard": _module_permissions(True),
        "clients": _module_permissions(True, True, True),
        "rooms": _module_permissions(True, True, True, manage=True),
        "operations": _module_permissions(True, True, True, manage=True),
        "billing": _module_permissions(True),
        "payments": _module_permissions(True),
        "reports": _module_permissions(True),
        "history": _module_permissions(),
        "users": _module_permissions(),
        "settings": _module_permissions(),
        "satisfaction": _module_permissions(True),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
    User.Role.RECEPTION: {
        "dashboard": _module_permissions(True),
        "clients": _module_permissions(True, True, True),
        "rooms": _module_permissions(True),
        "operations": _module_permissions(True, True, True),
        "billing": _module_permissions(True),
        "payments": _module_permissions(True, True, True),
        "reports": _module_permissions(True),
        "history": _module_permissions(),
        "users": _module_permissions(),
        "settings": _module_permissions(),
        "satisfaction": _module_permissions(True),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
    User.Role.CASHIER: {
        "dashboard": _module_permissions(True),
        "clients": _module_permissions(True),
        "rooms": _module_permissions(True),
        "operations": _module_permissions(True),
        "billing": _module_permissions(True, True, True),
        "payments": _module_permissions(True, True, True),
        "reports": _module_permissions(True),
        "history": _module_permissions(),
        "users": _module_permissions(),
        "settings": _module_permissions(),
        "satisfaction": _module_permissions(True),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
    User.Role.HOUSEKEEPING: {
        "dashboard": _module_permissions(True),
        "clients": _module_permissions(False),
        "rooms": _module_permissions(True, True, True),
        "operations": _module_permissions(True, True, True),
        "billing": _module_permissions(False),
        "payments": _module_permissions(False),
        "reports": _module_permissions(False),
        "history": _module_permissions(False),
        "users": _module_permissions(False),
        "settings": _module_permissions(False),
        "satisfaction": _module_permissions(False),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
    User.Role.RESTAURANT: {
        "dashboard": _module_permissions(True),
        "clients": _module_permissions(True),
        "rooms": _module_permissions(True),
        "operations": _module_permissions(True),
        "billing": _module_permissions(True),
        "payments": _module_permissions(True, True, True),
        "reports": _module_permissions(True),
        "history": _module_permissions(False),
        "users": _module_permissions(False),
        "settings": _module_permissions(False),
        "satisfaction": _module_permissions(True),
        "platform_organizations": _module_permissions(),
        "platform_hotels": _module_permissions(),
        "platform_subscriptions": _module_permissions(),
        "platform_users": _module_permissions(),
        "platform_security": _module_permissions(),
    },
}


def _empty_permission_map():
    return {module: _module_permissions() for module in MODULES}


def _normalize_permission_code(code):
    if code == "*.*":
        return "*", "*"
    if not code or "." not in code:
        return None, None
    module, action = code.split(".", 1)
    module = IAM_MODULE_ALIASES.get(module, module)
    action = IAM_ACTION_ALIASES.get(action, action)
    if module not in MODULES or action not in ACTIONS:
        return None, None
    return module, action


def _normalize_business_action_code(code):
    if code == "*.*":
        return "*.*"
    if not code or "." not in code:
        return None
    module, action = code.split(".", 1)
    module = {
        "day_use": "dayuse",
        "day-use": "dayuse",
    }.get(module, module)
    return f"{module}.{action}"


def _apply_permission_code(permissions, code, allowed=True):
    module, action = _normalize_permission_code(code)
    if not module or not action:
        return set()
    if module == "*" and action == "*":
        for module_key in MODULES:
            permissions[module_key] = _module_permissions(True, True, True, True, True)
        return set(MODULES)
    if action == "manage" and allowed:
        permissions[module] = _module_permissions(True, True, True, True, True)
        return {module}
    permissions[module][action] = bool(allowed)
    if action in {"create", "update", "delete", "manage"} and allowed:
        permissions[module]["view"] = True
    return {module}


def _iter_default_iam_role_codes(user):
    if getattr(user, "is_super_root", False):
        yield "SUPER_ROOT"
        return
    if getattr(user, "is_platform_admin", False):
        if getattr(user, "platform_role", "") == User.PlatformRole.SUPER_ADMIN:
            yield "SUPER_ADMIN_PLATFORM"
        else:
            yield "PLATFORM_ADMIN"
        return
    if getattr(user, "is_organization_admin", False):
        yield "ORGANIZATION_ADMIN"
    if getattr(user, "is_hotel_admin", False):
        yield "HOTEL_ADMIN"
    elif getattr(user, "role", None) in LEGACY_ROLE_TO_IAM_ROLE:
        yield LEGACY_ROLE_TO_IAM_ROLE[getattr(user, "role")]


def _default_iam_permission_map(user):
    permissions = _empty_permission_map()
    covered_modules = set()
    for role_code in _iter_default_iam_role_codes(user):
        for permission_code in DEFAULT_IAM_ROLE_PERMISSION_CODES.get(role_code, ()):
            covered_modules.update(_apply_permission_code(permissions, permission_code, allowed=True))
    return permissions, covered_modules


def _merge_permissions_for_uncovered_modules(base, fallback, covered_modules):
    for module, actions in fallback.items():
        if module not in covered_modules and module in base:
            base[module] = {**base[module], **actions}
    return base


def _normalize_iam_permission(permission):
    module = IAM_MODULE_ALIASES.get(permission.module_code, permission.module_code)
    action = IAM_ACTION_ALIASES.get(permission.action, permission.action)
    if module not in MODULES or action not in ACTIONS:
        return None, None
    return module, action


def _apply_iam_permission(permissions, permission, allowed=True):
    module, action = _normalize_iam_permission(permission)
    if not module or not action:
        return
    if action == "manage" and allowed:
        permissions[module] = _module_permissions(True, True, True, True, True)
        return
    permissions[module][action] = bool(allowed)
    if action in {"create", "update", "delete", "manage"} and allowed:
        permissions[module]["view"] = True


def _iter_active_iam_role_permissions(user):
    role_codes = set()
    if getattr(user, "is_superuser", False):
        role_codes.add(User.IamRole.SUPER_ROOT)
    if getattr(user, "is_platform_admin", False):
        if getattr(user, "platform_role", "") == User.PlatformRole.SUPER_ADMIN:
            role_codes.add(User.IamRole.SUPER_ADMIN_PLATFORM)
        elif getattr(user, "platform_role", "") == User.PlatformRole.PLATFORM_ADMIN:
            role_codes.add(User.IamRole.PLATFORM_ADMIN)
    if getattr(user, "organization_id", None):
        role_codes.update(
            user.organization_roles.filter(is_active=True).values_list("role_code", flat=True)
        )
    if getattr(user, "hotel_id", None):
        role_codes.update(user.hotel_roles.filter(is_active=True).values_list("role_code", flat=True))
    if getattr(user, "is_hotel_admin", False):
        role_codes.add(User.IamRole.HOTEL_ADMIN)

    if not role_codes:
        return []

    from apps.users.models import IAMRolePermission  # noqa: PLC0415

    return IAMRolePermission.objects.select_related("permission", "role").filter(
        role__code__in=role_codes,
        role__is_active=True,
        permission__is_active=True,
    )


def build_user_business_action_set(user):
    if not user:
        return set()
    if getattr(user, "is_superuser", False):
        return {"*.*"}

    permissions = set()
    for role_code in _iter_default_iam_role_codes(user):
        permissions.update(DEFAULT_IAM_ROLE_PERMISSION_CODES.get(role_code, ()))

    for role_permission in _iter_active_iam_role_permissions(user):
        permissions.add(role_permission.permission.code)

    user_overrides = getattr(user, "iam_permission_overrides", None)
    if user_overrides is not None:
        for override in user_overrides.select_related("permission").all():
            code = override.permission.code
            if override.is_allowed:
                permissions.add(code)
            else:
                permissions.discard(code)

    normalized = set()
    for code in permissions:
        normalized_code = _normalize_business_action_code(code)
        if normalized_code:
            normalized.add(normalized_code)
    return normalized


def build_user_permission_map(user):
    role_permissions = DEFAULT_ROLE_PERMISSIONS.get(getattr(user, "role", None), DEFAULT_ROLE_PERMISSIONS[User.Role.RECEPTION])

    if getattr(user, "is_superuser", False):
        return {module: _module_permissions(True, True, True, True, True) for module in MODULES}

    permissions, canonical_modules = _default_iam_permission_map(user)
    permissions = _merge_permissions_for_uncovered_modules(permissions, role_permissions, canonical_modules)

    if not getattr(user, "is_platform_admin", False):
        related_permissions = getattr(user, "module_permissions", None)
        if related_permissions is not None:
            for override in related_permissions.all():
                if override.module_code not in permissions:
                    continue
                permissions[override.module_code] = {
                    "view": override.can_view,
                    "create": override.can_create,
                    "update": override.can_update,
                    "delete": override.can_delete,
                    "manage": override.can_manage,
                }

        if getattr(user, "role", None) != User.Role.ADMIN:
            permissions["history"] = _module_permissions()
            permissions["users"] = _module_permissions()
            permissions["settings"] = _module_permissions()

    for role_permission in _iter_active_iam_role_permissions(user):
        _apply_iam_permission(permissions, role_permission.permission, allowed=True)

    user_overrides = getattr(user, "iam_permission_overrides", None)
    if user_overrides is not None:
        for override in user_overrides.select_related("permission").all():
            _apply_iam_permission(permissions, override.permission, allowed=override.is_allowed)

    return permissions


def user_can_access(user, module, action="view"):
    permission_map = build_user_permission_map(user)
    module_permissions = permission_map.get(module, {})
    return bool(module_permissions.get(action, False))


def can_perform_action(user, action_code, *, strict=True):
    normalized_action = _normalize_business_action_code(action_code)
    if not normalized_action:
        return False
    if getattr(user, "is_superuser", False):
        return True

    action_set = build_user_business_action_set(user)
    if "*.*" in action_set or normalized_action in action_set:
        return True

    module = normalized_action.split(".", 1)[0]
    if f"{module}.manage" in action_set:
        return True

    fallback = BUSINESS_ACTION_FALLBACKS.get(normalized_action)
    if fallback and user_can_access(user, fallback[0], "manage"):
        return True
    if fallback and not strict:
        return user_can_access(user, fallback[0], fallback[1])
    return False


def _iter_user_role_codes(user):
    if not user:
        return
    if getattr(user, "is_super_root", False):
        yield "SUPER_ROOT"
    if getattr(user, "is_platform_admin", False):
        if getattr(user, "platform_role", "") == User.PlatformRole.SUPER_ADMIN:
            yield "SUPER_ADMIN_PLATFORM"
        elif getattr(user, "platform_role", "") == User.PlatformRole.PLATFORM_ADMIN:
            yield "PLATFORM_ADMIN"
        else:
            yield "PLATFORM_ADMIN"
        return
    if getattr(user, "is_organization_admin", False):
        yield "ORGANIZATION_ADMIN"
    if getattr(user, "is_hotel_admin", False):
        yield "HOTEL_ADMIN"

    legacy_role = str(getattr(user, "role", "") or "").upper()
    if legacy_role == "ADMIN":
        if getattr(user, "organization_id", None) and not getattr(user, "hotel_id", None):
            yield "ORGANIZATION_ADMIN"
        else:
            yield "HOTEL_ADMIN"
    else:
        mapped_role = LEGACY_ROLE_TO_IAM_ROLE.get(getattr(user, "role", None))
        if mapped_role:
            yield mapped_role

    organization_roles = getattr(user, "organization_roles", None)
    if organization_roles is not None and getattr(user, "pk", None):
        yield from organization_roles.filter(is_active=True).values_list("role_code", flat=True)

    hotel_roles = getattr(user, "hotel_roles", None)
    if hotel_roles is not None and getattr(user, "pk", None):
        yield from hotel_roles.filter(is_active=True).values_list("role_code", flat=True)


def get_user_role_level(user):
    levels = [ROLE_LEVELS.get(str(code).upper(), 0) for code in _iter_user_role_codes(user) or []]
    return max(levels, default=0)


def get_role_code_level(role_code):
    return ROLE_LEVELS.get(str(role_code or "").upper(), 0)


def _same_or_allowed_scope(actor, target):
    if getattr(actor, "is_super_root", False):
        return True
    if getattr(actor, "is_platform_admin", False):
        return not getattr(target, "is_super_root", False)
    if getattr(actor, "organization_id", None) and not getattr(actor, "hotel_id", None):
        return (
            not getattr(target, "is_platform_admin", False)
            and getattr(target, "organization_id", None) == getattr(actor, "organization_id", None)
        )
    if getattr(actor, "hotel_id", None):
        return (
            not getattr(target, "is_platform_admin", False)
            and getattr(target, "hotel_id", None) == getattr(actor, "hotel_id", None)
        )
    return False


def can_manage_user(actor, target):
    if not actor or not target:
        return False
    if getattr(actor, "pk", None) and getattr(actor, "pk", None) == getattr(target, "pk", None):
        return False
    if not _same_or_allowed_scope(actor, target):
        return False
    return get_user_role_level(actor) > get_user_role_level(target)


def _can_use_scope(actor, target):
    if getattr(actor, "is_super_root", False) or getattr(actor, "is_platform_admin", False):
        return True
    target_org_id = getattr(target, "organization_id", None)
    target_hotel_id = getattr(target, "id", None) if target.__class__.__name__ == "Hotel" else None
    if getattr(actor, "organization_id", None) and not getattr(actor, "hotel_id", None):
        if target_org_id:
            return target_org_id == actor.organization_id
        return getattr(target, "id", None) == actor.organization_id
    if getattr(actor, "hotel_id", None):
        return bool(target_hotel_id and target_hotel_id == actor.hotel_id)
    return False


def can_assign_role(actor, target_user, role_code, target):
    if not can_manage_user(actor, target_user):
        return False
    if not _can_use_scope(actor, target):
        return False
    return get_user_role_level(actor) > get_role_code_level(role_code)
