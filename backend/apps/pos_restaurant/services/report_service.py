from django.db.models import Count, Sum
from django.utils import timezone


class ReportService:
    @staticmethod
    def daily_summary(restaurant, date=None):
        from ..models import Bill, Order, Payment

        date = date or timezone.now().date()
        bills = Bill.objects.filter(order__table__area__restaurant=restaurant, created_at__date=date, statut="payee")
        return {
            "date": str(date),
            "nb_commandes": bills.count(),
            "commandes_ouvertes": Order.objects.filter(table__area__restaurant=restaurant, created_at__date=date)
            .exclude(statut__in=["payee", "annulee"])
            .count(),
            "chiffre_affaires": float(bills.aggregate(total=Sum("total"))["total"] or 0),
            "par_mode": list(
                Payment.objects.filter(bill__in=bills)
                .values("mode")
                .annotate(total=Sum("montant"), nb=Count("id"))
                .order_by("mode")
            ),
        }
