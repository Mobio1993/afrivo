from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.billing.models import Payment
from apps.billing.services import cancel_payment, confirm_payment
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.payments.serializers import PaymentDetailSerializer, PaymentSerializer
from apps.payments.services import get_payments_summary
from apps.tenancy.drf import AuthenticatedHotelPermission, HotelScopedQuerysetMixin


class PaymentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "total_pages": self.page.paginator.num_pages,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data,
        })


class PaymentViewSet(HotelScopedQuerysetMixin, viewsets.ModelViewSet):
    pagination_class = PaymentPagination
    serializer_class = PaymentSerializer
    permission_classes = [AuthenticatedHotelPermission]
    hotel_scope_module = "payments"
    permission_module = "payments"
    permission_action_map = {
        "summary": "view",
        "confirm_payment": "update",
        "cancel_payment": "update",
        "refund_payment": "update",
        "annuler": "update",
        "rembourser": "update",
    }

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PaymentDetailSerializer
        return PaymentSerializer

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
        ordering = self.request.query_params.get("ordering")
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

        ordering_map = {
            "-created_at": ("-created_at", "-id"),
            "created_at": ("created_at", "id"),
            "-paid_at": ("-paid_at", "-id"),
            "paid_at": ("paid_at", "id"),
            "-amount": ("-amount", "-id"),
            "amount": ("amount", "id"),
            "client__name": ("client__last_name", "client__first_name", "id"),
        }
        queryset = queryset.order_by(*ordering_map.get(ordering, ("-paid_at", "-id")))

        return queryset

    def perform_create(self, serializer):
        payment = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.PAYMENT_RECORDED,
            module="payments",
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
            module="payments",
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
        except Exception as error:
            return Response({"detail": str(error)}, status=400)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm_payment(self, request, pk=None):
        payment = self.get_object()
        try:
            confirm_payment(payment)
        except Exception as error:
            return Response({"detail": str(error)}, status=400)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_payment(self, request, pk=None):
        payment = self.get_object()
        try:
            cancel_payment(payment)
        except Exception as error:
            return Response({"detail": str(error)}, status=400)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"], url_path="refund")
    def refund_payment(self, request, pk=None):
        payment = self.get_object()
        if payment.status == Payment.Status.REFUNDED:
            return Response({"detail": "Paiement deja rembourse."}, status=400)
        if payment.status == Payment.Status.CANCELLED:
            return Response({"detail": "Un paiement annule ne peut pas etre rembourse."}, status=400)

        payment.status = Payment.Status.REFUNDED
        payment.payment_type = Payment.PaymentType.REFUND
        payment.save(update_fields=["status", "payment_type", "updated_at"])
        return Response(PaymentDetailSerializer(payment, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="annuler")
    def annuler(self, request, pk=None):
        return self.cancel_payment(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="rembourser")
    def rembourser(self, request, pk=None):
        return self.refund_payment(request, pk=pk)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        return Response(get_payments_summary(self.filter_queryset(self.get_queryset())))
