from decimal import Decimal
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone

from ..models import Bill, Order, OrderItem, Payment, POSServer


class ServerStatsService:
    PERIODS = {"today", "yesterday", "week", "month"}

    @classmethod
    def apply_date_filters(cls, queryset, params, field="created_at"):
        period = params.get("period") or params.get("date_range")
        start = params.get("start") or params.get("date_start")
        end = params.get("end") or params.get("date_end")
        now = timezone.localdate()

        if period == "today":
            queryset = queryset.filter(**{f"{field}__date": now})
        elif period == "yesterday":
            queryset = queryset.filter(**{f"{field}__date": now - timedelta(days=1)})
        elif period == "week":
            queryset = queryset.filter(**{f"{field}__date__gte": now - timedelta(days=now.weekday())})
        elif period == "month":
            queryset = queryset.filter(**{f"{field}__date__year": now.year, f"{field}__date__month": now.month})

        if start:
            queryset = queryset.filter(**{f"{field}__date__gte": start})
        if end:
            queryset = queryset.filter(**{f"{field}__date__lte": end})
        return queryset

    @classmethod
    def orders_for_server(cls, server, params=None):
        params = params or {}
        query = Q(server=server)
        if server.user_id:
            query |= Q(server__isnull=True, serveur_id=server.user_id)
        queryset = Order.objects.filter(query).select_related(
            "table",
            "table__area",
            "table__area__restaurant",
            "server",
            "serveur",
        ).prefetch_related("items__menu_item", "bill__payments")
        queryset = cls.apply_date_filters(queryset, params)
        payment_mode = params.get("payment_mode")
        if payment_mode:
            queryset = queryset.filter(bill__payments__mode=payment_mode).distinct()
        return queryset

    @classmethod
    def stats_for_server(cls, server, params=None):
        params = params or {}
        orders = cls.orders_for_server(server, params)
        paid_orders = orders.filter(statut=Order.Status.PAYEE)
        cancelled_orders = orders.filter(statut=Order.Status.ANNULEE)
        bills = Bill.objects.filter(order__in=orders)
        paid_bills = bills.filter(statut=Bill.Status.PAYEE)

        total_orders = paid_orders.count()
        all_orders_count = orders.count()
        total_sales = paid_bills.aggregate(total=Sum("total"))["total"] or Decimal("0")
        total_paid = Payment.objects.filter(bill__in=paid_bills).aggregate(total=Sum("montant"))["total"] or Decimal("0")
        total_cancelled = bills.filter(order__statut=Order.Status.ANNULEE).aggregate(total=Sum("total"))["total"] or Decimal("0")
        total_discounts = bills.aggregate(total=Sum("remise_montant"))["total"] or Decimal("0")
        total_items = (
            OrderItem.objects.filter(order__in=orders)
            .exclude(statut=OrderItem.Status.ANNULE)
            .aggregate(total=Sum("quantite"))["total"]
            or 0
        )
        tables_served = paid_orders.values("table_id").distinct().count()
        average_ticket = total_sales / total_orders if total_orders else Decimal("0")
        cancellation_rate = round((cancelled_orders.count() / all_orders_count) * 100, 1) if all_orders_count else 0
        performance_score = float(total_sales) + (total_orders * 250) - float(total_cancelled) - float(total_discounts)

        return {
            "server_id": server.id,
            "server_name": server.full_name,
            "restaurant_id": server.restaurant_id,
            "restaurant_name": server.restaurant.nom,
            "total_orders": total_orders,
            "total_sales_amount": float(total_sales),
            "total_paid_amount": float(total_paid),
            "total_cancelled_amount": float(total_cancelled),
            "total_discounts": float(total_discounts),
            "total_tables_served": tables_served,
            "total_items_sold": int(total_items),
            "average_ticket": float(average_ticket),
            "cancellation_rate": cancellation_rate,
            "performance_score": round(performance_score, 2),
            "performance_label": cls.performance_label(performance_score, cancellation_rate),
        }

    @staticmethod
    def performance_label(score, cancellation_rate):
        if score >= 100000 and cancellation_rate <= 5:
            return "excellente"
        if score >= 50000 and cancellation_rate <= 10:
            return "bonne"
        if score >= 10000 and cancellation_rate <= 20:
            return "moyenne"
        return "faible"

    @classmethod
    def sales_history(cls, server, params=None):
        orders = cls.orders_for_server(server, params)
        rows = []
        for order in orders[:200]:
            try:
                bill = order.bill
            except Bill.DoesNotExist:
                bill = None
            payments_total = Decimal("0")
            if bill:
                payments_total = sum((payment.montant for payment in bill.payments.all()), Decimal("0"))
            rows.append(
                {
                    "id": order.id,
                    "reference": order.reference,
                    "table": order.table.numero,
                    "restaurant": order.table.area.restaurant.nom,
                    "status": order.statut,
                    "created_at": order.created_at,
                    "items_count": order.items.exclude(statut=OrderItem.Status.ANNULE).aggregate(total=Sum("quantite"))["total"] or 0,
                    "total": float(getattr(bill, "total", 0) or 0),
                    "paid": float(payments_total),
                    "discount": float(getattr(bill, "remise_montant", 0) or 0),
                    "cancelled_amount": float(getattr(bill, "total", 0) or 0) if order.statut == Order.Status.ANNULEE else 0,
                }
            )
        return rows

    @classmethod
    def ranked_servers(cls, servers, params=None):
        stats = [cls.stats_for_server(server, params) for server in servers]
        return sorted(stats, key=lambda row: row["performance_score"], reverse=True)

    @classmethod
    def dashboard_summary(cls, servers, params=None):
        ranking = cls.ranked_servers(servers, params)
        totals = {
            "total_sales_today": sum(row["total_sales_amount"] for row in ranking),
            "total_orders": sum(row["total_orders"] for row in ranking),
            "average_ticket": 0,
            "best_server": ranking[0] if ranking else None,
            "most_cancellations_server": None,
            "most_discounts_server": None,
        }
        totals["average_ticket"] = totals["total_sales_today"] / totals["total_orders"] if totals["total_orders"] else 0
        totals["most_cancellations_server"] = max(ranking, key=lambda row: row["total_cancelled_amount"], default=None)
        totals["most_discounts_server"] = max(ranking, key=lambda row: row["total_discounts"], default=None)
        return totals
