from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.billing.views import (
    ClientInvoiceViewSet,
    ClientPaymentViewSet,
    billing_dashboard_api,
    client_balance_api,
)


router = DefaultRouter()
router.register("client-invoices", ClientInvoiceViewSet, basename="client-invoice")
router.register("client-payments", ClientPaymentViewSet, basename="client-payment")

urlpatterns = router.urls + [
    path("dashboard/", billing_dashboard_api, name="api-billing-dashboard"),
    path("client/<int:client_id>/balance/", client_balance_api, name="api-client-balance"),
]
