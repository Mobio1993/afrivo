import json
import re
from pathlib import Path
from zoneinfo import available_timezones

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.billing.models import ClientInvoice
from apps.tenancy.models import HotelSettings


HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
INVOICE_PREFIX_RE = re.compile(r"^[A-Z0-9]{3,10}$")
ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/svg+xml"}
ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg"}
MAX_LOGO_SIZE = 2 * 1024 * 1024
ALLOWED_PAYMENT_METHODS = {"cash", "card", "mobile_money", "bank_transfer", "online"}


class HotelSettingsSerializer(serializers.ModelSerializer):
    hotel = serializers.IntegerField(source="hotel_id", read_only=True)
    hotel_name = serializers.CharField(source="hotel.name", read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = HotelSettings
        fields = [
            "hotel",
            "hotel_name",
            "hotel_name_display",
            "logo",
            "logo_url",
            "address",
            "phone",
            "email",
            "currency",
            "timezone",
            "total_rooms",
            "checkin_time",
            "checkout_time",
            "grace_period_minutes",
            "no_show_policy",
            "cancellation_policy",
            "deposit_required",
            "deposit_percentage",
            "invoice_prefix",
            "invoice_start_number",
            "tax_rate",
            "payment_methods",
            "allow_negative_balance",
            "require_payment_before_checkout",
            "checkout_payment_policy",
            "session_timeout_minutes",
            "require_delete_confirmation",
            "enable_activity_log",
            "primary_color",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["hotel", "hotel_name", "logo_url", "checkout_payment_policy", "created_at", "updated_at"]
        extra_kwargs = {
            "logo": {"required": False, "allow_null": True},
            "hotel_name_display": {"required": False, "allow_blank": True},
            "address": {"required": False, "allow_blank": True},
            "phone": {"required": False, "allow_blank": True},
            "email": {"required": False, "allow_blank": True},
            "payment_methods": {"required": False},
        }

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get("request")
        url = obj.logo.url
        return request.build_absolute_uri(url) if request else url

    def validate_payment_methods(self, value):
        if value in (None, ""):
            return []
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("Les modes de paiement doivent etre une liste.") from exc
        if not isinstance(value, list):
            raise serializers.ValidationError("Les modes de paiement doivent etre une liste.")
        cleaned = []
        for item in value:
            method = str(item).strip()
            if method and method not in cleaned:
                cleaned.append(method)
        invalid = sorted(set(cleaned) - ALLOWED_PAYMENT_METHODS)
        if invalid:
            raise serializers.ValidationError("Mode de paiement non autorise.")
        return cleaned

    def validate_logo(self, value):
        if not value:
            return value
        if getattr(value, "size", 0) > MAX_LOGO_SIZE:
            raise serializers.ValidationError("Le logo ne doit pas depasser 2 MB.")
        extension = Path(getattr(value, "name", "")).suffix.lower()
        if extension not in ALLOWED_LOGO_EXTENSIONS:
            raise serializers.ValidationError("Format logo non autorise.")
        content_type = getattr(value, "content_type", "")
        if content_type and content_type not in ALLOWED_LOGO_TYPES:
            raise serializers.ValidationError("Type de fichier logo non autorise.")
        return value

    def validate_primary_color(self, value):
        if value and not HEX_COLOR_RE.match(value):
            raise serializers.ValidationError("La couleur principale doit etre au format #RRGGBB.")
        return value

    def validate_timezone(self, value):
        value = (value or "").strip()
        if value not in available_timezones():
            raise serializers.ValidationError("Fuseau horaire invalide.")
        return value

    def validate_currency(self, value):
        allowed = {choice for choice, _ in HotelSettings.Currency.choices}
        if value not in allowed:
            raise serializers.ValidationError("Devise non autorisee.")
        return value

    def validate_invoice_prefix(self, value):
        value = (value or "").strip().upper()
        if not INVOICE_PREFIX_RE.match(value):
            raise serializers.ValidationError("Le prefixe facture doit contenir 3 a 10 caracteres alphanumeriques.")
        if (
            self.instance
            and self.instance.invoice_prefix != value
            and ClientInvoice.objects.filter(hotel=self.instance.hotel).exists()
        ):
            raise serializers.ValidationError("Impossible de modifier le prefixe apres emission d'une facture.")
        return value

    def validate(self, attrs):
        instance = self.instance or HotelSettings()

        if (
            self.instance
            and "invoice_start_number" in attrs
            and self.instance.invoice_start_number != attrs["invoice_start_number"]
            and ClientInvoice.objects.filter(hotel=self.instance.hotel).exists()
        ):
            raise serializers.ValidationError(
                {"invoice_start_number": "Impossible de modifier le numero de depart apres emission d'une facture."}
            )

        if "require_payment_before_checkout" in attrs:
            attrs["checkout_payment_policy"] = (
                HotelSettings.CheckoutPaymentPolicy.BLOCKING
                if attrs["require_payment_before_checkout"]
                else HotelSettings.CheckoutPaymentPolicy.NON_BLOCKING
            )

        for field, value in attrs.items():
            setattr(instance, field, value)

        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        return attrs


def build_settings_options():
    return {
        "currencies": [{"value": value, "label": label} for value, label in HotelSettings.Currency.choices],
        "no_show_policies": [{"value": value, "label": label} for value, label in HotelSettings.NoShowPolicy.choices],
        "cancellation_policies": [{"value": value, "label": label} for value, label in HotelSettings.CancellationPolicy.choices],
        "payment_methods": [
            {"value": "cash", "label": "Especes"},
            {"value": "card", "label": "Carte bancaire"},
            {"value": "mobile_money", "label": "Mobile money"},
            {"value": "bank_transfer", "label": "Virement"},
            {"value": "online", "label": "Paiement en ligne"},
        ],
        "timezones": [
            {"value": "Atlantic/Reykjavik", "label": "UTC"},
            {"value": "Africa/Abidjan", "label": "Afrique/Abidjan"},
            {"value": "Africa/Conakry", "label": "Afrique/Conakry"},
            {"value": "Africa/Dakar", "label": "Afrique/Dakar"},
            {"value": "Africa/Kinshasa", "label": "Afrique/Kinshasa"},
            {"value": "Africa/Brazzaville", "label": "Afrique/Brazzaville"},
            {"value": "Europe/Paris", "label": "Europe/Paris"},
        ],
    }
