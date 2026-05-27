"""Compatibility exports for the IAM domain.

Phase 1 keeps the physical models in apps.users to avoid auth-table and
migration risk. Importing through apps.iam.models is now safe for new code.
"""

from apps.users.models import (  # noqa: F401
    BlacklistedToken,
    IAMPermission,
    IAMRole,
    IAMRolePermission,
    User,
    UserHotelRole,
    UserModulePermission,
    UserOrganizationRole,
    UserPermissionOverride,
    UserSession,
)

__all__ = [
    "BlacklistedToken",
    "IAMPermission",
    "IAMRole",
    "IAMRolePermission",
    "User",
    "UserHotelRole",
    "UserModulePermission",
    "UserOrganizationRole",
    "UserPermissionOverride",
    "UserSession",
]

