from django.urls import path

from apps.users.views import UserViewSet


user_list = UserViewSet.as_view({"get": "list", "post": "create"})
user_detail = UserViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})


urlpatterns = [
    path("", user_list, name="api-users"),
    path("<int:pk>/", user_detail, name="api-user-detail"),
]
