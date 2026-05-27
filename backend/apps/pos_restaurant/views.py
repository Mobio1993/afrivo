from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.tenants.services.scope_service import get_request_hotel, is_platform_scope_user

from .audit import pos_audit_logger
from .models import Bill, KitchenTicket, Menu, MenuCategory, MenuItem, Order, OrderItem, POSServer, Payment, Restaurant, Table, UserPosAccess, VoidReason
from .permissions import CanManagePosAccess, HasPosAccess, IsCaissier, IsManager, can_manage_pos_access, get_effective_pos_role
from .serializers import (
    BillSerializer,
    KitchenTicketSerializer,
    MenuCategorySerializer,
    MenuItemSerializer,
    MenuSerializer,
    OrderItemSerializer,
    OrderSerializer,
    POSServerSerializer,
    PaymentSerializer,
    TableSerializer,
    UserPosAccessSerializer,
)
from .services.billing_service import BillingService
from .services.kitchen_service import KitchenService
from .services.order_service import OrderService
from .services.payment_service import PaymentService
from .services.report_service import ReportService
from .services.server_stats_service import ServerStatsService


def scope_to_request_hotel(request, queryset, field_name):
    if is_platform_scope_user(request.user):
        return queryset
    hotel = get_request_hotel(request)
    if hotel is None:
        return queryset.none()
    return queryset.filter(**{field_name: hotel})


def object_matches_request_hotel(request, obj, attr_path):
    if is_platform_scope_user(request.user):
        return True
    hotel = get_request_hotel(request)
    current = obj
    for attr in attr_path.split("__"):
        current = getattr(current, attr, None)
        if current is None:
            return False
    return bool(hotel and getattr(current, "id", None) == hotel.id)


class UserPosAccessViewSet(viewsets.ModelViewSet):
    serializer_class = UserPosAccessSerializer
    permission_classes = [CanManagePosAccess]

    def get_queryset(self):
        queryset = UserPosAccess.objects.select_related(
            "user",
            "organization",
            "hotel",
            "restaurant",
            "created_by",
        )
        if is_platform_scope_user(self.request.user):
            return queryset
        hotel = get_request_hotel(self.request)
        if hotel is not None:
            return queryset.filter(hotel=hotel)
        organization_id = getattr(self.request.user, "organization_id", None)
        if organization_id:
            return queryset.filter(organization_id=organization_id)
        return queryset.none()

    def _can_manage_payload(self, serializer):
        target_user = serializer.validated_data.get("user") or getattr(serializer.instance, "user", None)
        hotel = serializer.validated_data.get("hotel") or getattr(serializer.instance, "hotel", None)
        restaurant = serializer.validated_data.get("restaurant") or getattr(serializer.instance, "restaurant", None)
        return can_manage_pos_access(self.request.user, target_user, hotel=hotel, restaurant=restaurant)

    def perform_create(self, serializer):
        if not self._can_manage_payload(serializer):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Vous ne pouvez pas creer cet acces POS.")
        access = serializer.save(created_by=self.request.user)
        pos_audit_logger.log(
            self.request.user,
            "create_pos_access",
            {"user": access.user.username, "hotel": access.hotel_id, "restaurant": access.restaurant_id, "role": access.pos_role},
        )

    def perform_update(self, serializer):
        if not self._can_manage_payload(serializer):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Vous ne pouvez pas modifier cet acces POS.")
        access = serializer.save()
        pos_audit_logger.log(
            self.request.user,
            "update_pos_access",
            {"user": access.user.username, "hotel": access.hotel_id, "restaurant": access.restaurant_id, "role": access.pos_role},
        )

    def perform_destroy(self, instance):
        if not can_manage_pos_access(self.request.user, instance.user, hotel=instance.hotel, restaurant=instance.restaurant):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Vous ne pouvez pas revoquer cet acces POS.")
        pos_audit_logger.log(
            self.request.user,
            "delete_pos_access",
            {"user": instance.user.username, "hotel": instance.hotel_id, "restaurant": instance.restaurant_id, "role": instance.pos_role},
        )
        instance.delete()


class POSServerViewSet(viewsets.ModelViewSet):
    serializer_class = POSServerSerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = POSServer.objects.select_related(
            "user",
            "restaurant",
            "restaurant__hotel",
            "restaurant__hotel__organization",
        ).prefetch_related("shifts")
        queryset = scope_to_request_hotel(self.request, queryset, "restaurant__hotel")
        role = get_effective_pos_role(self.request.user, self.request)
        if role == "serveur" and not self.request.user.is_staff and not self.request.user.is_superuser:
            queryset = queryset.filter(user=self.request.user)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                first_name__icontains=search
            ) | queryset.filter(last_name__icontains=search) | queryset.filter(code__icontains=search)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        restaurant_id = self.request.query_params.get("restaurant")
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset.distinct()

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "status"]:
            return [IsManager()]
        return [HasPosAccess()]

    def perform_create(self, serializer):
        server = serializer.save()
        pos_audit_logger.log(
            self.request.user,
            "create_pos_server",
            {"server": server.full_name, "restaurant": server.restaurant_id, "status": server.status},
        )

    def perform_update(self, serializer):
        server = serializer.save()
        pos_audit_logger.log(
            self.request.user,
            "update_pos_server",
            {"server": server.full_name, "restaurant": server.restaurant_id, "status": server.status},
        )

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        server = self.get_object()
        next_status = request.data.get("status")
        if next_status not in POSServer.Status.values:
            return Response({"error": "Statut serveur invalide."}, status=status.HTTP_400_BAD_REQUEST)
        server.status = next_status
        server.save(update_fields=["status", "updated_at"])
        pos_audit_logger.log(
            request.user,
            "change_pos_server_status",
            {"server": server.full_name, "restaurant": server.restaurant_id, "status": server.status},
        )
        return Response(POSServerSerializer(server, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def sales(self, request, pk=None):
        server = self.get_object()
        return Response(
            {
                "server": POSServerSerializer(server, context={"request": request}).data,
                "summary": ServerStatsService.stats_for_server(server, request.query_params),
                "orders": ServerStatsService.sales_history(server, request.query_params),
            }
        )

    @action(detail=True, methods=["get"])
    def performance(self, request, pk=None):
        server = self.get_object()
        return Response(ServerStatsService.stats_for_server(server, request.query_params))


class ServerPerformanceViewSet(viewsets.ViewSet):
    permission_classes = [IsManager]

    def _servers(self, request):
        queryset = POSServer.objects.select_related("restaurant", "restaurant__hotel")
        queryset = scope_to_request_hotel(request, queryset, "restaurant__hotel")
        restaurant_id = request.query_params.get("restaurant")
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def list(self, request):
        rows = ServerStatsService.ranked_servers(self._servers(request), request.query_params)
        summary = ServerStatsService.dashboard_summary(self._servers(request), {**request.query_params, "period": request.query_params.get("period", "today")})
        return Response({"results": rows, "summary": summary})


class ServerRankingViewSet(ServerPerformanceViewSet):
    def list(self, request):
        rows = ServerStatsService.ranked_servers(self._servers(request), request.query_params)
        return Response({"results": rows})


class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = Table.objects.select_related("area", "area__restaurant", "area__restaurant__hotel")
        return scope_to_request_hotel(self.request, queryset, "area__restaurant__hotel")

    @action(detail=True, methods=["post"])
    def open_order(self, request, pk=None):
        table = self.get_object()
        if table.statut == Table.Status.OCCUPEE:
            return Response({"error": "Table deja occupee"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = OrderService.create_order(table.pk, request.user, notes=request.data.get("notes", ""))
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        pos_audit_logger.log(request.user, "open_order", {"table": table.numero})
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = Order.objects.select_related("table", "table__area", "table__area__restaurant", "serveur").prefetch_related(
            "items__menu_item"
        )
        return scope_to_request_hotel(self.request, queryset, "table__area__restaurant__hotel")

    def perform_create(self, serializer):
        table = serializer.validated_data.get("table")
        server = serializer.validated_data.get("server")
        if server is None and table is not None:
            server = POSServer.resolve_for_user(self.request.user, table.area.restaurant)
        serializer.save(serveur=self.request.user, server=server)

    @action(detail=True, methods=["post"])
    def add_item(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get("menu_item")
        quantite = int(request.data.get("quantite", 1) or 1)
        notes = request.data.get("notes", "")
        try:
            menu_item = MenuItem.objects.get(pk=item_id)
            if not object_matches_request_hotel(request, menu_item, "category__menu__restaurant__hotel"):
                return Response({"error": "Article hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
            item = OrderService.add_item(order, menu_item, quantite, notes)
        except (MenuItem.DoesNotExist, ValueError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def send_to_kitchen(self, request, pk=None):
        order = self.get_object()
        if not order.items.exclude(statut="annule").exists():
            return Response({"error": "Commande vide"}, status=status.HTTP_400_BAD_REQUEST)
        ticket = OrderService.send_to_kitchen(order)
        pos_audit_logger.log(request.user, "send_kitchen", {"order": order.reference})
        return Response(KitchenTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def void_item(self, request, pk=None):
        order = self.get_object()
        item_id = request.data.get("item_id")
        reason_id = request.data.get("void_reason_id")
        if not reason_id:
            return Response({"error": "Raison obligatoire"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            item = OrderItem.objects.get(pk=item_id, order=order)
            reason = VoidReason.objects.get(pk=reason_id)
            if not object_matches_request_hotel(request, reason, "restaurant__hotel"):
                return Response({"error": "Raison hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
        except (OrderItem.DoesNotExist, VoidReason.DoesNotExist):
            return Response({"error": "Item ou raison introuvable"}, status=status.HTTP_404_NOT_FOUND)
        OrderService.void_item(item, reason, request.user)
        return Response({"status": "annule"})

    @action(detail=True, methods=["post"])
    def generate_bill(self, request, pk=None):
        order = self.get_object()
        discount_id = request.data.get("discount_id")
        tax_id = request.data.get("tax_id")
        from .models import Discount, Tax

        discount = Discount.objects.get(pk=discount_id) if discount_id else None
        tax = Tax.objects.get(pk=tax_id) if tax_id else None
        if discount and not object_matches_request_hotel(request, discount, "restaurant__hotel"):
            return Response({"error": "Remise hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
        if tax and not object_matches_request_hotel(request, tax, "restaurant__hotel"):
            return Response({"error": "Taxe hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
        bill = BillingService.generate_bill(order, discount, tax)
        pos_audit_logger.log(request.user, "generate_bill", {"order": order.reference})
        return Response(BillSerializer(bill).data)


class KitchenViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = KitchenTicketSerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = KitchenTicket.objects.filter(statut__in=["nouveau", "en_prep"]).select_related(
            "order__table",
            "order__table__area__restaurant",
        ).prefetch_related("order__items__menu_item")
        return scope_to_request_hotel(self.request, queryset, "order__table__area__restaurant__hotel")

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        self.get_object()
        ticket = KitchenService.start_ticket(pk, request.user)
        return Response(KitchenTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def ready(self, request, pk=None):
        self.get_object()
        ticket = KitchenService.mark_ready(pk)
        return Response(KitchenTicketSerializer(ticket).data)


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsCaissier]

    def get_queryset(self):
        queryset = Payment.objects.select_related("bill__order__table__area__restaurant", "caissier")
        return scope_to_request_hotel(self.request, queryset, "bill__order__table__area__restaurant__hotel")

    def create(self, request, *args, **kwargs):
        bill_id = request.data.get("bill_id") or request.data.get("bill")
        mode = request.data.get("mode")
        montant = request.data.get("montant", 0)
        sejour_id = request.data.get("sejour_id") or request.data.get("sejour")

        try:
            bill = Bill.objects.select_related("order__table__area__restaurant").get(pk=bill_id)
            if not object_matches_request_hotel(request, bill, "order__table__area__restaurant__hotel"):
                return Response({"error": "Facture hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
            sejour = None
            if sejour_id:
                from apps.stays.models import Stay

                sejour = Stay.objects.get(pk=sejour_id)
                if not object_matches_request_hotel(request, sejour, "hotel"):
                    return Response({"error": "Sejour hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
            payment = PaymentService.process_payment(
                bill,
                mode,
                montant,
                request.user,
                reference_externe=request.data.get("reference_externe", ""),
                sejour=sejour,
            )
        except (Bill.DoesNotExist, ValueError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        pos_audit_logger.log(request.user, "payment", {"bill": bill.reference, "mode": mode, "montant": str(montant)})
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class ReportViewSet(viewsets.ViewSet):
    permission_classes = [IsManager]

    @action(detail=False, methods=["get"])
    def daily(self, request):
        restaurant_id = request.query_params.get("restaurant_id")
        queryset = Restaurant.objects.all()
        queryset = scope_to_request_hotel(request, queryset, "hotel")
        restaurant = queryset.filter(pk=restaurant_id).first() or queryset.first()
        if restaurant is None:
            return Response({"error": "Restaurant introuvable"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReportService.daily_summary(restaurant))


class MenuViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MenuSerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = Menu.objects.filter(actif=True).select_related("restaurant", "restaurant__hotel").prefetch_related(
            "categories__items"
        )
        return scope_to_request_hotel(self.request, queryset, "restaurant__hotel")


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [HasPosAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = MenuItem.objects.select_related("category", "category__menu", "category__menu__restaurant")
        return scope_to_request_hotel(self.request, queryset, "category__menu__restaurant__hotel")

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManager()]
        return [HasPosAccess()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.validated_data.get("category")
        if not object_matches_request_hotel(request, category, "menu__restaurant__hotel"):
            return Response({"error": "Categorie hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
        item = serializer.save()

        from .audit import pos_audit_logger

        pos_audit_logger.log(request.user, "create_menu_item", {"item": item.nom, "has_image": bool(item.image)})
        headers = self.get_success_headers(serializer.data)
        return Response(
            MenuItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        category = serializer.validated_data.get("category")
        if category and not object_matches_request_hotel(request, category, "menu__restaurant__hotel"):
            return Response({"error": "Categorie hors perimetre hotel"}, status=status.HTTP_403_FORBIDDEN)
        item = serializer.save()

        from .audit import pos_audit_logger

        pos_audit_logger.log(request.user, "update_menu_item", {"item": item.nom, "has_image": bool(item.image)})
        return Response(MenuItemSerializer(item, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.image:
            try:
                import os

                if os.path.isfile(instance.image.path):
                    os.remove(instance.image.path)
            except Exception:
                pass
        from .audit import pos_audit_logger

        pos_audit_logger.log(request.user, "delete_menu_item", {"item": instance.nom})
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle_disponibilite(self, request, pk=None):
        item = self.get_object()
        item.disponible = not item.disponible
        item.save(update_fields=["disponible", "updated_at"])
        return Response(MenuItemSerializer(item, context={"request": request}).data)


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    permission_classes = [HasPosAccess]

    def get_queryset(self):
        queryset = MenuCategory.objects.select_related("menu", "menu__restaurant").prefetch_related("items")
        return scope_to_request_hotel(self.request, queryset, "menu__restaurant__hotel")

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManager()]
        return [HasPosAccess()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def _default_menu(self):
        queryset = Menu.objects.select_related("restaurant")
        queryset = scope_to_request_hotel(self.request, queryset, "restaurant__hotel")
        return queryset.filter(actif=True).first() or queryset.first()

    def create(self, request, *args, **kwargs):
        if self._default_menu() is None:
            return Response({"error": "Aucun menu POS actif pour cet hotel"}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(menu=self._default_menu())
