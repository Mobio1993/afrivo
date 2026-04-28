from rest_framework.routers import DefaultRouter

from apps.rooms.views import (
    RoomHousekeepingTaskViewSet,
    RoomMaintenanceIncidentViewSet,
    RoomRateRuleViewSet,
    RoomTypeViewSet,
    RoomViewSet,
)


router = DefaultRouter()
router.register("types", RoomTypeViewSet, basename="room-type")
router.register("pricing/rules", RoomRateRuleViewSet, basename="room-rate-rule")
router.register("housekeeping/tasks", RoomHousekeepingTaskViewSet, basename="room-housekeeping-task")
router.register("maintenance/incidents", RoomMaintenanceIncidentViewSet, basename="room-maintenance-incident")
router.register("", RoomViewSet, basename="room")

urlpatterns = router.urls
