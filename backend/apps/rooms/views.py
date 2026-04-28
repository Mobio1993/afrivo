from django.db.models import Count, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.rooms.models import Room, RoomHousekeepingTask, RoomMaintenanceIncident, RoomRateRule, RoomType
from apps.rooms.permissions import RoomInventoryPermission, RoomOperationsPermission
from apps.rooms.serializers import (
    RoomAssignmentSuggestionSerializer,
    RoomHousekeepingTaskSerializer,
    RoomMaintenanceIncidentSerializer,
    RoomRealtimeStateSerializer,
    RoomRateRuleSerializer,
    RoomSerializer,
    RoomTypeSerializer,
)
from apps.rooms.services import build_rooms_dashboard, build_rooms_realtime_states, sync_room_operational_status
from apps.tenancy.drf import HotelScopedQuerysetMixin


class RoomTypeViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomTypeSerializer
    permission_classes = [RoomInventoryPermission]
    hotel_scope_module = "rooms"
    permission_module = "operations"

    def get_queryset(self):
        queryset = (
            RoomType.objects.prefetch_related(
                Prefetch("rooms", queryset=Room.objects.order_by("number"))
            )
            .annotate(room_count=Count("rooms"))
            .order_by("name")
        )
        queryset = self.scope_queryset(queryset)

        search = (self.request.query_params.get("search") or "").strip()
        is_active = self.request.query_params.get("is_active")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(description__icontains=search))
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        return queryset

    def perform_create(self, serializer):
        room_type = serializer.save(hotel=getattr(self.request, "active_hotel", None))
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="rooms",
            entity_type="RoomType",
            entity_reference=room_type.code,
            description=f"Type de chambre cree : {room_type.name}.",
            actor=self.request.user,
            metadata={"room_type_id": room_type.id, "code": room_type.code},
            hotel=room_type.hotel,
        )

    def perform_update(self, serializer):
        room_type = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="RoomType",
            entity_reference=room_type.code,
            description=f"Type de chambre mis a jour : {room_type.name}.",
            actor=self.request.user,
            metadata={"room_type_id": room_type.id, "code": room_type.code},
            hotel=room_type.hotel,
        )

    def destroy(self, request, *args, **kwargs):
        room_type = self.get_object()
        room_type.is_active = False
        room_type.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoomViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [RoomInventoryPermission]
    hotel_scope_module = "rooms"
    permission_module = "operations"

    def get_queryset(self):
        queryset = (
            Room.objects.select_related("room_type")
            .prefetch_related(
                Prefetch("housekeeping_tasks", queryset=RoomHousekeepingTask.objects.order_by("-requested_at")),
                Prefetch("maintenance_incidents", queryset=RoomMaintenanceIncident.objects.order_by("-reported_at")),
            )
            .order_by("floor", "number")
        )
        queryset = self.scope_queryset(queryset)

        status_code = (self.request.query_params.get("status") or "").strip()
        room_type_id = self.request.query_params.get("room_type")
        floor = self.request.query_params.get("floor")
        search = (self.request.query_params.get("search") or "").strip()
        is_active = self.request.query_params.get("is_active")

        if status_code:
            queryset = queryset.filter(status=status_code)
        if room_type_id:
            queryset = queryset.filter(room_type_id=room_type_id)
        if floor:
            queryset = queryset.filter(floor=floor)
        if search:
            queryset = queryset.filter(
                Q(number__icontains=search)
                | Q(room_code__icontains=search)
                | Q(room_type__name__icontains=search)
                | Q(room_type__code__icontains=search)
            )
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        return queryset

    def perform_create(self, serializer):
        room = serializer.save(hotel=getattr(self.request, "active_hotel", None))
        sync_room_operational_status(room)
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Chambre creee : {room.number}.",
            actor=self.request.user,
            metadata={"room_id": room.id, "room_type_id": room.room_type_id},
            hotel=room.hotel,
        )

    def perform_update(self, serializer):
        room = serializer.save()
        sync_room_operational_status(room)
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Chambre mise a jour : {room.number}.",
            actor=self.request.user,
            metadata={"room_id": room.id, "status": room.status},
            hotel=room.hotel,
        )

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        room.is_active = False
        room.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[RoomOperationsPermission], url_path="complete-cleaning")
    def complete_cleaning(self, request, pk=None):
        room = self.get_object()
        room.complete_cleaning()
        return Response(self.get_serializer(room).data)

    @action(detail=True, methods=["post"], permission_classes=[RoomOperationsPermission], url_path="check-in")
    def check_in(self, request, pk=None):
        room = self.get_object()
        if not room.is_available_for_check_in:
            return Response(
                {"detail": f"La chambre {room.number} n'est pas disponible pour un check-in (statut actuel : {room.get_status_display()})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        room.status = Room.Status.OCCUPIED
        room.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Check-in manuel effectue pour la chambre {room.number}.",
            actor=request.user,
            metadata={"room_id": room.id, "status": room.status},
            hotel=room.hotel,
        )
        return Response(self.get_serializer(room).data)

    @action(detail=True, methods=["post"], permission_classes=[RoomOperationsPermission], url_path="check-out")
    def check_out(self, request, pk=None):
        room = self.get_object()
        if room.status != Room.Status.OCCUPIED:
            return Response(
                {"detail": f"La chambre {room.number} n'est pas occupee (statut actuel : {room.get_status_display()})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sync_room_operational_status(room)
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Check-out effectue pour la chambre {room.number}, nouveau statut : {room.get_status_display()}.",
            actor=request.user,
            metadata={"room_id": room.id, "status": room.status},
            hotel=room.hotel,
        )
        return Response(self.get_serializer(room).data)

    @action(detail=False, methods=["get"], permission_classes=[RoomOperationsPermission], url_path="dashboard")
    def dashboard(self, request):
        hotel = getattr(request, "active_hotel", None)
        if hotel is None:
            return Response({"detail": "Aucun hotel actif."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_rooms_dashboard(hotel))

    @action(detail=False, methods=["get"], permission_classes=[RoomOperationsPermission], url_path="assignment-suggestions")
    def assignment_suggestions(self, request):
        hotel = getattr(request, "active_hotel", None)
        serializer = RoomAssignmentSuggestionSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response({"results": serializer.build_payload(hotel=hotel)})

    @action(detail=False, methods=["get"], permission_classes=[RoomOperationsPermission], url_path="realtime")
    def realtime(self, request):
        hotel = getattr(request, "active_hotel", None)
        if hotel is None:
            return Response({"detail": "Aucun hotel actif."}, status=status.HTTP_400_BAD_REQUEST)
        payload = build_rooms_realtime_states(hotel)
        serializer = RoomRealtimeStateSerializer(payload["results"], many=True)
        return Response({"results": serializer.data, "source": payload["source"]})


class RoomRateRuleViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomRateRuleSerializer
    permission_classes = [RoomInventoryPermission]
    hotel_scope_module = "rooms"
    permission_module = "operations"

    def get_queryset(self):
        queryset = RoomRateRule.objects.select_related("room_type").order_by("priority", "name")
        queryset = self.scope_queryset(queryset)

        room_type_id = self.request.query_params.get("room_type")
        rule_type = self.request.query_params.get("rule_type")
        search = (self.request.query_params.get("search") or "").strip()
        if room_type_id:
            queryset = queryset.filter(room_type_id=room_type_id)
        if rule_type:
            queryset = queryset.filter(rule_type=rule_type)
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(room_type__name__icontains=search))
        return queryset

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None))


class RoomHousekeepingTaskViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomHousekeepingTaskSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "operations"

    def get_queryset(self):
        queryset = RoomHousekeepingTask.objects.select_related("room", "assigned_to").order_by("status", "-requested_at")
        queryset = self.scope_queryset(queryset)

        status_code = self.request.query_params.get("status")
        assigned_to = self.request.query_params.get("assigned_to")
        room_id = self.request.query_params.get("room")
        if status_code:
            queryset = queryset.filter(status=status_code)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset

    def perform_create(self, serializer):
        task = serializer.save(hotel=getattr(self.request, "active_hotel", None))
        if task.room.status != Room.Status.CLEANING:
            task.room.status = Room.Status.CLEANING
            task.room.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        task.status = task.Status.IN_PROGRESS
        task.save(update_fields=["status", "started_at", "updated_at"])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        task = self.get_object()
        task.actual_minutes = request.data.get("actual_minutes") or task.actual_minutes
        task.status = task.Status.COMPLETED
        task.save(update_fields=["actual_minutes", "status", "completed_at", "updated_at"])
        return Response(self.get_serializer(task).data)


class RoomMaintenanceIncidentViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomMaintenanceIncidentSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "operations"

    def get_queryset(self):
        queryset = RoomMaintenanceIncident.objects.select_related("room", "reported_by", "assigned_to").order_by("status", "-reported_at")
        queryset = self.scope_queryset(queryset)

        status_code = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        room_id = self.request.query_params.get("room")
        if status_code:
            queryset = queryset.filter(status=status_code)
        if severity:
            queryset = queryset.filter(severity=severity)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None), reported_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        incident = self.get_object()
        incident.status = incident.Status.RESOLVED
        incident.resolution_notes = request.data.get("resolution_notes") or incident.resolution_notes
        incident.save(update_fields=["status", "resolution_notes", "resolved_at", "updated_at"])
        return Response(self.get_serializer(incident).data)
