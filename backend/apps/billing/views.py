from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from apps.billing.models import ClientInvoice, Payment
from apps.billing.permissions import BillingPermission
from apps.billing.selectors import (
    build_eligible_consumptions_payload,
    filter_eligible_consumptions_queryset,
    filter_invoice_queryset,
    filter_payment_queryset,
    get_eligible_consumptions_queryset,
    get_invoice_queryset,
    get_invoice_summary,
    get_payment_queryset,
    get_payment_summary,
)
from apps.billing.serializers import ClientInvoiceSerializer, ClientPaymentSerializer
from apps.billing.services import (
    build_invoice_pdf_payload,
    cancel_payment,
    confirm_payment,
    create_invoice_from_day_use,
    create_invoice_from_stay,
    create_invoice_payment,
    duplicate_invoice as duplicate_client_invoice,
    get_billing_dashboard,
    get_client_balance,
)
from apps.bookings.models import DayUse
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService
from apps.tenancy.drf import HotelScopedQuerysetMixin
from apps.tenants.services.tenant_service import TenantService
from apps.stays.models import Stay

scope_queryset_to_hotel = TenantService.scope_queryset_to_hotel
log_history = HotelAuditService.log_history


class ClientInvoiceViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ClientInvoiceSerializer
    permission_classes = [BillingPermission]
    hotel_scope_module = "billing"
    permission_module = "billing"
    permission_action_map = {
        "eligible_consumptions": "view",
        "summary": "view",
        "issue_invoice": "update",
        "cancel_invoice": "update",
        "duplicate_invoice": "create",
        "add_payment_to_invoice": "create",
        "create_from_stay": "create",
        "create_from_day_use": "create",
        "pdf_payload": "view",
        "receipt_payload": "view",
    }
    business_action_map = {
        "create": "billing.validate_invoice",
        "update": "billing.validate_invoice",
        "partial_update": "billing.validate_invoice",
        "destroy": "billing.cancel_invoice",
        "issue_invoice": "billing.issue_invoice",
        "cancel_invoice": "billing.cancel_invoice",
        "duplicate_invoice": "billing.validate_invoice",
        "add_payment_to_invoice": "payments.record",
        "create_from_stay": "billing.issue_invoice",
        "create_from_day_use": "billing.issue_invoice",
    }

    def get_queryset(self):
        queryset = get_invoice_queryset()
        queryset = self.scope_queryset(queryset)
        return filter_invoice_queryset(queryset, self.request.query_params)

    def perform_create(self, serializer):
        invoice = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=invoice.reference,
            description=f"Facture client creee : {invoice.reference}.",
            actor=self.request.user,
            metadata={
                "invoice_id": invoice.id,
                "client_id": invoice.client_id,
                "stay_id": invoice.stay_id,
                "reservation_id": invoice.reservation_id,
                "status": invoice.status,
            },
        )

    def perform_update(self, serializer):
        invoice = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=invoice.reference,
            description=f"Facture client mise a jour : {invoice.reference}.",
            actor=self.request.user,
            metadata={
                "invoice_id": invoice.id,
                "status": invoice.status,
                "amount_paid": str(invoice.amount_paid),
                "balance_due": str(invoice.balance_due),
            },
        )

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        note = (request.data.get("note") or "").strip() if hasattr(request, "data") else ""
        try:
            invoice.cancel(note=note or "Annulation via API.")
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=invoice.reference,
            description=f"Facture client annulee : {invoice.reference}.",
            actor=request.user,
            metadata={"invoice_id": invoice.id, "status": invoice.status},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="issue")
    def issue_invoice(self, request, pk=None):
        invoice = self.get_object()
        try:
            invoice.issue()
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=invoice.reference,
            description=f"Facture {invoice.reference} emise.",
            actor=request.user,
            metadata={"invoice_id": invoice.id, "status": invoice.status},
        )
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_invoice(self, request, pk=None):
        invoice = self.get_object()
        note = (request.data.get("note") or "").strip()
        try:
            invoice.cancel(note=note)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=invoice.reference,
            description=f"Facture {invoice.reference} annulee.",
            actor=request.user,
            metadata={"invoice_id": invoice.id, "status": invoice.status, "note": note},
        )
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate_invoice(self, request, pk=None):
        source = self.get_object()
        duplicate = duplicate_client_invoice(source, request.user)

        log_history(
            action_type=HistoryEntry.ActionType.OTHER,
            module="billing",
            entity_type="ClientInvoice",
            entity_reference=duplicate.reference,
            description=f"Facture {source.reference} dupliquee en {duplicate.reference}.",
            actor=request.user,
            metadata={"invoice_id": duplicate.id, "source_invoice_id": source.id, "status": duplicate.status},
        )
        return Response(self.get_serializer(duplicate).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-payment")
    def add_payment_to_invoice(self, request, pk=None):
        invoice = self.get_object()
        try:
            payment = create_invoice_payment(
                invoice,
                request.data,
                ClientPaymentSerializer,
                {"request": request},
                request.user,
            )
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        invoice.refresh_from_db()
        return Response(
            {
                "payment": ClientPaymentSerializer(payment, context={"request": request}).data,
                "invoice": self.get_serializer(invoice).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf_payload(self, request, pk=None):
        invoice = self.get_object()
        return Response(build_invoice_pdf_payload(invoice))

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt_payload(self, request, pk=None):
        invoice = self.get_object()
        payload = build_invoice_pdf_payload(invoice)
        payload["type"] = "receipt"
        payload["receipt"] = {
            "reference": invoice.reference,
            "amount_paid": str(invoice.amount_paid),
            "balance_due": str(invoice.balance_due),
            "status": invoice.status,
            "status_label": invoice.get_status_display(),
            "currency": invoice.currency,
            "issued_at": invoice.issued_at.isoformat() if invoice.issued_at else None,
        }
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="eligible-consumptions")
    def eligible_consumptions(self, request):
        queryset = get_eligible_consumptions_queryset()
        queryset = self.scope_queryset(queryset)
        queryset = filter_eligible_consumptions_queryset(queryset, request.query_params)
        return Response({"results": build_eligible_consumptions_payload(queryset)})

    @action(detail=False, methods=["post"], url_path="create-from-stay")
    def create_from_stay(self, request):
        stay_id = request.data.get("stay") or request.data.get("stay_id")
        stay = get_object_or_404(
            self.scope_queryset(Stay.objects.select_related("guest", "room", "booking", "hotel")),
            pk=stay_id,
        )
        try:
            invoice = create_invoice_from_stay(stay, user=request.user)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="create-from-day-use")
    def create_from_day_use(self, request):
        day_use_id = request.data.get("day_use") or request.data.get("day_use_id")
        day_use = get_object_or_404(
            self.scope_queryset(DayUse.objects.select_related("guest", "room", "hotel")),
            pk=day_use_id,
        )
        try:
            invoice = create_invoice_from_day_use(day_use, user=request.user)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(get_invoice_summary(queryset))


class ClientPaymentViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ClientPaymentSerializer
    permission_classes = [BillingPermission]
    hotel_scope_module = "billing"
    permission_module = "billing"
    permission_action_map = {
        "summary": "view",
        "confirm_payment": "update",
        "cancel_payment": "update",
    }
    business_action_map = {
        "create": "payments.record",
        "update": "payments.correct",
        "partial_update": "payments.correct",
        "destroy": "payments.cancel",
        "confirm_payment": "payments.correct",
        "cancel_payment": "payments.cancel",
    }

    def get_queryset(self):
        queryset = get_payment_queryset()
        queryset = self.scope_queryset(queryset)
        return filter_payment_queryset(queryset, self.request.query_params)

    def perform_create(self, serializer):
        payment = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.PAYMENT_RECORDED,
            module="billing",
            entity_type="Payment",
            entity_reference=payment.reference,
            description=f"Paiement client enregistre : {payment.reference}.",
            actor=self.request.user,
            metadata={
                "payment_id": payment.id,
                "client_id": payment.client_id,
                "stay_id": payment.stay_id,
                "invoice_id": payment.invoice_id,
                "booking_id": payment.booking_id,
                "status": payment.status,
                "payment_type": payment.payment_type,
                "method": payment.method,
            },
        )

    def perform_update(self, serializer):
        payment = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="billing",
            entity_type="Payment",
            entity_reference=payment.reference,
            description=f"Paiement client mis a jour : {payment.reference}.",
            actor=self.request.user,
            metadata={
                "payment_id": payment.id,
                "status": payment.status,
                "payment_type": payment.payment_type,
                "amount": str(payment.amount),
            },
        )

    def destroy(self, request, *args, **kwargs):
        payment = self.get_object()
        try:
            cancel_payment(payment)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm_payment(self, request, pk=None):
        payment = self.get_object()
        try:
            confirm_payment(payment)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_payment(self, request, pk=None):
        payment = self.get_object()
        try:
            cancel_payment(payment)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(payment).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(get_payment_summary(queryset))


@api_view(["GET"])
@permission_classes([BillingPermission])
def billing_dashboard_api(request):
    hotel = getattr(request, "active_hotel", None)
    if not hotel:
        return Response({"detail": "Aucun hotel associe a ce compte."}, status=status.HTTP_403_FORBIDDEN)
    period = request.query_params.get("period", "today")
    return Response(get_billing_dashboard(hotel, period=period))


@api_view(["GET"])
@permission_classes([BillingPermission])
def client_balance_api(request, client_id):
    hotel = getattr(request, "active_hotel", None)
    if not hotel:
        return Response({"detail": "Aucun hotel associe a ce compte."}, status=status.HTTP_403_FORBIDDEN)
    client = get_object_or_404(scope_queryset_to_hotel(Guest.objects.all(), request), pk=client_id)
    return Response(get_client_balance(client, hotel))
