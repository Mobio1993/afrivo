from django.urls import path

from apps.licensing.api.views import (
    platform_license_detail_api,
    platform_license_renew_api,
    platform_license_suspend_api,
    platform_licenses_api,
    platform_module_access_check_api,
    platform_module_detail_api,
    platform_modules_api,
    platform_subscription_change_plan_api,
    platform_subscription_detail_api,
    platform_subscription_lifecycle_run_api,
    platform_subscription_plan_detail_api,
    platform_subscription_plans_api,
    platform_subscription_renew_api,
    platform_subscriptions_api,
)


urlpatterns = [
    path("subscriptions/", platform_subscriptions_api, name="api-licensing-subscriptions"),
    path("subscriptions/process-lifecycle/", platform_subscription_lifecycle_run_api, name="api-licensing-subscription-lifecycle-run"),
    path("subscriptions/plans/", platform_subscription_plans_api, name="api-licensing-subscription-plans"),
    path("subscriptions/plans/<int:plan_id>/", platform_subscription_plan_detail_api, name="api-licensing-subscription-plan-detail"),
    path("subscriptions/<int:subscription_id>/", platform_subscription_detail_api, name="api-licensing-subscription-detail"),
    path("subscriptions/<int:subscription_id>/renew/", platform_subscription_renew_api, name="api-licensing-subscription-renew"),
    path("subscriptions/<int:subscription_id>/change-plan/", platform_subscription_change_plan_api, name="api-licensing-subscription-change-plan"),
    path("modules/", platform_modules_api, name="api-licensing-modules"),
    path("modules/check-access/", platform_module_access_check_api, name="api-licensing-module-access-check"),
    path("modules/<int:module_id>/", platform_module_detail_api, name="api-licensing-module-detail"),
    path("licenses/", platform_licenses_api, name="api-licensing-licenses"),
    path("licenses/<int:license_id>/", platform_license_detail_api, name="api-licensing-license-detail"),
    path("licenses/<int:license_id>/suspend/", platform_license_suspend_api, name="api-licensing-license-suspend"),
    path("licenses/<int:license_id>/renew/", platform_license_renew_api, name="api-licensing-license-renew"),
]

