from django.db.models import Q
from rest_framework import serializers

from .models import (
    Bill,
    DiningArea,
    Discount,
    KitchenTicket,
    Menu,
    MenuCategory,
    MenuItem,
    Order,
    OrderItem,
    POSServer,
    Payment,
    Restaurant,
    ServerShift,
    Table,
    Tax,
    UserPosAccess,
    VoidReason,
)


class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ["id", "hotel", "nom", "description", "actif", "created_at"]


class UserPosAccessSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.nom", read_only=True)
    pos_role_display = serializers.CharField(source="get_pos_role_display", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    def get_user_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def validate(self, attrs):
        hotel = attrs.get("hotel") or getattr(self.instance, "hotel", None)
        organization = attrs.get("organization") or getattr(self.instance, "organization", None)
        restaurant = attrs.get("restaurant") or getattr(self.instance, "restaurant", None)
        if hotel and organization and hotel.organization_id != organization.id:
            raise serializers.ValidationError({"hotel": "L'hotel doit appartenir a l'organisation selectionnee."})
        if restaurant and hotel and restaurant.hotel_id != hotel.id:
            raise serializers.ValidationError({"restaurant": "Le restaurant doit appartenir a l'hotel selectionne."})
        if hotel and not organization:
            attrs["organization"] = hotel.organization
        if restaurant and not hotel:
            attrs["hotel"] = restaurant.hotel
            attrs["organization"] = restaurant.hotel.organization
        return attrs

    class Meta:
        model = UserPosAccess
        fields = [
            "id",
            "user",
            "user_username",
            "user_full_name",
            "user_email",
            "organization",
            "organization_name",
            "hotel",
            "hotel_name",
            "restaurant",
            "restaurant_name",
            "pos_role",
            "pos_role_display",
            "is_active",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]
        extra_kwargs = {"organization": {"required": False}}


class ServerShiftSerializer(serializers.ModelSerializer):
    server_name = serializers.CharField(source="server.full_name", read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.nom", read_only=True)

    class Meta:
        model = ServerShift
        fields = [
            "id",
            "server",
            "server_name",
            "restaurant",
            "restaurant_name",
            "shift_name",
            "start_time",
            "end_time",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class POSServerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.nom", read_only=True)
    hotel_name = serializers.CharField(source="restaurant.hotel.name", read_only=True)
    organization_name = serializers.CharField(source="restaurant.hotel.organization.name", read_only=True)
    current_shift = serializers.SerializerMethodField()

    def get_current_shift(self, obj):
        shift = obj.shifts.filter(status=ServerShift.Status.OPEN).order_by("-start_time").first()
        return ServerShiftSerializer(shift).data if shift else None

    def validate(self, attrs):
        restaurant = attrs.get("restaurant") or getattr(self.instance, "restaurant", None)
        user = attrs.get("user") or getattr(self.instance, "user", None)
        if user and restaurant and restaurant.hotel_id:
            access_exists = UserPosAccess.objects.filter(
                user=user,
                hotel=restaurant.hotel,
                is_active=True,
            ).filter(Q(restaurant=restaurant) | Q(restaurant__isnull=True)).exists()
            if not access_exists and not getattr(user, "is_staff", False) and not getattr(user, "is_superuser", False):
                raise serializers.ValidationError({"user": "Cet utilisateur n'a pas d'acces POS actif pour ce restaurant."})
        return attrs

    class Meta:
        model = POSServer
        fields = [
            "id",
            "user",
            "user_username",
            "employee_id",
            "restaurant",
            "restaurant_name",
            "hotel_name",
            "organization_name",
            "code",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "status",
            "current_shift",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class DiningAreaSerializer(serializers.ModelSerializer):
    restaurant_nom = serializers.CharField(source="restaurant.nom", read_only=True)

    class Meta:
        model = DiningArea
        fields = ["id", "restaurant", "restaurant_nom", "nom", "capacite", "actif"]


class MenuItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_nom = serializers.CharField(source="category.nom", read_only=True)

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "nom",
            "description",
            "prix",
            "disponible",
            "temps_prep_min",
            "image",
            "image_url",
            "category",
            "category_nom",
            "created_at",
        ]
        extra_kwargs = {
            "image": {"write_only": True, "required": False},
        }


class MenuCategorySerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = ["id", "nom", "ordre", "items"]


class MenuSerializer(serializers.ModelSerializer):
    categories = MenuCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = ["id", "nom", "actif", "categories"]


class TableSerializer(serializers.ModelSerializer):
    area_nom = serializers.CharField(source="area.nom", read_only=True)
    restaurant_nom = serializers.CharField(source="area.restaurant.nom", read_only=True)

    class Meta:
        model = Table
        fields = ["id", "numero", "capacite", "statut", "area_nom", "restaurant_nom", "area"]


class OrderItemSerializer(serializers.ModelSerializer):
    item_nom = serializers.CharField(source="menu_item.nom", read_only=True)
    sous_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item", "item_nom", "quantite", "prix_unitaire", "sous_total", "statut", "notes"]
        read_only_fields = ["prix_unitaire"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_numero = serializers.CharField(source="table.numero", read_only=True)
    server_name = serializers.CharField(source="server.full_name", read_only=True)
    restaurant_id = serializers.IntegerField(source="table.area.restaurant_id", read_only=True)
    serveur_nom = serializers.SerializerMethodField()

    def get_serveur_nom(self, obj):
        return obj.serveur.get_full_name() or obj.serveur.username

    def validate(self, attrs):
        table = attrs.get("table") or getattr(self.instance, "table", None)
        server = attrs.get("server") or getattr(self.instance, "server", None)
        if table and server and server.restaurant_id != table.area.restaurant_id:
            raise serializers.ValidationError({"server": "Le serveur doit appartenir au meme restaurant que la commande."})
        return attrs

    class Meta:
        model = Order
        fields = [
            "id",
            "reference",
            "table",
            "table_numero",
            "restaurant_id",
            "serveur_nom",
            "server",
            "server_name",
            "statut",
            "notes",
            "items",
            "created_at",
        ]
        read_only_fields = ["reference", "serveur_nom"]


class KitchenTicketSerializer(serializers.ModelSerializer):
    order_ref = serializers.CharField(source="order.reference", read_only=True)
    table_num = serializers.CharField(source="order.table.numero", read_only=True)
    items = serializers.SerializerMethodField()

    def get_items(self, obj):
        return OrderItemSerializer(obj.order.items.exclude(statut="annule"), many=True).data

    class Meta:
        model = KitchenTicket
        fields = ["id", "order_ref", "table_num", "statut", "items", "created_at", "started_at", "ready_at"]


class BillSerializer(serializers.ModelSerializer):
    order_ref = serializers.CharField(source="order.reference", read_only=True)

    class Meta:
        model = Bill
        fields = ["id", "reference", "order", "order_ref", "sous_total", "remise_montant", "taxe_montant", "total", "statut"]
        read_only_fields = ["reference"]


class PaymentSerializer(serializers.ModelSerializer):
    bill_ref = serializers.CharField(source="bill.reference", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "reference", "bill", "bill_ref", "mode", "montant", "reference_externe", "sejour", "created_at"]
        read_only_fields = ["reference"]


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = ["id", "restaurant", "nom", "type_remise", "valeur", "permission_requise", "actif"]


class TaxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tax
        fields = ["id", "restaurant", "nom", "taux_pct", "actif"]


class VoidReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoidReason
        fields = ["id", "restaurant", "libelle", "actif"]
