from django.urls import path

from apps.users.views import UserViewSet


user_list = UserViewSet.as_view({"get": "list", "post": "create"})
user_detail = UserViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
user_stats = UserViewSet.as_view({"get": "stats"})
user_set_password = UserViewSet.as_view({"post": "set_password"})


urlpatterns = [
    path("stats/", user_stats, name="api-users-stats"),
    path("", user_list, name="api-users"),
    path("<int:pk>/set_password/", user_set_password, name="api-user-set-password"),
    path("<int:pk>/", user_detail, name="api-user-detail"),
]
