from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService
from apps.tenancy.models import HotelSettings
from apps.tenancy.permissions import HotelSettingsPermission
from apps.tenancy.serializers import HotelSettingsSerializer, build_settings_options
from apps.tenants.services.scope_service import get_request_hotel


log_history = HotelAuditService.log_history


def _audit_value(value):
    if hasattr(value, "name"):
        return value.name
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


class SettingsViewSet(viewsets.ViewSet):
    permission_classes = [HotelSettingsPermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _get_hotel_settings(self, request):
        hotel = get_request_hotel(request)
        if hotel is None:
            return None, Response({"detail": "Aucun hotel actif."}, status=status.HTTP_400_BAD_REQUEST)

        settings, created = HotelSettings.objects.get_or_create(
            hotel=hotel,
            defaults={
                "hotel_name_display": hotel.name,
                "currency": hotel.currency,
                "timezone": hotel.timezone,
            },
        )
        return settings, None

    @action(detail=False, methods=["get", "patch"], url_path="hotel")
    def hotel(self, request):
        settings, error_response = self._get_hotel_settings(request)
        if error_response is not None:
            return error_response

        if request.method == "GET":
            serializer = HotelSettingsSerializer(settings, context={"request": request})
            return Response(serializer.data)

        serializer = HotelSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        previous_values = {
            field: _audit_value(getattr(settings, field, None))
            for field in serializer.validated_data
            if hasattr(settings, field)
        }
        settings = serializer.save()
        changes = {
            field: {"old": old_value, "new": _audit_value(getattr(settings, field, None))}
            for field, old_value in previous_values.items()
            if old_value != _audit_value(getattr(settings, field, None))
        }

        if settings.enable_activity_log and changes:
            log_history(
                action_type=HistoryEntry.ActionType.STATUS_UPDATED,
                module="settings",
                entity_type="HotelSettings",
                entity_reference=settings.hotel.name,
                description=f"Parametres hotel mis a jour : {settings.hotel.name}.",
                actor=request.user,
                metadata={"settings_id": settings.id, "changes": changes},
                hotel=settings.hotel,
            )

        return Response(HotelSettingsSerializer(settings, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request):
        return Response(build_settings_options())
