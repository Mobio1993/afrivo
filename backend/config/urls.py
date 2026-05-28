from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from apps.core.views import DashboardView
from apps.users.views import HotelLoginView, HotelLogoutView


urlpatterns = [
    path("", DashboardView.as_view(), name="home"),
    path("api/", include("apps.core.api_urls")),
    path("api/pos/", include("apps.pos_restaurant.urls")),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/", include("apps.reports.urls")),
    path("login/", HotelLoginView.as_view(), name="login"),
    path("logout/", HotelLogoutView.as_view(), name="logout"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
