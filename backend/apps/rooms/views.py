from datetime import timedelta

from django.db.models import Count, Prefetch, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.iam.services.permission_service import PermissionService
from apps.rooms.models import (
    EnergyReading,
    Room,
    RoomAlert,
    RoomHousekeepingTask,
    RoomLiveStatus,
    RoomMaintenanceIncident,
    RoomRateRule,
    RoomSensor,
    RoomType,
    SensorEvent,
)
from apps.rooms.permissions import RoomInventoryPermission, RoomOperationsPermission
from apps.rooms.serializers import (
    EnergyReadingSerializer,
    HousekeepingDashboardSerializer,
    HousekeepingTaskEnhancedSerializer,
    RoomAlertSerializer,
    RoomAssignmentSuggestionSerializer,
    RoomHousekeepingTaskSerializer,
    RoomHotelViewSerializer,
    RoomLiveStatusSerializer,
    RoomMaintenanceIncidentSerializer,
    RoomRealtimeStateSerializer,
    RoomRealtimeSerializer,
    RoomRealtimeSummarySerializer,
    RoomRateRuleSerializer,
    RoomSensorSerializer,
    RoomSerializer,
    RoomTypeSerializer,
    SensorEventSerializer,
)
from apps.rooms.services import build_rooms_dashboard, build_rooms_realtime_states, sync_room_operational_status
from apps.tenancy.drf import HotelScopedQuerysetMixin


class RoomTypeViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomTypeSerializer
    permission_classes = [RoomInventoryPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"

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
    permission_module = "rooms"
    business_action_map = {
        "complete_cleaning": "rooms.cleaning_complete",
        "check_in": "operations.check_in",
        "check_out": "operations.check_out",
        "reactivate": "rooms.unblock",
    }

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
        hotel = getattr(self.request, "active_hotel", None)
        number = serializer.validated_data.get("number")
        existing_room = Room.objects.filter(hotel=hotel, number=number).first()
        if existing_room:
            if existing_room.is_active:
                raise ValidationError({
                    "number": [f"La chambre {number} existe deja dans cet hotel."],
                })
            raise ValidationError({
                "number": [
                    f"La chambre {number} existe deja mais elle est desactivee. Reactivez-la au lieu d'en creer une nouvelle."
                ],
                "reactivate_room_id": existing_room.id,
            })

        room = serializer.save(hotel=hotel)
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

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        room = self.get_object()
        room.is_active = True
        room.save(update_fields=["is_active", "updated_at"])
        sync_room_operational_status(room)
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="rooms",
            entity_type="Room",
            entity_reference=room.number,
            description=f"Chambre reactivee : {room.number}.",
            actor=request.user,
            metadata={"room_id": room.id, "status": room.status},
            hotel=room.hotel,
        )
        return Response(self.get_serializer(room).data)

    @action(detail=True, methods=["post"], permission_classes=[RoomOperationsPermission], url_path="complete-cleaning")
    def complete_cleaning(self, request, pk=None):
        room = self.get_object()
        room.complete_cleaning()
        return Response(self.get_serializer(room).data)

    @action(detail=True, methods=["post"], permission_classes=[RoomOperationsPermission], url_path="check-in")
    def check_in(self, request, pk=None):
        return Response(
            {
                "detail": (
                    "Le check-in direct depuis une chambre est desactive. "
                    "Utilisez une reservation confirmee depuis le module Exploitation."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

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
        legacy_payload = build_rooms_realtime_states(hotel)
        legacy_serializer = RoomRealtimeStateSerializer(legacy_payload["results"], many=True)

        rooms_qs = (
            hotel.rooms.select_related("room_type", "live_status")
            .prefetch_related("sensors", "smart_alerts", "sensor_events")
            .filter(is_active=True)
            .order_by("floor", "number")
        )
        rooms_data = RoomRealtimeSerializer(rooms_qs, many=True, context={"request": request}).data

        disponibles = sum(1 for room in rooms_data if room["etat_hotelier"] == "disponible")
        occupees = sum(1 for room in rooms_data if room["etat_hotelier"] == "occupee")
        nettoyage_count = sum(1 for room in rooms_data if room["etat_hotelier"] == "nettoyage")
        hors_service = sum(1 for room in rooms_data if room["etat_hotelier"] in {"hors_service", "maintenance"})
        alertes = sum(1 for room in rooms_data if room["derniere_alerte_msg"])
        hors_ligne = sum(1 for room in rooms_data if not room["capteur_en_ligne"])
        portes_long = sum(1 for room in rooms_data if room["porte_duree_min"] > 10)
        temperatures = [room["temperature"] for room in rooms_data if room["temperature"] is not None]
        humidites = [room["humidite"] for room in rooms_data if room["humidite"] is not None]

        alerts_feed = []
        for alert in (
            hotel.room_smart_alerts.select_related("room")
            .filter(created_at__gte=timezone.now() - timedelta(hours=24))
            .order_by("-created_at")[:20]
        ):
            delta = timezone.now() - alert.created_at
            mins = max(int(delta.total_seconds() // 60), 0)
            alerts_feed.append(
                {
                    "chambre_numero": str(alert.room.number) if alert.room_id else "?",
                    "message": alert.message,
                    "niveau": "critique" if alert.severity == RoomAlert.Severity.CRITICAL else alert.severity,
                    "time": f"il y a {mins} min" if mins < 60 else f"il y a {mins // 60}h",
                    "resolue": not alert.is_active,
                }
            )

        response_data = {
            "total_chambres": rooms_qs.count(),
            "disponibles": disponibles,
            "occupees": occupees,
            "nettoyage": nettoyage_count,
            "hors_service": hors_service,
            "alertes_actives": alertes,
            "capteurs_hors_ligne": hors_ligne,
            "portes_ouvertes_long": portes_long,
            "temperature_moyenne": round(sum(temperatures) / len(temperatures), 1) if temperatures else None,
            "humidite_moyenne": round(sum(humidites) / len(humidites), 1) if humidites else None,
            "rooms": rooms_data,
            "alerts_feed": alerts_feed,
            "results": legacy_serializer.data,
            "source": legacy_payload["source"],
        }
        summary_serializer = RoomRealtimeSummarySerializer(data=response_data)
        summary_serializer.is_valid(raise_exception=True)
        return Response({**summary_serializer.validated_data, "results": legacy_serializer.data, "source": legacy_payload["source"]})

    @action(detail=False, methods=["get"], permission_classes=[RoomOperationsPermission], url_path="vue-hotel")
    def vue_hotel(self, request):
        from apps.bookings.models import Booking
        from apps.stays.models import Stay

        hotel = getattr(request, "active_hotel", None)
        if hotel is None:
            return Response({"detail": "Aucun hotel actif."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        now = timezone.now()
        rooms_qs = (
            hotel.rooms.select_related("room_type", "live_status")
            .prefetch_related("stays__guest", "bookings__guest", "sensors", "smart_alerts", "housekeeping_tasks__assigned_to")
            .filter(is_active=True)
            .order_by("floor", "number")
        )
        rooms_data = RoomHotelViewSerializer(rooms_qs, many=True, context={"request": request}).data
        total_rooms = rooms_qs.count() or 1

        disponibles = sum(1 for item in rooms_data if item["statut"] == Room.Status.AVAILABLE)
        occupees = sum(1 for item in rooms_data if item["statut"] == Room.Status.OCCUPIED)
        nettoyage = sum(1 for item in rooms_data if item["statut"] == Room.Status.CLEANING)
        hors_service = sum(1 for item in rooms_data if item["statut"] == Room.Status.OUT_OF_SERVICE)
        taux_occ = round((occupees / total_rooms) * 100, 1)

        arrivees_qs = (
            Booking.objects.select_related("guest", "room", "room__room_type", "room_type")
            .filter(hotel=hotel, check_in_date=today, status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
            .order_by("created_at", "id")
        )
        departs_qs = (
            Stay.objects.select_related("guest", "room")
            .filter(hotel=hotel, status=Stay.Status.IN_PROGRESS, expected_check_out_date=today)
            .order_by("planned_check_out", "id")
        )

        total_revenus = (
            Booking.objects.filter(hotel=hotel, check_in_date=today)
            .exclude(status=Booking.Status.CANCELLED)
            .aggregate(total=Sum("estimated_amount"))["total"]
            or 0
        )
        revpar = round(float(total_revenus) / total_rooms, 2)
        solde_total = round(sum(float(item.get("solde_du") or 0) for item in rooms_data), 2)

        departs_liste = []
        for stay in departs_qs:
            try:
                totals = stay.get_financial_totals()
                solde = float(totals["unpaid_balance"] or 0)
            except Exception:
                solde = 0
            planned = stay.planned_check_out
            departs_liste.append(
                {
                    "chambre_numero": str(stay.room.number) if stay.room_id else "?",
                    "client_nom": stay.guest.full_name if stay.guest_id else "-",
                    "heure_prevue": timezone.localtime(planned).strftime("%H:%M") if planned else "12:00",
                    "solde_du": solde,
                    "statut": "retard" if planned and planned < now else "aujourd_hui",
                }
            )

        arrivees_liste = []
        for booking in arrivees_qs:
            nuits = max((booking.check_out_date - booking.check_in_date).days, 1)
            room = booking.room
            room_type = room.room_type if room else booking.room_type
            arrivees_liste.append(
                {
                    "booking_id": booking.id,
                    "chambre_numero": str(room.number) if room else "?",
                    "client_nom": booking.guest.full_name if booking.guest_id else "-",
                    "type_chambre": room_type.name if room_type else "-",
                    "nb_nuits": nuits,
                    "heure_prevue": "14:00",
                    "chambre_prete": bool(room and room.status == Room.Status.AVAILABLE),
                    "affectee": bool(room),
                }
            )

        suggestions = []
        available_rooms = rooms_qs.filter(status__in=[Room.Status.AVAILABLE, Room.Status.CLEANING])[:8]
        for room in available_rooms:
            score = 70
            reasons = []
            if room.status == Room.Status.AVAILABLE:
                score += 15
                reasons.append("Disponible immediatement")
            if room.status == Room.Status.CLEANING:
                score += 5
                reasons.append("Disponible apres nettoyage")
            if room.room_type_id:
                score += 5
                reasons.append("Type chambre exploitable")
            if room.effective_price_per_night:
                score += 5
                reasons.append("Tarif compatible")
            if room.floor in {1, 2, None}:
                score += 3
                reasons.append("Acces operationnel simple")
            suggestions.append(
                {
                    "chambre_id": room.id,
                    "chambre_numero": str(room.number),
                    "type_chambre": room.room_type.name if room.room_type_id else "-",
                    "etage": str(room.floor) if room.floor else "-",
                    "tarif": float(room.effective_price_per_night or 0),
                    "score": min(score, 100),
                    "reasons": reasons,
                }
            )
        suggestions.sort(key=lambda item: item["score"], reverse=True)
        for index, item in enumerate(suggestions, start=1):
            item["rang"] = index

        files_prioritaires = []
        hk_tasks = (
            RoomHousekeepingTask.objects.select_related("room", "assigned_to")
            .filter(hotel=hotel, status__in=[RoomHousekeepingTask.Status.PENDING, RoomHousekeepingTask.Status.IN_PROGRESS])
            .order_by("-priority", "requested_at")[:10]
        )
        for task in hk_tasks:
            elapsed = int((now - task.started_at).total_seconds() // 60) if task.started_at else 0
            attente = int((now - task.requested_at).total_seconds() // 60) if task.status == RoomHousekeepingTask.Status.PENDING else 0
            estimate = task.estimated_minutes or 30
            en_retard = (task.status == RoomHousekeepingTask.Status.IN_PROGRESS and elapsed > estimate) or (
                task.status == RoomHousekeepingTask.Status.PENDING and attente > 20
            )
            files_prioritaires.append(
                {
                    "task_id": task.id,
                    "chambre_numero": str(task.room.number) if task.room_id else "?",
                    "type_tache": task.task_type,
                    "type_tache_display": task.get_task_type_display(),
                    "priorite": task.priority,
                    "priorite_display": task.get_priority_display(),
                    "statut": "en_cours" if task.status == RoomHousekeepingTask.Status.IN_PROGRESS else "a_nettoyer",
                    "agent_nom": task.assigned_to.get_full_name().strip() or task.assigned_to.username if task.assigned_to_id else None,
                    "elapsed_min": elapsed,
                    "attente_min": attente,
                    "temps_estime": estimate,
                    "progression_pct": min(100, round((elapsed / estimate) * 100)) if task.started_at else 0,
                    "en_retard": en_retard,
                }
            )

        payload = {
            "disponibles": disponibles,
            "occupees": occupees,
            "nettoyage": nettoyage,
            "hors_service": hors_service,
            "taux_occupation_pct": taux_occ,
            "arrivees_today": arrivees_qs.count(),
            "departs_today": departs_qs.count(),
            "revpar": revpar,
            "solde_total_impaye": solde_total,
            "rooms": list(rooms_data),
            "departs_liste": departs_liste,
            "arrivees_liste": arrivees_liste,
            "suggestions": suggestions,
            "files_prioritaires": files_prioritaires,
        }
        return Response(payload)


class RoomRateRuleViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomRateRuleSerializer
    permission_classes = [RoomInventoryPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"

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
    permission_module = "rooms"
    business_action_map = {
        "create": "housekeeping.assign",
        "update": "housekeeping.assign",
        "partial_update": "housekeeping.assign",
        "start": "housekeeping.start",
        "complete": "housekeeping.complete",
        "task_action": "housekeeping.start",
    }

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

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        hotel = getattr(request, "active_hotel", None)
        if hotel is None:
            return Response({"detail": "Aucun hotel actif."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        tasks_qs = (
            self.scope_queryset(
                RoomHousekeepingTask.objects.select_related("room", "room__room_type", "assigned_to")
                .filter(Q(requested_at__date=today) | Q(status__in=[RoomHousekeepingTask.Status.PENDING, RoomHousekeepingTask.Status.IN_PROGRESS]))
            )
            .order_by("-priority", "requested_at")
        )
        tasks_data = HousekeepingTaskEnhancedSerializer(tasks_qs, many=True, context={"request": request}).data

        a_nettoyer = [t for t in tasks_data if t["statut"] == RoomHousekeepingTask.Status.PENDING and not t["probleme_signale"]]
        en_cours = [t for t in tasks_data if t["statut"] == RoomHousekeepingTask.Status.IN_PROGRESS and not t["probleme_signale"]]
        termines = [t for t in tasks_data if t["statut"] == RoomHousekeepingTask.Status.COMPLETED]
        problemes = [t for t in tasks_data if t["probleme_signale"] and t["statut"] != RoomHousekeepingTask.Status.COMPLETED]
        en_retard = [t for t in tasks_data if t["est_en_retard"]]
        non_attrib = [t for t in tasks_data if not t["agent_nom"] and t["statut"] in {RoomHousekeepingTask.Status.PENDING, RoomHousekeepingTask.Status.IN_PROGRESS}]

        durees = []
        for task in tasks_qs.filter(status=RoomHousekeepingTask.Status.COMPLETED):
            if task.started_at and task.completed_at:
                durees.append((task.completed_at - task.started_at).total_seconds() / 60)
            elif task.actual_minutes:
                durees.append(task.actual_minutes)
        duree_moy = round(sum(durees) / len(durees), 1) if durees else 0

        active_agent_ids = set(
            tasks_qs.filter(status=RoomHousekeepingTask.Status.IN_PROGRESS)
            .exclude(assigned_to=None)
            .values_list("assigned_to_id", flat=True)
        )

        agent_map = {}
        for task in tasks_data:
            name = task["agent_nom"]
            if not name:
                continue
            if name not in agent_map:
                agent_map[name] = {
                    "nom": name,
                    "initiales": "".join(part[0].upper() for part in name.split()[:2]) or "?",
                    "taches_total": 0,
                    "taches_terminees": 0,
                    "tache_en_cours": None,
                    "statut": "inactif",
                }
            agent_map[name]["taches_total"] += 1
            if task["statut"] == RoomHousekeepingTask.Status.COMPLETED:
                agent_map[name]["taches_terminees"] += 1
            if task["statut"] == RoomHousekeepingTask.Status.IN_PROGRESS:
                agent_map[name]["tache_en_cours"] = f"Ch. {task['chambre_numero']}"
                agent_map[name]["statut"] = "actif"

        agents_list = []
        for agent in agent_map.values():
            total = agent["taches_total"]
            agent["progression_pct"] = round((agent["taches_terminees"] / total) * 100) if total else 0
            agents_list.append(agent)
        if non_attrib:
            agents_list.append(
                {
                    "nom": "Non attribue",
                    "initiales": "-",
                    "taches_total": len(non_attrib),
                    "taches_terminees": 0,
                    "tache_en_cours": None,
                    "statut": "a_assigner",
                    "progression_pct": 0,
                    "detail": ", ".join(f"Ch. {task['chambre_numero']}" for task in non_attrib[:4]),
                }
            )

        alertes = []
        for task in en_retard:
            if task["statut"] == RoomHousekeepingTask.Status.IN_PROGRESS:
                alertes.append(
                    {
                        "type": "critique",
                        "chambre": task["chambre_numero"],
                        "message": (
                            f"Tache en cours depuis {task['duree_ecoulee_min']} min - "
                            f"depassement de {task['retard_min']} min"
                        ),
                        "time": "Retard",
                    }
                )
            elif task["statut"] == RoomHousekeepingTask.Status.PENDING:
                alertes.append(
                    {
                        "type": "warning",
                        "chambre": task["chambre_numero"],
                        "message": f"En attente depuis {task['attente_min']} min sans demarrage",
                        "time": f"{task['attente_min']} min",
                    }
                )
        for task in problemes:
            alertes.append(
                {
                    "type": "critique",
                    "chambre": task["chambre_numero"],
                    "message": f"Probleme signale : {task['probleme_signale']}",
                    "time": "Probleme",
                }
            )
        for task in termines[-3:]:
            alertes.append(
                {
                    "type": "ok",
                    "chambre": task["chambre_numero"],
                    "message": f"{task['type_tache_display']} termine - chambre prete",
                    "time": "Termine",
                }
            )

        stats_par_type = {}
        total_tasks = len(tasks_data)
        for task in tasks_data:
            key = task["type_tache"]
            stats_par_type.setdefault(key, {"label": task["type_tache_display"], "count": 0, "pct": 0})
            stats_par_type[key]["count"] += 1
        for item in stats_par_type.values():
            item["pct"] = round((item["count"] / total_tasks) * 100) if total_tasks else 0

        durations_by_agent = {}
        for task in tasks_qs.filter(status=RoomHousekeepingTask.Status.COMPLETED).exclude(assigned_to=None):
            name = task.assigned_to.get_full_name().strip() or task.assigned_to.username
            if task.started_at and task.completed_at:
                duration = (task.completed_at - task.started_at).total_seconds() / 60
            else:
                duration = task.actual_minutes or 0
            durations_by_agent.setdefault(name, []).append(duration)
        stats_agent = [
            {"nom": name, "duree_moy_min": round(sum(values) / len(values), 1) if values else 0, "pct": 0}
            for name, values in durations_by_agent.items()
        ]
        max_duration = max((item["duree_moy_min"] for item in stats_agent), default=1) or 1
        for item in stats_agent:
            item["pct"] = round((item["duree_moy_min"] / max_duration) * 100)

        response_data = {
            "a_nettoyer_count": len(a_nettoyer),
            "en_cours_count": len(en_cours),
            "termine_count": len(termines),
            "duree_moyenne_min": duree_moy,
            "en_retard_count": len(en_retard),
            "agents_actifs_count": len(active_agent_ids),
            "non_attribuees_count": len(non_attrib),
            "kanban_a_nettoyer": a_nettoyer,
            "kanban_en_cours": en_cours,
            "kanban_termine": termines,
            "kanban_probleme": problemes,
            "agents": agents_list,
            "alertes": alertes,
            "stats_par_type": stats_par_type,
            "stats_duree_par_agent": stats_agent,
            "stats_duree_moyenne": duree_moy,
        }
        return Response(response_data)

    @action(detail=True, methods=["post"], url_path=r"action/(?P<task_action>[^/.]+)")
    def task_action(self, request, pk=None, task_action=None):
        task = self.get_object()
        action_permissions = {
            "demarrer": "housekeeping.start",
            "terminer": "housekeeping.complete",
            "signaler_probleme": "housekeeping.report_problem",
            "assigner": "housekeeping.assign",
            "suspendre": "housekeeping.assign",
        }
        required_permission = action_permissions.get(task_action)
        if required_permission and not PermissionService.can_perform_action(request.user, required_permission, strict=True):
            return Response({"detail": "Permission metier insuffisante."}, status=status.HTTP_403_FORBIDDEN)

        if task_action == "demarrer":
            if task.status != task.Status.PENDING:
                return Response({"error": "Tache deja demarree"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = task.Status.IN_PROGRESS
            task.started_at = task.started_at or timezone.now()
            task.save(update_fields=["status", "started_at", "updated_at"])

        elif task_action == "terminer":
            if task.status not in {task.Status.PENDING, task.Status.IN_PROGRESS}:
                return Response({"error": "Impossible de terminer cette tache"}, status=status.HTTP_400_BAD_REQUEST)
            now = timezone.now()
            task.started_at = task.started_at or now
            task.completed_at = now
            task.actual_minutes = max(int((task.completed_at - task.started_at).total_seconds() / 60), 0)
            task.status = task.Status.COMPLETED
            task.save(update_fields=["started_at", "completed_at", "actual_minutes", "status", "updated_at"])

        elif task_action == "signaler_probleme":
            issue = (request.data.get("probleme") or "").strip()
            if not issue:
                return Response({"error": "Message du probleme requis"}, status=status.HTTP_400_BAD_REQUEST)
            task.issue_reported = issue
            task.save(update_fields=["issue_reported", "updated_at"])

        elif task_action == "assigner":
            agent_id = request.data.get("agent_id")
            if not agent_id:
                return Response({"error": "agent_id requis"}, status=status.HTTP_400_BAD_REQUEST)
            task.assigned_to_id = agent_id
            try:
                task.save(update_fields=["assigned_to", "updated_at"])
            except Exception as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        elif task_action == "suspendre":
            if task.status != task.Status.IN_PROGRESS:
                return Response({"error": "Tache non en cours"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = task.Status.PENDING
            task.save(update_fields=["status", "updated_at"])

        else:
            return Response({"error": f"Action inconnue: {task_action}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(HousekeepingTaskEnhancedSerializer(task, context={"request": request}).data)


class RoomMaintenanceIncidentViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomMaintenanceIncidentSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"
    business_action_map = {
        "create": "maintenance.create",
        "update": "maintenance.create",
        "partial_update": "maintenance.create",
        "resolve": "maintenance.resolve",
    }

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


class RoomLiveStatusViewSet(HotelScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = RoomLiveStatusSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"

    def get_queryset(self):
        queryset = RoomLiveStatus.objects.select_related("room", "room__room_type").order_by("room__floor", "room__number")
        queryset = self.scope_queryset(queryset)

        hotel_status = self.request.query_params.get("hotel_status")
        presence = self.request.query_params.get("presence_status")
        if hotel_status:
            queryset = queryset.filter(hotel_status=hotel_status)
        if presence:
            queryset = queryset.filter(presence_status=presence)
        return queryset


class RoomAlertViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomAlertSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"
    business_action_map = {
        "resolve": "maintenance.resolve",
    }

    def get_queryset(self):
        queryset = RoomAlert.objects.select_related("room").order_by("-created_at")
        queryset = self.scope_queryset(queryset)

        is_active = self.request.query_params.get("is_active")
        severity = self.request.query_params.get("severity")
        room_id = self.request.query_params.get("room")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=is_active == "true")
        if severity:
            queryset = queryset.filter(severity=severity)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None))

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.is_active = False
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["is_active", "resolved_at"])
        return Response(self.get_serializer(alert).data)


class RoomSensorViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomSensorSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"

    def get_queryset(self):
        queryset = RoomSensor.objects.select_related("room").order_by("room__number", "sensor_type")
        queryset = self.scope_queryset(queryset)

        status_code = self.request.query_params.get("status")
        room_id = self.request.query_params.get("room")
        sensor_type = self.request.query_params.get("sensor_type")
        if status_code:
            queryset = queryset.filter(status=status_code)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        if sensor_type:
            queryset = queryset.filter(sensor_type=sensor_type)
        return queryset

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None))


class SensorEventViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = SensorEventSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = SensorEvent.objects.select_related("room", "sensor").order_by("-created_at")
        queryset = self.scope_queryset(queryset)

        room_id = self.request.query_params.get("room")
        event_type = self.request.query_params.get("event_type")
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        return queryset[:200]

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None))


class EnergyReadingViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = EnergyReadingSerializer
    permission_classes = [RoomOperationsPermission]
    hotel_scope_module = "rooms"
    permission_module = "rooms"
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = EnergyReading.objects.select_related("room").order_by("-recorded_at")
        queryset = self.scope_queryset(queryset)

        room_id = self.request.query_params.get("room")
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset[:500]

    def perform_create(self, serializer):
        serializer.save(hotel=getattr(self.request, "active_hotel", None))
