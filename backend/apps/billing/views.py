from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Prefetch, Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.billing.models import ClientInvoice, ClientInvoiceItem, Payment
from apps.billing.serializers import ClientInvoiceSerializer, ClientPaymentSerializer
from apps.consumptions.models import ClientConsumption
from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.tenancy.drf import AuthenticatedHotelPermission, HotelScopedQuerysetMixin


class ClientInvoiceViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ClientInvoiceSerializer
    permission_classes = [AuthenticatedHotelPermission]
    hotel_scope_module = "billing"
    permission_module = "billing"
    permission_action_map = {
        "eligible_consumptions": "view",
        "summary": "view",
        "issue_invoice": "update",
        "cancel_invoice": "update",
    }

    def get_queryset(self):
        queryset = (
            ClientInvoice.objects.select_related("client", "stay", "reservation", "issued_by")
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=ClientInvoiceItem.objects.select_related(
                        "consumption",
                        "service_department",
                        "room",
                    ),
                ),
                Prefetch(
                    "payments",
                    queryset=Payment.objects.select_related(
                        "client",
                        "stay",
                        "booking",
                        "day_use",
                        "invoice",
                        "recorded_by",
                    ),
                ),
            )
            .order_by("-issued_at", "-id")
        )
        queryset = self.scope_queryset(queryset)

        client_id = self.request.query_params.get("client")
        stay_id = self.request.query_params.get("stay")
        reservation_id = self.request.query_params.get("reservation")
        status_value = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = (self.request.query_params.get("search") or "").strip()

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if stay_id:
            queryset = queryset.filter(stay_id=stay_id)
        if reservation_id:
            queryset = queryset.filter(reservation_id=reservation_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(issued_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(issued_at__date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(client__first_name__icontains=search)
                | Q(client__last_name__icontains=search)
                | Q(stay__reference__icontains=search)
                | Q(reservation__reference__icontains=search)
                | Q(items__label__icontains=search)
            ).distinct()

        return queryset

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
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_invoice(self, request, pk=None):
        invoice = self.get_object()
        note = (request.data.get("note") or "").strip()
        try:
            invoice.cancel(note=note)
        except DjangoValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invoice).data)

    @action(detail=False, methods=["get"], url_path="eligible-consumptions")
    def eligible_consumptions(self, request):
        queryset = ClientConsumption.objects.select_related("client", "stay", "reservation", "room", "service_department").exclude(
            status=ClientConsumption.Status.CANCELLED
        )
        queryset = self.scope_queryset(queryset)
        client_id = request.query_params.get("client")
        stay_id = request.query_params.get("stay")

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if stay_id:
            queryset = queryset.filter(stay_id=stay_id)

        queryset = queryset.exclude(
            invoice_items__invoice__status__in=[
                ClientInvoice.Status.DRAFT,
                ClientInvoice.Status.ISSUED,
                ClientInvoice.Status.PARTIALLY_PAID,
                ClientInvoice.Status.PAID,
            ]
        )

        payload = [
            {
                "id": item.id,
                "reference": item.reference,
                "client_id": item.client_id,
                "client_name": item.client.full_name,
                "stay_id": item.stay_id,
                "stay_reference": item.stay.reference if item.stay_id else "",
                "service": item.service_department.name,
                "label": item.label,
                "total_amount": f"{item.total_amount:.2f}",
                "consumed_at": item.service_date.isoformat() if item.service_date else "",
            }
            for item in queryset.order_by("-service_date", "-id")[:100]
        ]
        return Response({"results": payload})

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset()).exclude(status=ClientInvoice.Status.CANCELLED)
        return Response(
            {
                "totals": queryset.aggregate(
                    invoice_count=Count("id"),
                    total_amount=Sum("total_amount"),
                    amount_paid=Sum("amount_paid"),
                    balance_due=Sum("balance_due"),
                ),
                "by_status": list(
                    queryset.values("status").annotate(
                        count=Count("id"),
                        total_amount=Sum("total_amount"),
                        balance_due=Sum("balance_due"),
                    )
                ),
            }
        )


class ClientPaymentViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = ClientPaymentSerializer
    permission_classes = [AuthenticatedHotelPermission]
    hotel_scope_module = "billing"
    permission_module = "billing"
    permission_action_map = {
        "summary": "view",
        "confirm_payment": "update",
        "cancel_payment": "update",
    }

    def get_queryset(self):
        queryset = (
            Payment.objects.select_related(
                "client",
                "stay",
                "booking",
                "day_use",
                "invoice",
                "recorded_by",
            )
            .order_by("-paid_at", "-id")
        )
        queryset = self.scope_queryset(queryset)

        client_id = self.request.query_params.get("client")
        stay_id = self.request.query_params.get("stay")
        invoice_id = self.request.query_params.get("invoice")
        reservation_id = self.request.query_params.get("reservation") or self.request.query_params.get("booking")
        method = self.request.query_params.get("payment_method") or self.request.query_params.get("method")
        status_value = self.request.query_params.get("status")
        payment_type = self.request.query_params.get("payment_type")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = (self.request.query_params.get("search") or "").strip()

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if stay_id:
            queryset = queryset.filter(stay_id=stay_id)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        if reservation_id:
            queryset = queryset.filter(booking_id=reservation_id)
        if method:
            if method == "bank_transfer":
                method = Payment.Method.TRANSFER
            queryset = queryset.filter(method=method)
        if status_value:
            if status_value == "confirmed":
                status_value = Payment.Status.PAID
            queryset = queryset.filter(status=status_value)
        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)
        if date_from:
            queryset = queryset.filter(paid_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(paid_at__date__lte=date_to)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(notes__icontains=search)
                | Q(external_reference__icontains=search)
                | Q(client__first_name__icontains=search)
                | Q(client__last_name__icontains=search)
                | Q(stay__reference__icontains=search)
                | Q(booking__reference__icontains=search)
                | Q(invoice__reference__icontains=search)
            )

        return queryset

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
        if payment.status not in {Payment.Status.PENDING, Payment.Status.PAID}:
            return Response({"detail": "Ce paiement ne peut pas etre annule dans son etat actuel."}, status=400)
        payment.status = Payment.Status.CANCELLED
        payment.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm_payment(self, request, pk=None):
        payment = self.get_object()
        if payment.status != Payment.Status.PENDING:
            return Response({"detail": "Seul un paiement en attente peut etre confirme."}, status=400)
        payment.status = Payment.Status.PAID
        if not payment.payment_type or payment.payment_type == Payment.PaymentType.ADJUSTMENT:
            payment.payment_type = payment.infer_payment_type()
        payment.save(update_fields=["status", "payment_type", "updated_at"])
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_payment(self, request, pk=None):
        payment = self.get_object()
        if payment.status not in {Payment.Status.PENDING, Payment.Status.PAID}:
            return Response({"detail": "Ce paiement ne peut pas etre annule dans son etat actuel."}, status=400)
        payment.status = Payment.Status.CANCELLED
        payment.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(payment).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset()).exclude(status=Payment.Status.CANCELLED)
        return Response(
            {
                "totals": queryset.aggregate(
                    payment_count=Count("id"),
                    confirmed_amount=Sum("amount", filter=Q(status=Payment.Status.PAID)),
                    pending_amount=Sum("amount", filter=Q(status=Payment.Status.PENDING)),
                    refunded_amount=Sum("amount", filter=Q(status=Payment.Status.REFUNDED)),
                ),
                "by_method": list(queryset.values("method").annotate(count=Count("id"), total_amount=Sum("amount"))),
                "by_type": list(queryset.values("payment_type").annotate(count=Count("id"), total_amount=Sum("amount"))),
            }
        )
