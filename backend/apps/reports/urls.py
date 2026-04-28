from django.urls import path

from apps.reports.views import (
    DayUseReportExportView,
    DayUseReportView,
    FinancialReportExportView,
    FinancialReportView,
    OccupancyReportExportView,
    OccupancyReportView,
)


urlpatterns = [
    path("financial/", FinancialReportView.as_view(), name="report-financial"),
    path("financial/export/", FinancialReportExportView.as_view(), name="report-financial-export"),
    path("occupancy/", OccupancyReportView.as_view(), name="report-occupancy"),
    path("occupancy/export/", OccupancyReportExportView.as_view(), name="report-occupancy-export"),
    path("day-use/", DayUseReportView.as_view(), name="report-day-use"),
    path("day-use/export/", DayUseReportExportView.as_view(), name="report-day-use-export"),
]
