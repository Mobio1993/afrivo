from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.satisfaction.views import AdminClientSatisfactionViewSet, ClientSatisfactionSubmissionApi


router = DefaultRouter()
router.register("admin/satisfaction", AdminClientSatisfactionViewSet, basename="admin-satisfaction")

urlpatterns = [
    path("client/satisfaction/", ClientSatisfactionSubmissionApi.as_view(), name="client-satisfaction-submit"),
]

urlpatterns += router.urls
