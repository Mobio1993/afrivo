from django.db import transaction
from rest_framework import serializers

from apps.consumptions.models import ClientConsumption, ClientConsumptionItem, ServiceDepartment
from apps.tenants.services.tenant_service import TenantService

validate_objects_belong_to_hotel = TenantService.validate_objects_belong_to_hotel


class ServiceDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceDepartment
        fields = [
            "id",
            "code",
            "name",
            "department_type",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class ClientConsumptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientConsumptionItem
        fields = [
            "id",
            "label",
            "description",
            "quantity",
            "unit_price",
            "total_amount",
            "sort_order",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["total_amount", "created_at", "updated_at"]


class ClientConsumptionSerializer(serializers.ModelSerializer):
    items = ClientConsumptionItemSerializer(many=True, required=False)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    stay_reference = serializers.CharField(source="stay.reference", read_only=True)
    reservation_reference = serializers.CharField(source="reservation.reference", read_only=True)
    room_number = serializers.CharField(source="room.number", read_only=True)
    service_department_name = serializers.CharField(source="service_department.name", read_only=True)
    service_code = serializers.CharField(source="service_department.code", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_billed = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()

    class Meta:
        model = ClientConsumption
        fields = [
            "id",
            "reference",
            "client",
            "client_name",
            "stay",
            "stay_reference",
            "reservation",
            "reservation_reference",
            "room",
            "room_number",
            "service_department",
            "service_department_name",
            "service_code",
            "label",
            "description",
            "quantity",
            "unit_price",
            "total_amount",
            "service_date",
            "consumed_at",
            "status",
            "payment_status",
            "source",
            "billing_reference",
            "billed_at",
            "tenant_code",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "items",
            "service",
            "is_billed",
            "is_paid",
        ]
        read_only_fields = [
            "reference",
            "total_amount",
            "billed_at",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "reservation_reference",
            "room_number",
            "service_code",
            "service",
            "consumed_at",
            "is_billed",
            "is_paid",
        ]

    def to_internal_value(self, data):
        payload = data.copy()
        if "consumed_at" in payload and "service_date" not in payload:
            payload["service_date"] = payload.get("consumed_at")
        if "service" in payload and "service_department" not in payload:
            payload["service_department"] = payload.get("service")
        return super().to_internal_value(payload)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["consumed_at"] = representation.get("service_date")
        representation["service"] = instance.service_department_id
        return representation

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def get_is_billed(self, obj):
        return obj.is_billed

    def get_is_paid(self, obj):
        return obj.is_paid

    def validate(self, attrs):
        client = attrs.get("client") or getattr(self.instance, "client", None)
        stay = attrs.get("stay") if "stay" in attrs else getattr(self.instance, "stay", None)
        reservation = attrs.get("reservation") if "reservation" in attrs else getattr(self.instance, "reservation", None)
        room = attrs.get("room") if "room" in attrs else getattr(self.instance, "room", None)
        status = attrs.get("status") or getattr(self.instance, "status", ClientConsumption.Status.DRAFT)
        billing_reference = attrs.get("billing_reference")
        request = self.context.get("request")
        active_hotel = getattr(request, "active_hotel", None) if request else None
        effective_hotel = getattr(self.instance, "hotel", None) or active_hotel
        if billing_reference is None and self.instance is not None:
            billing_reference = self.instance.billing_reference

        if effective_hotel is not None:
            validate_objects_belong_to_hotel(
                effective_hotel,
                client=client,
                stay=stay,
                reservation=reservation,
                room=room,
            )

        if stay and client and stay.guest_id != client.id:
            raise serializers.ValidationError({"stay": "Le sejour selectionne doit appartenir au meme client."})

        if reservation and client and reservation.guest_id != client.id:
            raise serializers.ValidationError({"reservation": "La reservation selectionnee doit appartenir au meme client."})

        if stay and reservation and stay.booking_id and stay.booking_id != reservation.id:
            raise serializers.ValidationError({"reservation": "La reservation ne correspond pas au sejour selectionne."})

        if stay and room and stay.room_id != room.id:
            raise serializers.ValidationError({"room": "La chambre doit correspondre a celle du sejour selectionne."})

        if reservation and room and reservation.room_id and reservation.room_id != room.id:
            raise serializers.ValidationError({"room": "La chambre doit correspondre a celle de la reservation selectionnee."})

        if status == ClientConsumption.Status.BILLED and not (billing_reference or "").strip():
            raise serializers.ValidationError(
                {"billing_reference": "Une reference de facturation est requise pour une consommation facturee."}
            )

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        with transaction.atomic():
            consumption = ClientConsumption.objects.create(**validated_data)
            self._replace_items(consumption, items_data)
            consumption.refresh_from_db()
        return consumption

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        if instance.status == ClientConsumption.Status.BILLED:
            immutable_fields = {
                "client",
                "stay",
                "reservation",
                "room",
                "service_department",
                "label",
                "quantity",
                "unit_price",
                "service_date",
            }
            attempted_mutations = immutable_fields.intersection(validated_data.keys())
            if attempted_mutations or items_data is not None:
                raise serializers.ValidationError(
                    "Une consommation deja facturee ne peut plus etre modifiee sur ses montants ou ses rattachements."
                )

        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()

            if items_data is not None:
                self._replace_items(instance, items_data)

            instance.refresh_from_db()
        return instance

    def _replace_items(self, consumption, items_data):
        if items_data is None:
            return

        consumption.items.all().delete()
        for index, item_data in enumerate(items_data):
            payload = dict(item_data)
            ClientConsumptionItem.objects.create(
                consumption=consumption,
                sort_order=payload.pop("sort_order", index),
                **payload,
            )
        if items_data:
            consumption.refresh_totals_from_items()
        else:
            consumption.save(update_fields=["total_amount", "updated_at"])
