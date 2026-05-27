from apps.users.access import (
    ACTIONS,
    IAM_ROLE_LABELS,
    MODULES,
    PLATFORM_MODULES,
    ROLE_LEVELS,
    build_user_business_action_set,
    build_user_permission_map,
    can_assign_role,
    can_manage_user,
    can_perform_action,
    get_role_code_level,
    get_user_role_level,
    user_can_access,
)


class PermissionService:
    """Permission facade backed by the current canonical users access module."""

    modules = MODULES
    actions = ACTIONS
    platform_modules = PLATFORM_MODULES
    role_levels = ROLE_LEVELS
    role_labels = IAM_ROLE_LABELS

    build_permission_map = staticmethod(build_user_permission_map)
    build_business_action_set = staticmethod(build_user_business_action_set)
    user_can_access = staticmethod(user_can_access)
    can_perform_action = staticmethod(can_perform_action)
    can_manage_user = staticmethod(can_manage_user)
    can_assign_role = staticmethod(can_assign_role)
    get_user_role_level = staticmethod(get_user_role_level)
    get_role_code_level = staticmethod(get_role_code_level)


__all__ = [
    "PermissionService",
    "ACTIONS",
    "IAM_ROLE_LABELS",
    "MODULES",
    "PLATFORM_MODULES",
    "ROLE_LEVELS",
    "build_user_business_action_set",
    "build_user_permission_map",
    "can_assign_role",
    "can_manage_user",
    "can_perform_action",
    "get_role_code_level",
    "get_user_role_level",
    "user_can_access",
]

