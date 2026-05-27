from rest_framework.routers import DefaultRouter

from apps.rooms.views import (
    EnergyReadingViewSet,
    RoomAlertViewSet,
    RoomHousekeepingTaskViewSet,
    RoomLiveStatusViewSet,
    RoomMaintenanceIncidentViewSet,
    RoomRateRuleViewSet,
    RoomSensorViewSet,
    RoomTypeViewSet,
    RoomViewSet,
    SensorEventViewSet,
)


router = DefaultRouter()
router.register("types", RoomTypeViewSet, basename="room-type")
router.register("pricing/rules", RoomRateRuleViewSet, basename="room-rate-rule")
router.register("housekeeping/tasks", RoomHousekeepingTaskViewSet, basename="room-housekeeping-task")
router.register("maintenance/incidents", RoomMaintenanceIncidentViewSet, basename="room-maintenance-incident")
router.register("live", RoomLiveStatusViewSet, basename="room-live")
router.register("alerts", RoomAlertViewSet, basename="room-alert")
router.register("sensors", RoomSensorViewSet, basename="room-sensor")
router.register("sensor-events", SensorEventViewSet, basename="room-sensor-event")
router.register("energy", EnergyReadingViewSet, basename="room-energy")
router.register("", RoomViewSet, basename="room")

urlpatterns = router.urls
