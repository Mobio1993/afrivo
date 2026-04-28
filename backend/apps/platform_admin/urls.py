from django.urls import path

from apps.platform_admin.views import (
    platform_dashboard_api,
    platform_hotel_admin_create_api,
    platform_hotel_detail_api,
    platform_hotel_reactivate_api,
    platform_hotel_suspend_api,
    platform_hotels_api,
    platform_onboarding_bundle_api,
    platform_organizations_api,
    platform_security_review_api,
    platform_security_events_api,
    platform_subscription_change_plan_api,
    platform_subscription_detail_api,
    platform_subscription_lifecycle_run_api,
    platform_subscription_plan_detail_api,
    platform_subscription_plans_api,
    platform_subscription_renew_api,
    platform_subscriptions_api,
    platform_users_api,
)


urlpatterns = [
    path("dashboard/", platform_dashboard_api, name="api-platform-dashboard"),
    path("onboarding/", platform_onboarding_bundle_api, name="api-platform-onboarding"),
    path("organizations/", platform_organizations_api, name="api-platform-organizations"),
    path("hotels/", platform_hotels_api, name="api-platform-hotels"),
    path("hotels/<int:hotel_id>/", platform_hotel_detail_api, name="api-platform-hotel-detail"),
    path("hotels/<int:hotel_id>/admin/", platform_hotel_admin_create_api, name="api-platform-hotel-admin-create"),
    path("hotels/<int:hotel_id>/suspend/", platform_hotel_suspend_api, name="api-platform-hotel-suspend"),
    path("hotels/<int:hotel_id>/reactivate/", platform_hotel_reactivate_api, name="api-platform-hotel-reactivate"),
    path("subscriptions/", platform_subscriptions_api, name="api-platform-subscriptions"),
    path("subscriptions/process-lifecycle/", platform_subscription_lifecycle_run_api, name="api-platform-subscription-lifecycle-run"),
    path("subscriptions/plans/", platform_subscription_plans_api, name="api-platform-subscription-plans"),
    path("subscriptions/plans/<int:plan_id>/", platform_subscription_plan_detail_api, name="api-platform-subscription-plan-detail"),
    path("subscriptions/<int:subscription_id>/", platform_subscription_detail_api, name="api-platform-subscription-detail"),
    path("subscriptions/<int:subscription_id>/renew/", platform_subscription_renew_api, name="api-platform-subscription-renew"),
    path("subscriptions/<int:subscription_id>/change-plan/", platform_subscription_change_plan_api, name="api-platform-subscription-change-plan"),
    path("users/", platform_users_api, name="api-platform-users"),
    path("security-events/", platform_security_events_api, name="api-platform-security-events"),
    path("security-events/review/", platform_security_review_api, name="api-platform-security-review"),
]
