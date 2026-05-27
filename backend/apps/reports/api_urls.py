from django.urls import path

from apps.reports.api_views import (
    assign_default_hotel_report_api,
    day_use_report_api,
    enhanced_report_stats_api,
    financial_report_api,
    occupancy_report_api,
    reports_overview_api,
    tenancy_readiness_report_api,
)


urlpatterns = [
    path("overview/", reports_overview_api, name="api-reports-overview"),
    path("tenancy-readiness/", tenancy_readiness_report_api, name="api-report-tenancy-readiness"),
    path(
        "tenancy-readiness/assign-default-hotel/",
        assign_default_hotel_report_api,
        name="api-report-tenancy-assign-default-hotel",
    ),
    path("financial/", financial_report_api, name="api-report-financial"),
    path("occupancy/", occupancy_report_api, name="api-report-occupancy"),
    path("day-use/", day_use_report_api, name="api-report-day-use"),
    path("enhanced-stats/", enhanced_report_stats_api, name="api-report-enhanced-stats"),
]
