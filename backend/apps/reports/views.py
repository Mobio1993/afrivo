import csv
from datetime import timedelta

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count, Sum, Q
from django.http import HttpResponse
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView

from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.core.navigation import build_sidebar_links
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenants.services.tenant_service import TenantService

filter_for_active_hotel = TenantService.filter_for_active_hotel
get_user_hotel = TenantService.get_user_hotel


class ReportPeriodMixin(LoginRequiredMixin):
    period_map = {
        "today": {
            "days": 1,
            "label": "Aujourd'hui",
            "subtitle": "Lecture du jour.",
        },
        "week": {
            "days": 7,
            "label": "7 derniers jours",
            "subtitle": "Vue glissante sur la derniere semaine.",
        },
        "month": {
            "days": 30,
            "label": "30 derniers jours",
            "subtitle": "Vue glissante sur les trente derniers jours.",
        },
    }

    report_links = [
        {"title": "Rapports financiers", "url": "/reports/financial/", "slug": "financial"},
        {"title": "Rapports occupation", "url": "/reports/occupancy/", "slug": "occupancy"},
        {"title": "Rapports day use", "url": "/reports/day-use/", "slug": "day_use"},
    ]

    def get_selected_period(self):
        selected_period = self.request.GET.get("period", "today")
        if selected_period not in self.period_map:
            selected_period = "today"
        return selected_period

    def get_period_context(self):
        selected_period = self.get_selected_period()
        config = self.period_map[selected_period]
        today = timezone.localdate()
        period_start = today - timedelta(days=config["days"] - 1)
        return {
            "selected_period": selected_period,
            "period_label": config["label"],
            "period_subtitle": config["subtitle"],
            "today": today,
            "period_start": period_start,
            "period_options": [
                {"value": "today", "label": "Aujourd'hui", "active": selected_period == "today"},
                {"value": "week", "label": "7 jours", "active": selected_period == "week"},
                {"value": "month", "label": "30 jours", "active": selected_period == "month"},
            ],
        }

    def get_sidebar_context(self):
        user = self.request.user
        return {
            "user_first_name": user.first_name or user.username,
            "user_role": getattr(user, "get_role_display", lambda: "Utilisateur")(),
            "sidebar_links": build_sidebar_links("reports"),
        }

    def get_report_links(self, active_slug):
        links = []
        for item in self.report_links:
            links.append(
                {
                    "title": item["title"],
                    "url": item["url"],
                    "active": item["slug"] == active_slug,
                }
            )
        return links

    def get_active_hotel(self):
        return get_user_hotel(self.request.user)

    def hotel_scope(self, queryset):
        return filter_for_active_hotel(queryset, hotel=self.get_active_hotel())


class FinancialReportView(ReportPeriodMixin, TemplateView):
    template_name = "reports/financial.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        period = self.get_period_context()
        context.update(self.get_sidebar_context())
        paid_payments = self.hotel_scope(Payment.objects.all()).filter(
            status=Payment.Status.PAID,
            paid_at__date__range=(period["period_start"], period["today"]),
        )
        refunded_payments = self.hotel_scope(Payment.objects.all()).filter(
            status=Payment.Status.REFUNDED,
            paid_at__date__range=(period["period_start"], period["today"]),
        )
        pending_payments = self.hotel_scope(Payment.objects.all()).filter(
            status=Payment.Status.PENDING,
            paid_at__date__range=(period["period_start"], period["today"]),
        )

        method_labels = dict(Payment.Method.choices)
        payment_methods = (
            paid_payments.values("method")
            .annotate(total_count=Count("id"), total_amount=Sum("amount"))
            .order_by("-total_amount", "-total_count")
        )
        payment_methods = [
            {
                "label": method_labels.get(item["method"], item["method"]),
                "total_count": item["total_count"],
                "total_amount": item["total_amount"],
            }
            for item in payment_methods
        ]

        source_breakdown = [
            {
                "title": "Reservations",
                "amount": paid_payments.filter(
                    booking__isnull=False,
                    stay__isnull=True,
                    day_use__isnull=True,
                ).aggregate(total=Sum("amount"))["total"]
                or 0,
                "count": paid_payments.filter(
                    booking__isnull=False,
                    stay__isnull=True,
                    day_use__isnull=True,
                ).count(),
                "description": "Paiements lies a des reservations avant sejour.",
            },
            {
                "title": "Sejours",
                "amount": paid_payments.filter(stay__isnull=False).aggregate(total=Sum("amount"))["total"] or 0,
                "count": paid_payments.filter(stay__isnull=False).count(),
                "description": "Paiements enregistres sur des sejours en cours ou termines.",
            },
            {
                "title": "Day use",
                "amount": paid_payments.filter(day_use__isnull=False).aggregate(total=Sum("amount"))["total"] or 0,
                "count": paid_payments.filter(day_use__isnull=False).count(),
                "description": "Paiements des flux day use.",
            },
        ]

        recent_payments = (
            self.hotel_scope(Payment.objects.select_related("booking", "stay", "day_use"))
            .filter(paid_at__date__range=(period["period_start"], period["today"]))
            .order_by("-paid_at")[:12]
        )

        context.update(
            {
                "page_title": "Rapports financiers",
                "report_title": "Rapports financiers",
                "report_subtitle": "Vue dediee aux encaissements, remboursements et repartitions de revenus.",
                "report_links": self.get_report_links("financial"),
                "export_url": f"/reports/financial/export/?period={period['selected_period']}",
                "period_label": period["period_label"],
                "period_subtitle": period["period_subtitle"],
                "period_options": period["period_options"],
                "summary_cards": [
                    {
                        "label": "Montant encaisse",
                        "value": paid_payments.aggregate(total=Sum("amount"))["total"] or 0,
                        "meta": "Paiements valides sur la periode",
                    },
                    {
                        "label": "Paiements valides",
                        "value": paid_payments.count(),
                        "meta": "Transactions en statut paye",
                    },
                    {
                        "label": "Paiements en attente",
                        "value": pending_payments.count(),
                        "meta": "Encaissements a regulariser",
                    },
                    {
                        "label": "Montant rembourse",
                        "value": refunded_payments.aggregate(total=Sum("amount"))["total"] or 0,
                        "meta": "Transactions en statut rembourse",
                    },
                ],
                "payment_methods": payment_methods,
                "source_breakdown": source_breakdown,
                "recent_payments": recent_payments,
            }
        )
        return context


class OccupancyReportView(ReportPeriodMixin, TemplateView):
    template_name = "reports/occupancy.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        period = self.get_period_context()
        context.update(self.get_sidebar_context())

        rooms_queryset = self.hotel_scope(Room.objects.all())
        total_rooms = rooms_queryset.count()
        available_rooms = rooms_queryset.filter(status=Room.Status.AVAILABLE, is_active=True).count()
        occupied_rooms = rooms_queryset.filter(status=Room.Status.OCCUPIED, is_active=True).count()
        cleaning_rooms = rooms_queryset.filter(status=Room.Status.CLEANING, is_active=True).count()
        out_of_service_rooms = rooms_queryset.filter(status=Room.Status.OUT_OF_SERVICE).count()
        occupancy_rate = round((occupied_rooms / total_rooms) * 100) if total_rooms else 0

        arrivals = self.hotel_scope(Booking.objects.all()).filter(
            check_in_date__range=(period["period_start"], period["today"]),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN],
        ).count()
        stays_queryset = self.hotel_scope(Stay.objects.all())
        departures = stays_queryset.filter(check_out_at__date__range=(period["period_start"], period["today"])).count()
        check_ins = stays_queryset.filter(check_in_at__date__range=(period["period_start"], period["today"])).count()

        room_type_breakdown = self.hotel_scope(RoomType.objects.all()).annotate(
            total_rooms=Count("rooms", filter=Q(rooms__is_active=True)),
            available_count=Count(
                "rooms",
                filter=Q(rooms__is_active=True, rooms__status=Room.Status.AVAILABLE),
            ),
            occupied_count=Count(
                "rooms",
                filter=Q(rooms__is_active=True, rooms__status=Room.Status.OCCUPIED),
            ),
            cleaning_count=Count(
                "rooms",
                filter=Q(rooms__is_active=True, rooms__status=Room.Status.CLEANING),
            ),
        ).order_by("-total_rooms", "name")

        recent_stays = (
            self.hotel_scope(Stay.objects.select_related("guest", "room", "booking"))
            .filter(
                Q(check_in_at__date__range=(period["period_start"], period["today"]))
                | Q(check_out_at__date__range=(period["period_start"], period["today"]))
            )
            .order_by("-check_in_at")[:12]
        )

        context.update(
            {
                "page_title": "Rapports occupation",
                "report_title": "Rapports occupation",
                "report_subtitle": "Vue dediee aux chambres, a l'occupation et aux mouvements de sejour.",
                "report_links": self.get_report_links("occupancy"),
                "export_url": f"/reports/occupancy/export/?period={period['selected_period']}",
                "period_label": period["period_label"],
                "period_subtitle": period["period_subtitle"],
                "period_options": period["period_options"],
                "summary_cards": [
                    {"label": "Parc total", "value": total_rooms, "meta": "Nombre total de chambres"},
                    {"label": "Occupation actuelle", "value": f"{occupancy_rate}%", "meta": f"{occupied_rooms} chambre(s) occupee(s)"},
                    {"label": "Arrivees periode", "value": arrivals, "meta": "Reservations a l'arrivee sur la periode"},
                    {"label": "Departs periode", "value": departures, "meta": "Sejours clotures sur la periode"},
                ],
                "status_cards": [
                    {"label": "Disponibles", "value": available_rooms},
                    {"label": "Occupees", "value": occupied_rooms},
                    {"label": "En nettoyage", "value": cleaning_rooms},
                    {"label": "Hors service", "value": out_of_service_rooms},
                    {"label": "Check-in effectues", "value": check_ins},
                ],
                "room_type_breakdown": room_type_breakdown,
                "recent_stays": recent_stays,
            }
        )
        return context


class DayUseReportView(ReportPeriodMixin, TemplateView):
    template_name = "reports/day_use.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        period = self.get_period_context()
        context.update(self.get_sidebar_context())

        day_uses_queryset = self.hotel_scope(DayUse.objects.all())
        created_day_uses = day_uses_queryset.filter(created_at__date__range=(period["period_start"], period["today"]))
        completed_day_uses = day_uses_queryset.filter(check_out_at__date__range=(period["period_start"], period["today"]))
        paid_day_use_payments = self.hotel_scope(Payment.objects.all()).filter(
            status=Payment.Status.PAID,
            day_use__isnull=False,
            paid_at__date__range=(period["period_start"], period["today"]),
        )

        overtime_labels = dict(DayUse.OvertimeChoice.choices)
        overtime_breakdown = (
            created_day_uses.values("overtime_choice")
            .annotate(total_count=Count("id"), total_amount=Sum("total_amount"))
            .order_by("-total_amount", "-total_count")
        )
        overtime_breakdown = [
            {
                "label": overtime_labels.get(item["overtime_choice"], item["overtime_choice"]),
                "total_count": item["total_count"],
                "total_amount": item["total_amount"] or 0,
            }
            for item in overtime_breakdown
        ]

        recent_day_uses = (
            self.hotel_scope(DayUse.objects.select_related("guest", "room"))
            .filter(created_at__date__range=(period["period_start"], period["today"]))
            .order_by("-created_at")[:12]
        )

        context.update(
            {
                "page_title": "Rapports day use",
                "report_title": "Rapports day use",
                "report_subtitle": "Vue dediee a l'activite day use, aux statuts et aux revenus des flux courts.",
                "report_links": self.get_report_links("day_use"),
                "export_url": f"/reports/day-use/export/?period={period['selected_period']}",
                "period_label": period["period_label"],
                "period_subtitle": period["period_subtitle"],
                "period_options": period["period_options"],
                "summary_cards": [
                    {
                        "label": "Day use crees",
                        "value": created_day_uses.count(),
                        "meta": "Flux day use ouverts sur la periode",
                    },
                    {
                        "label": "Day use termines",
                        "value": completed_day_uses.count(),
                        "meta": "Sorties day use sur la periode",
                    },
                    {
                        "label": "Day use prets",
                        "value": day_uses_queryset.filter(status=DayUse.Status.READY).count(),
                        "meta": "Paiement valide avant entree",
                    },
                    {
                        "label": "Revenu day use",
                        "value": paid_day_use_payments.aggregate(total=Sum("amount"))["total"] or 0,
                        "meta": "Encaissements day use sur la periode",
                    },
                ],
                "status_cards": [
                    {"label": "Paiement attente", "value": day_uses_queryset.filter(status=DayUse.Status.PENDING_PAYMENT).count()},
                    {"label": "Prets", "value": day_uses_queryset.filter(status=DayUse.Status.READY).count()},
                    {"label": "En cours", "value": day_uses_queryset.filter(status=DayUse.Status.IN_PROGRESS).count()},
                    {"label": "Termines", "value": day_uses_queryset.filter(status=DayUse.Status.COMPLETED).count()},
                ],
                "overtime_breakdown": overtime_breakdown,
                "recent_day_uses": recent_day_uses,
            }
        )
        return context


class FinancialReportExportView(ReportPeriodMixin, View):
    def get(self, request, *args, **kwargs):
        period = self.get_period_context()
        queryset = (
            self.hotel_scope(Payment.objects.select_related("booking", "stay", "day_use"))
            .filter(paid_at__date__range=(period["period_start"], period["today"]))
            .order_by("-paid_at")
        )
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="financial-report-{period["selected_period"]}.csv"'
        writer = csv.writer(response)
        writer.writerow(["Reference", "Statut", "Mode", "Montant", "Date", "Reservation", "Sejour", "Day use"])
        for item in queryset:
            writer.writerow(
                [
                    item.reference,
                    item.status,
                    item.method,
                    item.amount,
                    timezone.localtime(item.paid_at).strftime("%Y-%m-%d %H:%M"),
                    item.booking.reference if item.booking else "",
                    item.stay.reference if item.stay else "",
                    item.day_use.reference if item.day_use else "",
                ]
            )
        return response


class OccupancyReportExportView(ReportPeriodMixin, View):
    def get(self, request, *args, **kwargs):
        period = self.get_period_context()
        queryset = self.hotel_scope(Room.objects.select_related("room_type")).order_by("number")
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="occupancy-report-{period["selected_period"]}.csv"'
        writer = csv.writer(response)
        writer.writerow(["Chambre", "Type", "Etage", "Statut", "Active"])
        for item in queryset:
            writer.writerow([item.number, item.room_type.name, item.floor or "", item.status, item.is_active])
        return response


class DayUseReportExportView(ReportPeriodMixin, View):
    def get(self, request, *args, **kwargs):
        period = self.get_period_context()
        queryset = (
            self.hotel_scope(DayUse.objects.select_related("guest", "room"))
            .filter(created_at__date__range=(period["period_start"], period["today"]))
            .order_by("-created_at")
        )
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="day-use-report-{period["selected_period"]}.csv"'
        writer = csv.writer(response)
        writer.writerow(["Reference", "Client", "Chambre", "Statut", "Total", "Entree prevue", "Entree", "Sortie"])
        for item in queryset:
            writer.writerow(
                [
                    item.reference,
                    item.guest.full_name,
                    item.room.number,
                    item.status,
                    item.total_amount,
                    timezone.localtime(item.planned_entry_at).strftime("%Y-%m-%d %H:%M"),
                    timezone.localtime(item.check_in_at).strftime("%Y-%m-%d %H:%M") if item.check_in_at else "",
                    timezone.localtime(item.check_out_at).strftime("%Y-%m-%d %H:%M") if item.check_out_at else "",
                ]
            )
        return response
