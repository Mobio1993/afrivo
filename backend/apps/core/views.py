from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count, Sum, Q
from django.utils import timezone
from django.views.generic import TemplateView
from datetime import timedelta

from django.conf import settings
from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.core.navigation import build_sidebar_links
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.users.models import User


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard/home.html"
    login_url = "login"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        today = timezone.localdate()
        selected_period = self.request.GET.get("period", "today")
        period_map = {
            "today": {
                "days": 1,
                "label": "Aujourd'hui",
                "subtitle": "Lecture des operations et encaissements du jour.",
            },
            "week": {
                "days": 7,
                "label": "7 derniers jours",
                "subtitle": "Vue glissante sur la derniere semaine d'activite.",
            },
            "month": {
                "days": 30,
                "label": "30 derniers jours",
                "subtitle": "Vue glissante sur les trente derniers jours.",
            },
        }
        if selected_period not in period_map:
            selected_period = "today"
        period_config = period_map[selected_period]
        period_start = today - timedelta(days=period_config["days"] - 1)
        frontend_app_url = settings.FRONTEND_APP_URL.rstrip("/")

        def amount_as_float(value):
            return float(value or 0)

        total_rooms = Room.objects.count()
        available_rooms = Room.objects.filter(status=Room.Status.AVAILABLE, is_active=True).count()
        occupied_rooms = Room.objects.filter(status=Room.Status.OCCUPIED, is_active=True).count()
        cleaning_rooms = Room.objects.filter(status=Room.Status.CLEANING, is_active=True).count()
        out_of_service_rooms = Room.objects.filter(status=Room.Status.OUT_OF_SERVICE).count()

        total_guests = Guest.objects.count()
        active_guests = Guest.objects.filter(is_active=True).count()
        blacklisted_guests = Guest.objects.filter(is_blacklisted=True).count()
        total_room_types = RoomType.objects.filter(is_active=True).count()

        total_users = User.objects.count()
        admin_users = User.objects.filter(role=User.Role.ADMIN, is_active=True).count()
        reception_users = User.objects.filter(role=User.Role.RECEPTION, is_active=True).count()

        pending_bookings = Booking.objects.filter(status=Booking.Status.PENDING).count()
        confirmed_bookings = Booking.objects.filter(status=Booking.Status.CONFIRMED).count()
        arrivals_in_period = Booking.objects.filter(
            check_in_date__range=(period_start, today),
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()
        arrivals_today = Booking.objects.filter(
            check_in_date=today,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()
        departures_today = Stay.objects.filter(
            status=Stay.Status.IN_PROGRESS,
            expected_check_out_date=today,
        ).count()
        completed_departures_in_period = Stay.objects.filter(
            check_out_at__date__range=(period_start, today)
        ).count()

        active_stays = Stay.objects.filter(status=Stay.Status.IN_PROGRESS).count()
        completed_stays_today = Stay.objects.filter(check_out_at__date=today).count()

        pending_day_use_payment = DayUse.objects.filter(status=DayUse.Status.PENDING_PAYMENT).count()
        ready_day_use = DayUse.objects.filter(status=DayUse.Status.READY).count()
        in_progress_day_use = DayUse.objects.filter(status=DayUse.Status.IN_PROGRESS).count()
        completed_day_use_today = DayUse.objects.filter(check_out_at__date=today).count()
        completed_day_use_in_period = DayUse.objects.filter(check_out_at__date__range=(period_start, today)).count()
        created_day_use_in_period = DayUse.objects.filter(created_at__date__range=(period_start, today)).count()

        paid_payments = Payment.objects.filter(status=Payment.Status.PAID)
        revenue_today = paid_payments.filter(paid_at__date=today).aggregate(total=Sum("amount"))["total"] or 0
        revenue_in_period = paid_payments.filter(paid_at__date__range=(period_start, today)).aggregate(total=Sum("amount"))["total"] or 0
        pending_payments = Payment.objects.filter(status=Payment.Status.PENDING).count()
        total_paid_amount = paid_payments.aggregate(total=Sum("amount"))["total"] or 0
        total_refunded_amount = Payment.objects.filter(status=Payment.Status.REFUNDED).aggregate(total=Sum("amount"))["total"] or 0
        refunded_in_period = Payment.objects.filter(
            status=Payment.Status.REFUNDED,
            paid_at__date__range=(period_start, today),
        ).aggregate(total=Sum("amount"))["total"] or 0
        pending_payments_in_period = Payment.objects.filter(
            status=Payment.Status.PENDING,
            paid_at__date__range=(period_start, today),
        ).count()

        booking_payment_total = paid_payments.filter(
            booking__isnull=False,
            stay__isnull=True,
            day_use__isnull=True,
        ).aggregate(total=Sum("amount"))["total"] or 0
        booking_payment_period_total = paid_payments.filter(
            booking__isnull=False,
            stay__isnull=True,
            day_use__isnull=True,
            paid_at__date__range=(period_start, today),
        ).aggregate(total=Sum("amount"))["total"] or 0
        stay_payment_total = paid_payments.filter(stay__isnull=False).aggregate(total=Sum("amount"))["total"] or 0
        stay_payment_period_total = paid_payments.filter(
            stay__isnull=False,
            paid_at__date__range=(period_start, today),
        ).aggregate(total=Sum("amount"))["total"] or 0
        day_use_payment_total = paid_payments.filter(day_use__isnull=False).aggregate(total=Sum("amount"))["total"] or 0
        day_use_payment_period_total = paid_payments.filter(
            day_use__isnull=False,
            paid_at__date__range=(period_start, today),
        ).aggregate(total=Sum("amount"))["total"] or 0

        booking_payment_count = paid_payments.filter(
            booking__isnull=False,
            stay__isnull=True,
            day_use__isnull=True,
        ).count()
        booking_payment_period_count = paid_payments.filter(
            booking__isnull=False,
            stay__isnull=True,
            day_use__isnull=True,
            paid_at__date__range=(period_start, today),
        ).count()
        stay_payment_count = paid_payments.filter(stay__isnull=False).count()
        stay_payment_period_count = paid_payments.filter(
            stay__isnull=False,
            paid_at__date__range=(period_start, today),
        ).count()
        day_use_payment_count = paid_payments.filter(day_use__isnull=False).count()
        day_use_payment_period_count = paid_payments.filter(
            day_use__isnull=False,
            paid_at__date__range=(period_start, today),
        ).count()

        occupancy_rate = round((occupied_rooms / total_rooms) * 100) if total_rooms else 0
        availability_rate = round((available_rooms / total_rooms) * 100) if total_rooms else 0

        room_mix = RoomType.objects.annotate(
            room_count=Count("rooms", filter=Q(rooms__is_active=True))
        ).order_by("-room_count", "name")[:5]

        payment_mix = (
            Payment.objects.filter(status=Payment.Status.PAID)
            .values("method")
            .annotate(total=Count("id"), amount=Sum("amount"))
            .order_by("-amount", "-total")[:4]
        )

        revenue_series = []
        activity_series = []
        max_revenue_amount = 0.0
        max_activity_count = 0
        chart_days = period_config["days"]
        for offset in range(chart_days):
            current_day = period_start + timedelta(days=offset)
            day_revenue = amount_as_float(
                paid_payments.filter(paid_at__date=current_day).aggregate(total=Sum("amount"))["total"]
            )
            day_activity = (
                Booking.objects.filter(created_at__date=current_day).count()
                + Stay.objects.filter(check_in_at__date=current_day).count()
                + DayUse.objects.filter(created_at__date=current_day).count()
            )
            revenue_series.append(
                {
                    "label": current_day.strftime("%d/%m"),
                    "amount": day_revenue,
                    "display_value": day_revenue,
                }
            )
            activity_series.append(
                {
                    "label": current_day.strftime("%d/%m"),
                    "count": day_activity,
                    "display_value": day_activity,
                }
            )
            max_revenue_amount = max(max_revenue_amount, day_revenue)
            max_activity_count = max(max_activity_count, day_activity)

        for item in revenue_series:
            item["height"] = max(10, round((item["amount"] / max_revenue_amount) * 100)) if max_revenue_amount else 10

        for item in activity_series:
            item["height"] = max(10, round((item["count"] / max_activity_count) * 100)) if max_activity_count else 10

        activity_labels = {
            HistoryEntry.ActionType.BOOKING_CREATED: "Reservation",
            HistoryEntry.ActionType.CHECK_IN: "Check-in",
            HistoryEntry.ActionType.CHECK_OUT: "Check-out",
            HistoryEntry.ActionType.DAY_USE_CREATED: "Day use",
            HistoryEntry.ActionType.DAY_USE_CHECK_IN: "Entree day use",
            HistoryEntry.ActionType.DAY_USE_CHECK_OUT: "Sortie day use",
            HistoryEntry.ActionType.CLEANING_COMPLETED: "Nettoyage",
            HistoryEntry.ActionType.PAYMENT_RECORDED: "Paiement",
        }

        recent_activity = []
        for entry in HistoryEntry.objects.select_related("actor").filter(created_at__date__range=(period_start, today))[:8]:
            recent_activity.append(
                {
                    "label": activity_labels.get(entry.action_type, "Activite"),
                    "title": entry.entity_reference,
                    "description": entry.description,
                    "actor": entry.actor.get_full_name() or entry.actor.username if entry.actor else "Systeme",
                    "time": timezone.localtime(entry.created_at),
                    "url": "/admin/history/historyentry/",
                }
            )

        alerts = []
        if cleaning_rooms:
            alerts.append(
                {
                    "level": "high",
                    "title": "Chambres en nettoyage",
                    "count": cleaning_rooms,
                    "description": "Des chambres doivent etre remises disponibles pour fluidifier l'exploitation.",
                    "url": "/admin/rooms/room/",
                    "action_label": "Voir les chambres",
                }
            )
        if arrivals_today:
            alerts.append(
                {
                    "level": "high",
                    "title": "Arrivees a traiter aujourd'hui",
                    "count": arrivals_today,
                    "description": "Des reservations du jour attendent encore un accueil ou une confirmation finale.",
                    "url": "/admin/bookings/booking/",
                    "action_label": "Ouvrir les reservations",
                }
            )
        if pending_day_use_payment:
            alerts.append(
                {
                    "level": "medium",
                    "title": "Day use impayes",
                    "count": pending_day_use_payment,
                    "description": "Le paiement complet doit etre valide avant toute entree day use.",
                    "url": "/admin/bookings/dayuse/",
                    "action_label": "Verifier les day use",
                }
            )
        if out_of_service_rooms:
            alerts.append(
                {
                    "level": "medium",
                    "title": "Chambres hors service",
                    "count": out_of_service_rooms,
                    "description": "Certaines chambres reduisent la capacite commerciale de l'hotel.",
                    "url": "/admin/rooms/room/",
                    "action_label": "Suivre l'inventaire",
                }
            )
        if pending_payments:
            alerts.append(
                {
                    "level": "low",
                    "title": "Paiements en attente",
                    "count": pending_payments,
                    "description": "Des encaissements restent ouverts sur des flux deja enregistres.",
                    "url": "/admin/billing/payment/",
                    "action_label": "Voir les paiements",
                }
            )

        context.update(
            {
                "page_title": "Tableau de bord direction",
                "user_first_name": user.first_name or user.username,
                "user_role": getattr(user, "get_role_display", lambda: "Utilisateur")(),
                "selected_period": selected_period,
                "selected_period_label": period_config["label"],
                "period_subtitle": period_config["subtitle"],
                "period_options": [
                    {"value": "today", "label": "Aujourd'hui", "active": selected_period == "today"},
                    {"value": "week", "label": "7 jours", "active": selected_period == "week"},
                    {"value": "month", "label": "30 jours", "active": selected_period == "month"},
                ],
                "status_summary": f"{active_stays} sejour(s) en cours et {ready_day_use} day use pret(s).",
                "sidebar_links": build_sidebar_links("dashboard"),
                "kpi_cards": [
                    {
                        "label": f"Arrivees - {period_config['label']}",
                        "value": arrivals_in_period,
                        "meta": f"{confirmed_bookings} reservation(s) confirmee(s) encore en attente",
                    },
                    {
                        "label": f"Departs clotures - {period_config['label']}",
                        "value": completed_departures_in_period,
                        "meta": f"{departures_today} depart(s) prevu(s) aujourd'hui",
                    },
                    {
                        "label": f"Day use - {period_config['label']}",
                        "value": created_day_use_in_period,
                        "meta": f"{completed_day_use_in_period} cloture(s) sur la periode",
                    },
                    {
                        "label": f"Revenus - {period_config['label']}",
                        "value": revenue_in_period,
                        "meta": f"{pending_payments} paiement(s) encore en attente",
                    },
                ],
                "operations_cards": [
                    {
                        "title": "Exploitation chambres",
                        "items": [
                            {"label": "Disponibles", "value": available_rooms},
                            {"label": "Occupees", "value": occupied_rooms},
                            {"label": "En nettoyage", "value": cleaning_rooms},
                            {"label": "Hors service", "value": out_of_service_rooms},
                        ],
                    },
                    {
                        "title": "Reservations et accueil",
                        "items": [
                            {"label": "Reservations en attente", "value": pending_bookings},
                            {"label": "Reservations confirmees", "value": confirmed_bookings},
                            {"label": "Day use paiement attente", "value": pending_day_use_payment},
                            {"label": "Day use prets", "value": ready_day_use},
                        ],
                    },
                ],
                "business_panels": [
                    {
                        "title": "Base clients et equipe",
                        "items": [
                            {"label": "Clients actifs", "value": active_guests},
                            {"label": "Clients blacklistes", "value": blacklisted_guests},
                            {"label": "Equipe active", "value": total_users},
                            {"label": "Admins / reception", "value": f"{admin_users} / {reception_users}"},
                        ],
                    },
                    {
                        "title": "Performance du jour",
                        "items": [
                            {"label": "Occupation actuelle", "value": f"{occupancy_rate}%"},
                            {"label": "Disponibilite actuelle", "value": f"{availability_rate}%"},
                            {"label": "Sejours termines aujourd'hui", "value": completed_stays_today},
                            {"label": "Day use clotures aujourd'hui", "value": completed_day_use_today},
                        ],
                    },
                ],
                "financial_cards": [
                    {
                        "label": "Encaisse total",
                        "value": total_paid_amount,
                        "meta": "Tous paiements valides confondus",
                    },
                    {
                        "label": f"Encaisse - {period_config['label']}",
                        "value": revenue_in_period,
                        "meta": period_config["subtitle"],
                    },
                    {
                        "label": f"Paiements attente - {period_config['label']}",
                        "value": pending_payments_in_period,
                        "meta": "Flux encore ouverts sur la periode",
                    },
                    {
                        "label": f"Rembourse - {period_config['label']}",
                        "value": refunded_in_period,
                        "meta": f"Total rembourse global : {total_refunded_amount}",
                    },
                ],
                "payment_channels": [
                    {
                        "title": "Reservations",
                        "amount": booking_payment_period_total,
                        "count": booking_payment_period_count,
                        "description": f"Periode selectionnee. Total global : {booking_payment_total} pour {booking_payment_count} paiement(s).",
                    },
                    {
                        "title": "Sejours",
                        "amount": stay_payment_period_total,
                        "count": stay_payment_period_count,
                        "description": f"Periode selectionnee. Total global : {stay_payment_total} pour {stay_payment_count} paiement(s).",
                    },
                    {
                        "title": "Day use",
                        "amount": day_use_payment_period_total,
                        "count": day_use_payment_period_count,
                        "description": f"Periode selectionnee. Total global : {day_use_payment_total} pour {day_use_payment_count} paiement(s).",
                    },
                ],
                "chart_cards": [
                    {
                        "title": f"Evolution des encaissements - {period_config['label']}",
                        "subtitle": "Montants encaisses jour par jour sur la periode choisie.",
                        "items": revenue_series,
                        "empty_label": "Aucun encaissement",
                    },
                    {
                        "title": f"Activite metier - {period_config['label']}",
                        "subtitle": "Reservations creees, check-in et day use enregistres par jour.",
                        "items": activity_series,
                        "empty_label": "Aucune activite",
                    },
                ],
                "room_mix": room_mix,
                "payment_mix": payment_mix,
                "recent_activity": recent_activity,
                "alerts": alerts,
                "director_notes": [
                    "Le dashboard compile maintenant les chambres, reservations, sejours, paiements et day use dans une seule vue direction.",
                    "Les arrivees du jour proviennent des reservations encore a accueillir, et les departs du jour des sejours en cours.",
                    "Les alertes prioritaires signalent maintenant les points qui demandent une action immediate.",
                ],
                "quick_actions": [
                    {
                        "title": "Nouvelle reservation",
                        "description": "Enregistrer une arrivee future ou confirmer un passage reception.",
                        "url": "/admin/bookings/booking/add/",
                    },
                    {
                        "title": "Nouveau day use",
                        "description": "Creer une formule day use et preparer son encaissement.",
                        "url": "/admin/bookings/dayuse/add/",
                    },
                    {
                        "title": "Nouveau paiement",
                        "description": "Saisir un encaissement sur reservation, sejour ou day use.",
                        "url": "/admin/billing/payment/add/",
                    },
                    {
                        "title": "Historique",
                        "description": "Suivre les actions critiques deja tracees dans l'application.",
                        "url": "/admin/history/historyentry/",
                    },
                    {
                        "title": "Base clients",
                        "description": "Ouvrir le module React dedie aux fiches clients et a leur historique.",
                        "url": f"{frontend_app_url}/clients",
                    },
                    {
                        "title": "Rapports financiers",
                        "description": "Ouvrir le module de rapports dedie a la direction.",
                        "url": "/reports/financial/",
                    },
                ],
                "spotlight_cards": [
                    {
                        "title": "Parc hotelier",
                        "value": total_rooms,
                        "meta": f"{total_room_types} type(s) de chambre actif(s)",
                    },
                    {
                        "title": "Portefeuille clients",
                        "value": total_guests,
                        "meta": f"{active_guests} client(s) actif(s)",
                    },
                ],
            }
        )
        return context
