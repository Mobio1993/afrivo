from rest_framework import serializers

from apps.billing.serializers import ClientPaymentSerializer


PaymentSerializer = ClientPaymentSerializer


class PaymentDetailSerializer(ClientPaymentSerializer):
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    day_use_reference = serializers.CharField(source="day_use.reference", read_only=True)
    sejour_reference = serializers.CharField(source="stay.reference", read_only=True)
    encaissements = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()
    statut = serializers.CharField(source="status", read_only=True)
    statut_display = serializers.CharField(source="get_status_display", read_only=True)
    mode_paiement = serializers.CharField(source="method", read_only=True)
    mode_paiement_display = serializers.CharField(source="get_method_display", read_only=True)
    type_paiement = serializers.CharField(source="payment_type", read_only=True)
    type_paiement_display = serializers.CharField(source="get_payment_type_display", read_only=True)
    montant = serializers.DecimalField(source="amount", max_digits=10, decimal_places=2, read_only=True)
    devise = serializers.CharField(source="currency", read_only=True)
    date = serializers.DateTimeField(source="paid_at", read_only=True)
    origine = serializers.CharField(source="source", read_only=True)
    reference_externe = serializers.CharField(source="external_reference", read_only=True)
    notes_internes = serializers.CharField(source="notes", read_only=True)

    class Meta(ClientPaymentSerializer.Meta):
        fields = ClientPaymentSerializer.Meta.fields + [
            "hotel_name",
            "day_use_reference",
            "sejour_reference",
            "encaissements",
            "formatted_date",
            "statut",
            "statut_display",
            "mode_paiement",
            "mode_paiement_display",
            "type_paiement",
            "type_paiement_display",
            "montant",
            "devise",
            "date",
            "origine",
            "reference_externe",
            "notes_internes",
        ]
        read_only_fields = ClientPaymentSerializer.Meta.read_only_fields + [
            "hotel_name",
            "day_use_reference",
            "sejour_reference",
            "encaissements",
            "formatted_date",
            "statut",
            "statut_display",
            "mode_paiement",
            "mode_paiement_display",
            "type_paiement",
            "type_paiement_display",
            "montant",
            "devise",
            "date",
            "origine",
            "reference_externe",
            "notes_internes",
        ]

    def get_encaissements(self, obj):
        return []

    def get_formatted_date(self, obj):
        if not obj.paid_at:
            return None
        return obj.paid_at.strftime("%d %b %Y - %H:%M")


__all__ = ["PaymentSerializer", "PaymentDetailSerializer"]
