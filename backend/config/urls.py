from django.contrib import admin
from django.urls import include, path

from apps.core.views import DashboardView
from apps.users.views import HotelLoginView, HotelLogoutView


urlpatterns = [
    path("", DashboardView.as_view(), name="home"),
    path("api/", include("apps.core.api_urls")),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/", include("apps.reports.urls")),
    path("login/", HotelLoginView.as_view(), name="login"),
    path("logout/", HotelLogoutView.as_view(), name="logout"),
    path("admin/", admin.site.urls),
]
