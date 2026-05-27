from datetime import timedelta
from functools import wraps

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.core.api_responses import api_error, api_success
from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.guests.models import Guest
from apps.audit_logs.models import HistoryEntry
from apps.iam.models import User
from apps.iam.services.permission_service import user_can_access
from apps.iam.services.token_service import build_auth_response_payload, resolve_api_user
from apps.licensing.services.access_service import hotel_subscription_is_active, module_license_is_active
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenants.services.scope_service import (
    attach_request_hotel,
    filter_for_active_hotel,
    get_user_hotel,
    is_hotel_scope_strict,
    is_platform_scope_user,
    user_has_valid_tenant,
)

METHOD_PERMISSION_ACTIONS = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


def infer_permission_action(request, explicit_action=None):
    if explicit_action:
        return explicit_action
    return METHOD_PERMISSION_ACTIONS.get(request.method.upper(), "view")


def api_login_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        user = resolve_api_user(request)
        if user is None:
            return api_error(detail="Authentification requise.", http_status=401, code="auth_required", authenticated=False)
        request.user = user
        attach_request_hotel(request)
        return view_func(request, *args, **kwargs)

    return wrapped


def module_hotel_scope_required(module_key):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not hasattr(request, "active_hotel"):
                attach_request_hotel(request)
            user = getattr(request, "user", None)
            if not is_platform_scope_user(user) and not user_has_valid_tenant(user):
                return api_error(
                    detail="Tenant utilisateur invalide ou incoherent.",
                    http_status=403,
                    code="tenant_invalid",
                    module=module_key,
                )
            if is_hotel_scope_strict(module_key) and getattr(request, "active_hotel", None) is None:
                return api_error(
                    detail="Un hotel actif est requis pour acceder a ce module.",
                    http_status=403,
                    code="hotel_user_required",
                    module=module_key,
                )
            active_hotel = getattr(request, "active_hotel", None)
            if active_hotel is not None and not hotel_subscription_is_active(active_hotel):
                if not (user and getattr(user, "is_staff", False)):
                    return api_error(
                        detail="L'abonnement de cet hotel est suspendu ou expire. Contactez l'administration.",
                        http_status=403,
                        code="subscription_inactive",
                        module=module_key,
                    )
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def module_permission_required(module_key, action=None):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            permission_action = infer_permission_action(request, explicit_action=action)
            if user_can_access(request.user, module_key, permission_action):
                return view_func(request, *args, **kwargs)
            return api_error(
                detail="Vous n'avez pas les droits suffisants pour acceder a ce module.",
                http_status=403,
                code="permission_denied",
                module=module_key,
                action=permission_action,
            )

        return wrapped

    return decorator


def module_license_required(module_key):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            active_hotel = getattr(request, "active_hotel", None)
            organization = getattr(getattr(request, "user", None), "organization", None)
            if module_license_is_active(module_key, hotel=active_hotel, organization=organization):
                return view_func(request, *args, **kwargs)
            return api_error(
                detail="Ce module n'est pas actif ou sa licence est invalide.",
                http_status=403,
                code="module_license_denied",
                module=module_key,
            )

        return wrapped

    return decorator


def to_amount(value):
    return float(value or 0)


def format_amount(value):
    return f"{to_amount(value):.2f}"


def get_period_config(selected_period):
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
    return selected_period, period_map[selected_period]


def build_dashboard_payload(user, selected_period):
    today = timezone.localdate()
    selected_period, period_config = get_period_config(selected_period)
    period_start = today - timedelta(days=period_config["days"] - 1)
    active_hotel = get_user_hotel(user)

    rooms_queryset = filter_for_active_hotel(Room.objects.all(), hotel=active_hotel)
    guests_queryset = filter_for_active_hotel(Guest.objects.all(), hotel=active_hotel)
    bookings_queryset = filter_for_active_hotel(Booking.objects.all(), hotel=active_hotel)
    stays_queryset = filter_for_active_hotel(Stay.objects.all(), hotel=active_hotel)
    day_uses_queryset = filter_for_active_hotel(DayUse.objects.all(), hotel=active_hotel)
    payments_queryset = filter_for_active_hotel(Payment.objects.all(), hotel=active_hotel)
    room_types_queryset = filter_for_active_hotel(RoomType.objects.all(), hotel=active_hotel)
    users_queryset = filter_for_active_hotel(User.objects.all(), hotel=active_hotel)

    total_rooms = rooms_queryset.count()
    available_rooms = rooms_queryset.filter(status=Room.Status.AVAILABLE, is_active=True).count()
    occupied_rooms = rooms_queryset.filter(status=Room.Status.OCCUPIED, is_active=True).count()
    reserved_rooms = rooms_queryset.filter(status=Room.Status.RESERVED, is_active=True).count()
    cleaning_rooms = rooms_queryset.filter(status=Room.Status.CLEANING, is_active=True).count()
    out_of_service_rooms = rooms_queryset.filter(status=Room.Status.OUT_OF_SERVICE).count()

    total_guests = guests_queryset.count()
    active_guests = guests_queryset.filter(is_active=True).count()
    blacklisted_guests = guests_queryset.filter(is_blacklisted=True).count()
    total_room_types = room_types_queryset.filter(is_active=True).count()

    total_users = users_queryset.count()
    admin_users = users_queryset.filter(role=User.Role.ADMIN, is_active=True).count()
    reception_users = users_queryset.filter(role=User.Role.RECEPTION, is_active=True).count()

    pending_bookings = bookings_queryset.filter(status=Booking.Status.PENDING).count()
    confirmed_bookings = bookings_queryset.filter(status=Booking.Status.CONFIRMED).count()
    arrivals_in_period = bookings_queryset.filter(
        check_in_date__range=(period_start, today),
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
    ).count()
    arrivals_today = bookings_queryset.filter(
        check_in_date=today,
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
    ).count()
    departures_today = stays_queryset.filter(
        status=Stay.Status.IN_PROGRESS,
        expected_check_out_date=today,
    ).count()
    completed_departures_in_period = stays_queryset.filter(
        check_out_at__date__range=(period_start, today)
    ).count()

    active_stays = stays_queryset.filter(status=Stay.Status.IN_PROGRESS).count()
    completed_stays_today = stays_queryset.filter(check_out_at__date=today).count()

    pending_day_use_payment = day_uses_queryset.filter(status=DayUse.Status.PENDING_PAYMENT).count()
    ready_day_use = day_uses_queryset.filter(status=DayUse.Status.READY).count()
    completed_day_use_today = day_uses_queryset.filter(check_out_at__date=today).count()
    completed_day_use_in_period = day_uses_queryset.filter(check_out_at__date__range=(period_start, today)).count()
    created_day_use_in_period = day_uses_queryset.filter(created_at__date__range=(period_start, today)).count()

    paid_payments = payments_queryset.filter(status=Payment.Status.PAID)
    revenue_in_period = paid_payments.filter(paid_at__date__range=(period_start, today)).aggregate(
        total=Sum("amount")
    )["total"] or 0
    pending_payments = payments_queryset.filter(status=Payment.Status.PENDING).count()
    total_paid_amount = paid_payments.aggregate(total=Sum("amount"))["total"] or 0
    total_refunded_amount = payments_queryset.filter(status=Payment.Status.REFUNDED).aggregate(total=Sum("amount"))[
        "total"
    ] or 0
    refunded_in_period = payments_queryset.filter(
        status=Payment.Status.REFUNDED,
        paid_at__date__range=(period_start, today),
    ).aggregate(total=Sum("amount"))["total"] or 0
    pending_payments_in_period = payments_queryset.filter(
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

    room_mix = [
        {
            "name": item.name,
            "code": item.code,
            "room_count": item.room_count,
        }
        for item in room_types_queryset.annotate(
            room_count=Count("rooms", filter=Q(rooms__is_active=True))
        ).order_by("-room_count", "name")[:5]
    ]

    method_labels = dict(Payment.Method.choices)
    payment_mix = [
        {
            "method": method_labels.get(item["method"], item["method"]),
            "total": item["total"],
            "amount": format_amount(item["amount"]),
        }
        for item in payments_queryset.filter(status=Payment.Status.PAID)
        .values("method")
        .annotate(total=Count("id"), amount=Sum("amount"))
        .order_by("-amount", "-total")[:4]
    ]

    revenue_series = []
    activity_series = []
    max_revenue_amount = 0.0
    max_activity_count = 0
    for offset in range(period_config["days"]):
        current_day = period_start + timedelta(days=offset)
        day_revenue = to_amount(
            paid_payments.filter(paid_at__date=current_day).aggregate(total=Sum("amount"))["total"]
        )
        day_activity = (
            bookings_queryset.filter(created_at__date=current_day).count()
            + stays_queryset.filter(check_in_at__date=current_day).count()
            + day_uses_queryset.filter(created_at__date=current_day).count()
        )
        revenue_series.append(
            {
                "label": current_day.strftime("%d/%m"),
                "value": format_amount(day_revenue),
                "raw_value": day_revenue,
            }
        )
        activity_series.append(
            {
                "label": current_day.strftime("%d/%m"),
                "value": day_activity,
                "raw_value": day_activity,
            }
        )
        max_revenue_amount = max(max_revenue_amount, day_revenue)
        max_activity_count = max(max_activity_count, day_activity)

    for item in revenue_series:
        item["height"] = max(12, round((item["raw_value"] / max_revenue_amount) * 100)) if max_revenue_amount else 12

    for item in activity_series:
        item["height"] = max(12, round((item["raw_value"] / max_activity_count) * 100)) if max_activity_count else 12

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
    recent_activity_queryset = HistoryEntry.objects.select_related("actor").filter(created_at__date__range=(period_start, today))
    if active_hotel is not None:
        recent_activity_queryset = recent_activity_queryset.filter(hotel=active_hotel)

    recent_activity = [
        {
            "label": activity_labels.get(entry.action_type, "Activite"),
            "title": entry.entity_reference,
            "description": entry.description,
            "actor": (entry.actor.get_full_name() or entry.actor.username) if entry.actor else "Systeme",
            "time": timezone.localtime(entry.created_at).strftime("%d/%m/%Y %H:%M"),
            "url": "/admin/history/historyentry/",
        }
        for entry in recent_activity_queryset[:8]
    ]

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

    return {
        "page_title": "Tableau de bord direction",
        "user": {
            "first_name": user.first_name or user.username,
            "role": getattr(user, "get_role_display", lambda: "Utilisateur")(),
        },
        "period": {
            "value": selected_period,
            "label": period_config["label"],
            "subtitle": period_config["subtitle"],
            "options": [
                {"value": "today", "label": "Aujourd'hui", "active": selected_period == "today"},
                {"value": "week", "label": "7 jours", "active": selected_period == "week"},
                {"value": "month", "label": "30 jours", "active": selected_period == "month"},
            ],
        },
        "status_summary": f"{active_stays} sejour(s) en cours et {ready_day_use} day use pret(s).",
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
                "value": format_amount(revenue_in_period),
                "meta": f"{pending_payments} paiement(s) encore en attente",
            },
        ],
        "operations_cards": [
            {
                "title": "Exploitation chambres",
                "items": [
                    {"label": "Disponibles", "value": available_rooms},
                    {"label": "Occupees", "value": occupied_rooms},
                    {"label": "Reservees", "value": reserved_rooms},
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
                "value": format_amount(total_paid_amount),
                "meta": "Tous paiements valides confondus",
            },
            {
                "label": f"Encaisse - {period_config['label']}",
                "value": format_amount(revenue_in_period),
                "meta": period_config["subtitle"],
            },
            {
                "label": f"Paiements attente - {period_config['label']}",
                "value": pending_payments_in_period,
                "meta": "Flux encore ouverts sur la periode",
            },
            {
                "label": f"Rembourse - {period_config['label']}",
                "value": format_amount(refunded_in_period),
                "meta": f"Total rembourse global : {format_amount(total_refunded_amount)}",
            },
        ],
        "payment_channels": [
            {
                "title": "Reservations",
                "amount": format_amount(booking_payment_period_total),
                "count": booking_payment_period_count,
                "description": f"Periode selectionnee. Total global : {format_amount(booking_payment_total)} pour {booking_payment_count} paiement(s).",
            },
            {
                "title": "Sejours",
                "amount": format_amount(stay_payment_period_total),
                "count": stay_payment_period_count,
                "description": f"Periode selectionnee. Total global : {format_amount(stay_payment_total)} pour {stay_payment_count} paiement(s).",
            },
            {
                "title": "Day use",
                "amount": format_amount(day_use_payment_period_total),
                "count": day_use_payment_period_count,
                "description": f"Periode selectionnee. Total global : {format_amount(day_use_payment_total)} pour {day_use_payment_count} paiement(s).",
            },
        ],
        "chart_cards": [
            {
                "title": f"Evolution des encaissements - {period_config['label']}",
                "subtitle": "Montants encaisses jour par jour sur la periode choisie.",
                "items": revenue_series,
            },
            {
                "title": f"Activite metier - {period_config['label']}",
                "subtitle": "Reservations creees, check-in et day use enregistres par jour.",
                "items": activity_series,
            },
        ],
        "room_mix": room_mix,
        "payment_mix": payment_mix,
        "recent_activity": recent_activity,
        "alerts": alerts,
        "director_notes": [
            "Le dashboard React lit maintenant les donnees de direction depuis l'API Django.",
            "Les blocs operations, finance, activite et alertes restent alignes sur les regles metier actuelles.",
            "La migration React peut maintenant continuer page par page sans casser l'admin.",
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
                "title": "Rapports financiers",
                "description": "Ouvrir le module de rapports dedie a la direction.",
                "url": "/reports/financial/",
            },
        ],
    }


def health_api(request):
    return api_success(name="Hotel Reception API", status="ok", timestamp=timezone.now().isoformat())


@api_login_required
def session_api(request):
    user = request.user
    active_hotel = getattr(request, "active_hotel", None)
    payload = build_auth_response_payload(user)
    payload["user"]["hotel_id"] = active_hotel.id if active_hotel else None
    payload["user"]["hotel_name"] = active_hotel.name if active_hotel else ""
    return api_success(**payload)


@api_login_required
def dashboard_summary_api(request):
    payload = build_dashboard_payload(request.user, request.GET.get("period", "today"))
    return api_success(**payload)
