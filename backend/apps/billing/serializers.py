from django.db import transaction
from rest_framework import serializers

from apps.billing.models import ClientInvoice, ClientInvoiceItem, Payment


PAYMENT_METHOD_INPUT_ALIASES = {
    "bank_transfer": Payment.Method.TRANSFER,
}

PAYMENT_STATUS_OUTPUT_ALIASES = {
    Payment.Status.PAID: "confirmed",
}


class ClientInvoiceItemSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service_department.name", read_only=True)
    room_number = serializers.CharField(source="room.number", read_only=True)
    consumption_reference = serializers.CharField(source="consumption.reference", read_only=True)
    service = serializers.IntegerField(source="service_department_id", read_only=True)
    consumed_at = serializers.DateTimeField(source="service_date", read_only=True)

    class Meta:
        model = ClientInvoiceItem
        fields = [
            "id",
            "consumption",
            "consumption_reference",
            "service_department",
            "service",
            "service_name",
            "room",
            "room_number",
            "label",
            "description",
            "quantity",
            "unit_price",
            "line_total",
            "service_date",
            "consumed_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "line_total",
            "service",
            "service_name",
            "room_number",
            "consumption_reference",
            "consumed_at",
            "created_at",
            "updated_at",
        ]


class ClientPaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    stay_reference = serializers.CharField(source="stay.reference", read_only=True)
    invoice_reference = serializers.CharField(source="invoice.reference", read_only=True)
    reservation = serializers.IntegerField(source="booking_id", read_only=True)
    reservation_reference = serializers.CharField(source="booking.reference", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    cashier_name = serializers.SerializerMethodField()
    payment_reference = serializers.CharField(source="reference", read_only=True)
    payment_method = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_type_label = serializers.CharField(source="get_payment_type_display", read_only=True)
    status_alias = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "reference",
            "payment_reference",
            "client",
            "client_name",
            "stay",
            "stay_reference",
            "invoice",
            "invoice_reference",
            "booking",
            "reservation",
            "reservation_reference",
            "day_use",
            "recorded_by",
            "recorded_by_name",
            "cashier_name",
            "payment_type",
            "payment_type_label",
            "method",
            "payment_method",
            "amount",
            "paid_at",
            "status",
            "status_alias",
            "status_label",
            "notes",
            "source",
            "external_reference",
            "currency",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "reference",
            "payment_reference",
            "client_name",
            "stay_reference",
            "invoice_reference",
            "reservation",
            "reservation_reference",
            "recorded_by_name",
            "cashier_name",
            "payment_method",
            "status_alias",
            "status_label",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return ""
        return obj.recorded_by.get_full_name().strip() or obj.recorded_by.username

    def get_cashier_name(self, obj):
        return self.get_recorded_by_name(obj)

    def get_payment_method(self, obj):
        if obj.method == Payment.Method.TRANSFER:
            return "bank_transfer"
        return obj.method

    def get_status_alias(self, obj):
        return PAYMENT_STATUS_OUTPUT_ALIASES.get(obj.status, obj.status)

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)

        if "payment_reference" in data and "reference" not in data:
            data["reference"] = data["payment_reference"]
        if "payment_method" in data and "method" not in data:
            data["method"] = data["payment_method"]
        if "reservation" in data and "booking" not in data:
            data["booking"] = data["reservation"]
        method = data.get("method")
        if method in PAYMENT_METHOD_INPUT_ALIASES:
            data["method"] = PAYMENT_METHOD_INPUT_ALIASES[method]
        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = self.instance
        client = attrs.get("client") if "client" in attrs else getattr(instance, "client", None)
        stay = attrs.get("stay") if "stay" in attrs else getattr(instance, "stay", None)
        booking = attrs.get("booking") if "booking" in attrs else getattr(instance, "booking", None)
        invoice = attrs.get("invoice") if "invoice" in attrs else getattr(instance, "invoice", None)
        day_use = attrs.get("day_use") if "day_use" in attrs else getattr(instance, "day_use", None)
        payment_type = attrs.get("payment_type") if "payment_type" in attrs else getattr(instance, "payment_type", None)
        amount = attrs.get("amount") if "amount" in attrs else getattr(instance, "amount", None)

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Le montant doit etre strictement positif."})

        if client and stay and stay.guest_id != client.id:
            raise serializers.ValidationError({"stay": "Le sejour selectionne doit appartenir au meme client."})
        if client and booking and booking.guest_id != client.id:
            raise serializers.ValidationError({"booking": "La reservation selectionnee doit appartenir au meme client."})
        if client and invoice and invoice.client_id != client.id:
            raise serializers.ValidationError({"invoice": "La facture selectionnee doit appartenir au meme client."})
        if client and day_use and day_use.guest_id != client.id:
            raise serializers.ValidationError({"day_use": "Le day use selectionne doit appartenir au meme client."})

        if payment_type == Payment.PaymentType.REFUND and (attrs.get("status") or getattr(instance, "status", None)) != Payment.Status.REFUNDED:
            raise serializers.ValidationError({"payment_type": "Un type remboursement doit porter le statut rembourse."})

        if instance and instance.status in {Payment.Status.CANCELLED, Payment.Status.REFUNDED}:
            raise serializers.ValidationError("Un paiement annule ou rembourse ne peut plus etre modifie.")

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("recorded_by", request.user)
        return Payment.objects.create(**validated_data)

    def update(self, instance, validated_data):
        protected_fields = {"client", "stay", "invoice", "booking", "day_use", "amount", "payment_type"}
        if instance.status == Payment.Status.PAID and protected_fields.intersection(validated_data.keys()):
            raise serializers.ValidationError(
                "Un paiement deja confirme ne peut plus voir ses rattachements, son montant ou son type modifies."
            )

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class ClientInvoiceSerializer(serializers.ModelSerializer):
    items = ClientInvoiceItemSerializer(many=True, required=False)
    payments = ClientPaymentSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    stay_reference = serializers.CharField(source="stay.reference", read_only=True)
    reservation_reference = serializers.CharField(source="reservation.reference", read_only=True)
    issued_by_name = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source="reference", read_only=True)

    class Meta:
        model = ClientInvoice
        fields = [
            "id",
            "reference",
            "invoice_number",
            "client",
            "client_name",
            "stay",
            "stay_reference",
            "reservation",
            "reservation_reference",
            "issued_by",
            "issued_by_name",
            "status",
            "issued_at",
            "due_date",
            "subtotal_amount",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "amount_paid",
            "balance_due",
            "currency",
            "notes",
            "source",
            "created_at",
            "updated_at",
            "items",
            "payments",
        ]
        read_only_fields = [
            "reference",
            "invoice_number",
            "issued_by",
            "issued_by_name",
            "subtotal_amount",
            "total_amount",
            "amount_paid",
            "balance_due",
            "created_at",
            "updated_at",
            "payments",
        ]

    def get_issued_by_name(self, obj):
        if not obj.issued_by:
            return ""
        return obj.issued_by.get_full_name().strip() or obj.issued_by.username

    def validate(self, attrs):
        client = attrs.get("client") or getattr(self.instance, "client", None)
        stay = attrs.get("stay") if "stay" in attrs else getattr(self.instance, "stay", None)
        reservation = attrs.get("reservation") if "reservation" in attrs else getattr(self.instance, "reservation", None)
        due_date = attrs.get("due_date") if "due_date" in attrs else getattr(self.instance, "due_date", None)
        issued_at = attrs.get("issued_at") if "issued_at" in attrs else getattr(self.instance, "issued_at", None)

        if stay and client and stay.guest_id != client.id:
            raise serializers.ValidationError({"stay": "Le sejour selectionne doit appartenir au meme client."})

        if reservation and client and reservation.guest_id != client.id:
            raise serializers.ValidationError({"reservation": "La reservation selectionnee doit appartenir au meme client."})

        if stay and reservation and stay.booking_id and stay.booking_id != reservation.id:
            raise serializers.ValidationError({"reservation": "La reservation ne correspond pas au sejour selectionne."})

        if due_date and issued_at and due_date < issued_at.date():
            raise serializers.ValidationError({"due_date": "L'echeance ne peut pas etre anterieure a la date d'emission."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["issued_by"] = request.user

        with transaction.atomic():
            invoice = ClientInvoice.objects.create(**validated_data)
            self._replace_items(invoice, items_data)
            invoice.refresh_from_db()
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        if instance.status == ClientInvoice.Status.CANCELLED:
            raise serializers.ValidationError("Une facture annulee ne peut plus etre modifiee.")

        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()

            if items_data is not None:
                if instance.status == ClientInvoice.Status.PAID:
                    raise serializers.ValidationError("Une facture deja payee ne peut plus voir ses lignes modifiees.")
                self._replace_items(instance, items_data)

            instance.refresh_from_db()
        return instance

    def _replace_items(self, invoice, items_data):
        if items_data is None:
            return
        invoice.items.all().delete()
        for item_data in items_data:
            ClientInvoiceItem.objects.create(invoice=invoice, **item_data)
        invoice.refresh_financials()
