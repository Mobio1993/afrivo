from rest_framework.routers import DefaultRouter

from apps.history.views import ActivityLogViewSet


router = DefaultRouter()
router.register("activity-logs", ActivityLogViewSet, basename="activity-log")

urlpatterns = router.urls
