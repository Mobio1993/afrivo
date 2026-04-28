from rest_framework.routers import DefaultRouter

from apps.consumptions.views import ClientConsumptionViewSet, ServiceDepartmentViewSet


router = DefaultRouter()
router.register("service-departments", ServiceDepartmentViewSet, basename="service-department")
router.register("client-consumptions", ClientConsumptionViewSet, basename="client-consumption")

urlpatterns = router.urls

