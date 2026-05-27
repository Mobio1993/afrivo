from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Prefetch, Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.consumptions.models import ClientConsumption, ClientConsumptionItem, ServiceDepartment
from apps.consumptions.serializers import ClientConsumptionSerializer, ServiceDepartmentSerializer
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.tenancy.drf import AuthenticatedHotelPermission, HotelScopedQuerysetMixin


class ServiceDepartmentViewSet(viewsets.ModelViewSet):
    queryset = ServiceDepartment.objects.all().order_by("name", "-id")
    serializer_class = ServiceDepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        active = self.request.query_params.get("is_active")
        department_type = self.request.query_params.get("department_type")

        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        if department_type:
            queryset = queryset.filter(department_type=department_type)
        return queryset


class ClientConsumptionViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ClientConsumptionSerializer
    permission_classes = [AuthenticatedHotelPermission]
    hotel_scope_module = "consumptions"

    def get_queryset(self):
        queryset = (
            ClientConsumption.objects.select_related(
                "client",
                "stay",
                "reservation",
                "room",
                "service_department",
                "created_by",
            )
            .prefetch_related(Prefetch("items", queryset=ClientConsumptionItem.objects.order_by("sort_order", "id")))
            .order_by("-service_date", "-id")
        )
        queryset = self.scope_queryset(queryset)

        client_id = self.request.query_params.get("client")
        stay_id = self.request.query_params.get("stay")
        reservation_id = self.request.query_params.get("reservation")
        room_id = self.request.query_params.get("room")
        department_id = self.request.query_params.get("service_department") or self.request.query_params.get("service")
        status_value = self.request.query_params.get("status")
        payment_status = self.request.query_params.get("payment_status")
        source = self.request.query_params.get("source")
        tenant_code = self.request.query_params.get("tenant_code")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = (self.request.query_params.get("search") or "").strip()

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if stay_id:
            queryset = queryset.filter(stay_id=stay_id)
        if reservation_id:
            queryset = queryset.filter(reservation_id=reservation_id)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        if department_id:
            queryset = queryset.filter(service_department_id=department_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if source:
            queryset = queryset.filter(source=source)
        if tenant_code:
            queryset = queryset.filter(tenant_code=tenant_code)
        if date_from:
            queryset = queryset.filter(service_date__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(service_date__date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(label__icontains=search)
                | Q(description__icontains=search)
                | Q(reservation__reference__icontains=search)
                | Q(stay__reference__icontains=search)
                | Q(room__number__icontains=search)
                | Q(client__first_name__icontains=search)
                | Q(client__last_name__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        consumption = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=consumption.reference,
            description=f"Consommation client creee : {consumption.reference}.",
            actor=self.request.user,
            metadata={
                "consumption_id": consumption.id,
                "client_id": consumption.client_id,
                "stay_id": consumption.stay_id,
                "department_id": consumption.service_department_id,
                "status": consumption.status,
            },
        )

    def perform_update(self, serializer):
        consumption = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=consumption.reference,
            description=f"Consommation client mise a jour : {consumption.reference}.",
            actor=self.request.user,
            metadata={
                "consumption_id": consumption.id,
                "client_id": consumption.client_id,
                "stay_id": consumption.stay_id,
                "department_id": consumption.service_department_id,
                "status": consumption.status,
                "payment_status": consumption.payment_status,
            },
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        note = (request.data.get("note") or "").strip() if hasattr(request, "data") else ""
        try:
            instance.cancel(note=note or "Annulation via API.")
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=instance.reference,
            description=f"Consommation client annulee : {instance.reference}.",
            actor=request.user,
            metadata={"consumption_id": instance.id, "status": instance.status},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="post")
    def post_consumption(self, request, pk=None):
        consumption = self.get_object()
        try:
            consumption.mark_as_posted()
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=consumption.reference,
            description=f"Consommation client validee : {consumption.reference}.",
            actor=request.user,
            metadata={"consumption_id": consumption.id, "status": consumption.status},
        )
        return Response(self.get_serializer(consumption).data)

    @action(detail=True, methods=["post"], url_path="bill")
    def bill_consumption(self, request, pk=None):
        consumption = self.get_object()
        billing_reference = (request.data.get("billing_reference") or "").strip()
        try:
            consumption.mark_as_billed(billing_reference=billing_reference)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=consumption.reference,
            description=f"Consommation client facturee : {consumption.reference}.",
            actor=request.user,
            metadata={
                "consumption_id": consumption.id,
                "status": consumption.status,
                "billing_reference": consumption.billing_reference,
            },
        )
        return Response(self.get_serializer(consumption).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_consumption(self, request, pk=None):
        consumption = self.get_object()
        note = (request.data.get("note") or "").strip()
        try:
            consumption.cancel(note=note)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="consumptions",
            entity_type="ClientConsumption",
            entity_reference=consumption.reference,
            description=f"Consommation client annulee : {consumption.reference}.",
            actor=request.user,
            metadata={"consumption_id": consumption.id, "status": consumption.status},
        )
        return Response(self.get_serializer(consumption).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset()).exclude(status=ClientConsumption.Status.CANCELLED)
        totals = queryset.aggregate(
            total_amount=Sum("total_amount"),
            total_count=Count("id"),
            distinct_clients=Count("client", distinct=True),
            distinct_stays=Count("stay", distinct=True),
        )
        by_status = list(queryset.values("status").annotate(total_amount=Sum("total_amount"), count=Count("id")).order_by("status"))
        by_department = list(
            queryset.values("service_department_id", "service_department__name")
            .annotate(total_amount=Sum("total_amount"), count=Count("id"))
            .order_by("service_department__name")
        )
        by_client = list(
            queryset.values("client_id", "client__first_name", "client__last_name")
            .annotate(total_amount=Sum("total_amount"), count=Count("id"))
            .order_by("-total_amount", "client__last_name")
        )
        by_stay = list(
            queryset.exclude(stay_id__isnull=True)
            .values("stay_id", "stay__reference")
            .annotate(total_amount=Sum("total_amount"), count=Count("id"))
            .order_by("-total_amount", "stay__reference")
        )

        return Response(
            {
                "filters": {
                "client": request.query_params.get("client"),
                "stay": request.query_params.get("stay"),
                "reservation": request.query_params.get("reservation"),
                "room": request.query_params.get("room"),
                "service_department": request.query_params.get("service_department") or request.query_params.get("service"),
                "status": request.query_params.get("status"),
                "payment_status": request.query_params.get("payment_status"),
                "source": request.query_params.get("source"),
                "date_from": request.query_params.get("date_from"),
                "date_to": request.query_params.get("date_to"),
                    "tenant_code": request.query_params.get("tenant_code"),
                },
                "totals": totals,
                "by_status": by_status,
                "by_department": by_department,
                "by_client": by_client,
                "by_stay": by_stay,
            }
        )
