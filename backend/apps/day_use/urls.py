from django.urls import path

from apps.day_use.views import (
    day_use_availability_api,
    day_use_cancel_api,
    day_use_check_in_api,
    day_use_check_out_api,
    day_use_convert_to_night_api,
    day_use_create_api,
    day_use_dashboard_api,
    day_use_detail_api,
    day_use_extend_api,
    day_use_history_api,
    day_use_list_api,
    day_use_no_show_api,
    day_use_payment_api,
    day_use_receipt_api,
    day_use_stats_api,
    day_use_update_api,
)


urlpatterns = [
    path("", day_use_list_api, name="api-day-use-list"),
    path("availability/", day_use_availability_api, name="api-day-use-availability"),
    path("dashboard/", day_use_dashboard_api, name="api-day-use-dashboard"),
    path("stats/", day_use_stats_api, name="api-day-use-stats"),
    path("<int:day_use_id>/", day_use_detail_api, name="api-day-use-detail-v2"),
    path("<int:day_use_id>/update/", day_use_update_api, name="api-day-use-update"),
    path("create/", day_use_create_api, name="api-day-use-create"),
    path("<int:day_use_id>/check-in/", day_use_check_in_api, name="api-day-use-check-in-v2"),
    path("<int:day_use_id>/check-out/", day_use_check_out_api, name="api-day-use-check-out-v2"),
    path("<int:day_use_id>/cancel/", day_use_cancel_api, name="api-day-use-cancel"),
    path("<int:day_use_id>/no-show/", day_use_no_show_api, name="api-day-use-no-show"),
    path("<int:day_use_id>/extend/", day_use_extend_api, name="api-day-use-extend"),
    path("<int:day_use_id>/convert-to-night/", day_use_convert_to_night_api, name="api-day-use-convert-to-night"),
    path("<int:day_use_id>/history/", day_use_history_api, name="api-day-use-history"),
    path("<int:day_use_id>/payments/", day_use_payment_api, name="api-day-use-payments"),
    path("<int:day_use_id>/receipt/", day_use_receipt_api, name="api-day-use-receipt"),
]
