from apps.users.models import User


MODULES = (
    "dashboard",
    "clients",
    "rooms",
    "operations",
    "billing",
    "reports",
    "users",
    "satisfaction",
    "platform_organizations",
    "platform_hotels",
    "platform_subscriptions",
    "platform_users",
    "platform_security",
)

ACTIONS = ("view", "create", "update", "delete", "manage")


def _module_permissions(view=False, create=False, update=False, delete=False, manage=False):
    return {
        "view": view,
        "create": create,
        "update": update,
        "delete": delete,
        "manage": manage,
    }


DEFAULT_ROLE_PERMISSIONS = {
    User.Role.ADMIN: {
        "dashboard": _module_permissions(True, True, True, True, True),
        "clients": _module_permissions(True, True, True, True, True),
        "rooms": _module_permissions(True, True, True, True, True),
        "operations": _module_permissions(True, True, True, True, True),
        "billing": _module_permissions(True, True, True, True, True),
        "reports": _module_permissions(True, True, True, True, True),
        "users": _module_permissions(True, True, True, True, True),
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
        "reports": _module_permissions(True),
        "users": _module_permissions(True),
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
        "reports": _module_permissions(True),
        "users": _module_permissions(True),
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
        "reports": _module_permissions(True),
        "users": _module_permissions(True),
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
        "reports": _module_permissions(False),
        "users": _module_permissions(False),
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
        "reports": _module_permissions(True),
        "users": _module_permissions(False),
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


def build_user_permission_map(user):
    permissions = _empty_permission_map()
    role_permissions = DEFAULT_ROLE_PERMISSIONS.get(getattr(user, "role", None), DEFAULT_ROLE_PERMISSIONS[User.Role.RECEPTION])

    for module, actions in role_permissions.items():
        permissions[module] = {**permissions[module], **actions}

    if getattr(user, "is_superuser", False) or getattr(user, "is_platform_admin", False):
        return {module: _module_permissions(True, True, True, True, True) for module in MODULES}

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

    return permissions


def user_can_access(user, module, action="view"):
    permission_map = build_user_permission_map(user)
    module_permissions = permission_map.get(module, {})
    return bool(module_permissions.get(action, False))
