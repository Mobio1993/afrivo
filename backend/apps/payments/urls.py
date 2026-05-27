from rest_framework.routers import DefaultRouter

from apps.payments.views import PaymentViewSet


router = DefaultRouter()
router.register("", PaymentViewSet, basename="payment")

urlpatterns = router.urls
