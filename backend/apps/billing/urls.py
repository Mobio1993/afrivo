from rest_framework.routers import DefaultRouter

from apps.billing.views import ClientInvoiceViewSet, ClientPaymentViewSet


router = DefaultRouter()
router.register("client-invoices", ClientInvoiceViewSet, basename="client-invoice")
router.register("client-payments", ClientPaymentViewSet, basename="client-payment")

urlpatterns = router.urls
