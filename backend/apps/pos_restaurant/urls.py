from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    KitchenViewSet,
    MenuCategoryViewSet,
    MenuItemViewSet,
    MenuViewSet,
    OrderViewSet,
    POSServerViewSet,
    PaymentViewSet,
    ReportViewSet,
    ServerPerformanceViewSet,
    ServerRankingViewSet,
    TableViewSet,
    UserPosAccessViewSet,
)

router = DefaultRouter()
router.register(r"tables", TableViewSet, basename="pos-tables")
router.register(r"orders", OrderViewSet, basename="pos-orders")
router.register(r"kitchen", KitchenViewSet, basename="pos-kitchen")
router.register(r"payments", PaymentViewSet, basename="pos-payments")
router.register(r"reports", ReportViewSet, basename="pos-reports")
router.register(r"servers", POSServerViewSet, basename="pos-servers")
router.register(r"server-performance", ServerPerformanceViewSet, basename="pos-server-performance")
router.register(r"server-ranking", ServerRankingViewSet, basename="pos-server-ranking")
router.register(r"menus", MenuViewSet, basename="pos-menus")
router.register(r"menu-items", MenuItemViewSet, basename="pos-menu-items")
router.register(r"categories", MenuCategoryViewSet, basename="pos-categories")
router.register(r"access", UserPosAccessViewSet, basename="pos-access")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "menu-items/<int:pk>/toggle/",
        MenuItemViewSet.as_view({"post": "toggle_disponibilite"}),
        name="pos-menu-item-toggle",
    ),
]
