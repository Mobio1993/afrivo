from django.db.models import Count, Prefetch, Q, Sum

from apps.billing.models import ClientInvoice, ClientInvoiceItem, Payment
from apps.consumptions.models import ClientConsumption


def get_invoice_queryset():
    return (
        ClientInvoice.objects.select_related("client", "stay", "reservation", "day_use", "issued_by")
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


def filter_invoice_queryset(queryset, query_params):
    client_id = query_params.get("client")
    stay_id = query_params.get("stay")
    reservation_id = query_params.get("reservation")
    status_value = query_params.get("status")
    date_from = query_params.get("date_from")
    date_to = query_params.get("date_to")
    search = (query_params.get("search") or "").strip()

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


def get_invoice_summary(queryset):
    queryset = queryset.exclude(status=ClientInvoice.Status.CANCELLED)
    return {
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


def get_eligible_consumptions_queryset():
    return ClientConsumption.objects.select_related(
        "client",
        "stay",
        "reservation",
        "room",
        "service_department",
    ).exclude(status=ClientConsumption.Status.CANCELLED)


def filter_eligible_consumptions_queryset(queryset, query_params):
    client_id = query_params.get("client")
    stay_id = query_params.get("stay")

    if client_id:
        queryset = queryset.filter(client_id=client_id)
    if stay_id:
        queryset = queryset.filter(stay_id=stay_id)

    return queryset.exclude(
        invoice_items__invoice__status__in=[
            ClientInvoice.Status.DRAFT,
            ClientInvoice.Status.ISSUED,
            ClientInvoice.Status.PARTIALLY_PAID,
            ClientInvoice.Status.PAID,
        ]
    )


def build_eligible_consumptions_payload(queryset):
    return [
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


def get_payment_queryset():
    return (
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


def filter_payment_queryset(queryset, query_params):
    client_id = query_params.get("client")
    stay_id = query_params.get("stay")
    invoice_id = query_params.get("invoice")
    reservation_id = query_params.get("reservation") or query_params.get("booking")
    method = query_params.get("payment_method") or query_params.get("method")
    status_value = query_params.get("status")
    payment_type = query_params.get("payment_type")
    date_from = query_params.get("date_from")
    date_to = query_params.get("date_to")
    search = (query_params.get("search") or "").strip()

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


def get_payment_summary(queryset):
    queryset = queryset.exclude(status=Payment.Status.CANCELLED)
    return {
        "totals": queryset.aggregate(
            payment_count=Count("id"),
            confirmed_amount=Sum("amount", filter=Q(status=Payment.Status.PAID)),
            pending_amount=Sum("amount", filter=Q(status=Payment.Status.PENDING)),
            refunded_amount=Sum("amount", filter=Q(status=Payment.Status.REFUNDED)),
        ),
        "by_method": list(queryset.values("method").annotate(count=Count("id"), total_amount=Sum("amount"))),
        "by_type": list(queryset.values("payment_type").annotate(count=Count("id"), total_amount=Sum("amount"))),
    }
