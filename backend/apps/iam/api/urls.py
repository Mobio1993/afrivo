from django.urls import path

from apps.iam.api.views import (
    iam_assign_role_api,
    iam_assignments_api,
    iam_permissions_api,
    iam_revoke_role_api,
    iam_role_create_api,
    iam_role_detail_api,
    iam_roles_api,
)


urlpatterns = [
    path("roles/", iam_roles_api, name="api-iam-roles"),
    path("roles/create/", iam_role_create_api, name="api-iam-role-create"),
    path("roles/<int:role_id>/", iam_role_detail_api, name="api-iam-role-detail"),
    path("permissions/", iam_permissions_api, name="api-iam-permissions"),
    path("assignments/", iam_assignments_api, name="api-iam-assignments"),
    path("assign-role/", iam_assign_role_api, name="api-iam-assign-role"),
    path("revoke-role/", iam_revoke_role_api, name="api-iam-revoke-role"),
]

