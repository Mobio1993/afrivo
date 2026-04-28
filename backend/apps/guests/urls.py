from django.urls import path

from apps.guests.views import client_detail_api, client_history_api, clients_api


urlpatterns = [
    path("", clients_api, name="api-clients"),
    path("<int:client_id>/", client_detail_api, name="api-client-detail"),
    path("<int:client_id>/history/", client_history_api, name="api-client-history"),
]
