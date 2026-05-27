"""IAM API facade views.

Existing endpoint functions remain implemented in apps.users. This module
re-exports them so routing can migrate without changing behavior.
"""

from apps.users.iam_api_views import (  # noqa: F401
    iam_assign_role_api,
    iam_assignments_api,
    iam_permissions_api,
    iam_revoke_role_api,
    iam_role_create_api,
    iam_role_detail_api,
    iam_roles_api,
)

