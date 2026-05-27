from django.db.models import Count, Q, Sum

from apps.billing.models import Payment


def get_payments_summary(queryset):
    active_queryset = queryset.exclude(status=Payment.Status.CANCELLED)
    return {
        "totals": active_queryset.aggregate(
            payment_count=Count("id"),
            confirmed_amount=Sum("amount", filter=Q(status=Payment.Status.PAID)),
            pending_amount=Sum("amount", filter=Q(status=Payment.Status.PENDING)),
            refunded_amount=Sum("amount", filter=Q(status=Payment.Status.REFUNDED)),
        ),
        "by_method": list(active_queryset.values("method").annotate(count=Count("id"), total_amount=Sum("amount"))),
        "by_type": list(active_queryset.values("payment_type").annotate(count=Count("id"), total_amount=Sum("amount"))),
    }
