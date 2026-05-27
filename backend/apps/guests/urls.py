from django.urls import path

from apps.guests.views import (
    client_archive_api,
    client_consumptions_api,
    client_detail_api,
    client_history_api,
    client_invoices_api,
    client_payments_api,
    client_reactivate_api,
    client_satisfaction_api,
    client_stays_api,
    clients_api,
)


urlpatterns = [
    path("", clients_api, name="api-clients"),
    path("<int:client_id>/", client_detail_api, name="api-client-detail"),
    path("<int:client_id>/archive/", client_archive_api, name="api-client-archive"),
    path("<int:client_id>/reactivate/", client_reactivate_api, name="api-client-reactivate"),
    path("<int:client_id>/history/", client_history_api, name="api-client-history"),
    path("<int:client_id>/stays/", client_stays_api, name="api-client-stays"),
    path("<int:client_id>/payments/", client_payments_api, name="api-client-payments"),
    path("<int:client_id>/invoices/", client_invoices_api, name="api-client-invoices"),
    path("<int:client_id>/consumptions/", client_consumptions_api, name="api-client-consumptions"),
    path("<int:client_id>/satisfaction/", client_satisfaction_api, name="api-client-satisfaction"),
]
