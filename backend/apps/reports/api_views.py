from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.utils import timezone

from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.core.api_views import api_login_required, format_amount, module_permission_required
from apps.rooms.models import Room, RoomType
from apps.stays.models import Stay
from apps.tenancy.utils import filter_for_active_hotel, get_request_hotel
from apps.tenancy.services import (
    assign_default_hotel_to_users,
    build_tenancy_readiness_payload,
    get_users_without_hotel_queryset,
)
from django.conf import settings


def get_report_period(selected_period):
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
    if selected_period not in period_map:
        selected_period = "today"
    config = period_map[selected_period]
    today = timezone.localdate()
    period_start = today - timedelta(days=config["days"] - 1)
    return selected_period, config, today, period_start


def get_report_navigation(active_slug, selected_period):
    items = [
        {"title": "Financiers", "slug": "financial"},
        {"title": "Occupation", "slug": "occupancy"},
        {"title": "Day use", "slug": "day_use"},
    ]
    return [
        {
            "title": item["title"],
            "slug": item["slug"],
            "active": item["slug"] == active_slug,
            "period": selected_period,
        }
        for item in items
    ]


def get_reports_hotel_scope(request):
    if getattr(request.user, "is_platform_admin", False):
        return None, None

    active_hotel = get_request_hotel(request)
    if active_hotel is None:
        return None, JsonResponse(
            {
                "detail": "Un hotel actif est requis pour consulter ces rapports.",
                "module": "reports",
                "code": "hotel_required",
            },
            status=403,
        )
    return active_hotel, None


def require_platform_admin_response(request):
    if getattr(request.user, "is_platform_admin", False):
        return None
    return JsonResponse(
        {
            "detail": "Seul un administrateur plateforme peut acceder a cette fonctionnalite.",
            "module": "reports",
            "code": "platform_admin_required",
        },
        status=403,
    )


@api_login_required
@module_permission_required("reports", action="view")
def reports_overview_api(request):
    selected_period, config, today, period_start = get_report_period(request.GET.get("period", "today"))
    active_hotel, hotel_error = get_reports_hotel_scope(request)
    if hotel_error is not None:
        return hotel_error

    payments_queryset = filter_for_active_hotel(Payment.objects.all(), hotel=active_hotel)
    rooms_queryset = filter_for_active_hotel(Room.objects.all(), hotel=active_hotel)
    day_uses_queryset = filter_for_active_hotel(DayUse.objects.all(), hotel=active_hotel)

    financial_total = (
        payments_queryset.filter(
            status=Payment.Status.PAID,
            paid_at__date__range=(period_start, today),
        ).aggregate(total=Sum("amount"))["total"]
        or 0
    )
    occupancy_rate = 0
    total_rooms = rooms_queryset.count()
    occupied_rooms = rooms_queryset.filter(status=Room.Status.OCCUPIED, is_active=True).count()
    if total_rooms:
        occupancy_rate = round((occupied_rooms / total_rooms) * 100)

    payload = {
        "title": "Rapports direction",
        "subtitle": "Lecture analytique par domaine metier pour piloter l'exploitation.",
        "period": {
            "value": selected_period,
            "label": config["label"],
            "subtitle": config["subtitle"],
            "options": [
                {"value": "today", "label": "Aujourd'hui", "active": selected_period == "today"},
                {"value": "week", "label": "7 jours", "active": selected_period == "week"},
                {"value": "month", "label": "30 jours", "active": selected_period == "month"},
            ],
        },
        "summary_cards": [
            {
                "label": "Encaissements periode",
                "value": format_amount(financial_total),
                "meta": "Rapports financiers",
            },
            {
                "label": "Occupation actuelle",
                "value": f"{occupancy_rate}%",
                "meta": "Lecture parc hotelier",
            },
            {
                "label": "Day use crees",
                "value": day_uses_queryset.filter(created_at__date__range=(period_start, today)).count(),
                "meta": "Activite flux courts",
            },
        ],
    }
    return JsonResponse(payload)


@api_login_required
@module_permission_required("reports", action="view")
def financial_report_api(request):
    selected_period, config, today, period_start = get_report_period(request.GET.get("period", "today"))
    active_hotel, hotel_error = get_reports_hotel_scope(request)
    if hotel_error is not None:
        return hotel_error

    payments_queryset = filter_for_active_hotel(Payment.objects.all(), hotel=active_hotel)

    paid_payments = payments_queryset.filter(
        status=Payment.Status.PAID,
        paid_at__date__range=(period_start, today),
    )
    refunded_payments = payments_queryset.filter(
        status=Payment.Status.REFUNDED,
        paid_at__date__range=(period_start, today),
    )
    pending_payments = payments_queryset.filter(
        status=Payment.Status.PENDING,
        paid_at__date__range=(period_start, today),
    )

    method_labels = dict(Payment.Method.choices)
    payment_methods = [
        {
            "label": method_labels.get(item["method"], item["method"]),
            "total_count": item["total_count"],
            "total_amount": format_amount(item["total_amount"]),
        }
        for item in paid_payments.values("method")
        .annotate(total_count=Count("id"), total_amount=Sum("amount"))
        .order_by("-total_amount", "-total_count")
    ]

    source_breakdown = [
        {
            "title": "Reservations",
            "amount": format_amount(
                paid_payments.filter(
                    booking__isnull=False,
                    stay__isnull=True,
                    day_use__isnull=True,
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            ),
            "count": paid_payments.filter(
                booking__isnull=False,
                stay__isnull=True,
                day_use__isnull=True,
            ).count(),
            "description": "Paiements lies a des reservations avant sejour.",
        },
        {
            "title": "Sejours",
            "amount": format_amount(
                paid_payments.filter(stay__isnull=False).aggregate(total=Sum("amount"))["total"] or 0
            ),
            "count": paid_payments.filter(stay__isnull=False).count(),
            "description": "Paiements enregistres sur des sejours en cours ou termines.",
        },
        {
            "title": "Day use",
            "amount": format_amount(
                paid_payments.filter(day_use__isnull=False).aggregate(total=Sum("amount"))["total"] or 0
            ),
            "count": paid_payments.filter(day_use__isnull=False).count(),
            "description": "Paiements des flux day use.",
        },
    ]

    recent_payments = [
        {
            "reference": item.reference,
            "status": item.get_status_display(),
            "method": item.get_method_display(),
            "amount": format_amount(item.amount),
            "relation": (
                f"Day use {item.day_use.reference}"
                if item.day_use
                else f"Sejour {item.stay.reference}"
                if item.stay
                else f"Reservation {item.booking.reference}"
                if item.booking
                else "Non rattache"
            ),
            "date": timezone.localtime(item.paid_at).strftime("%d/%m/%Y %H:%M"),
        }
        for item in filter_for_active_hotel(
            Payment.objects.select_related("booking", "stay", "day_use"),
            hotel=active_hotel,
        )
        .filter(paid_at__date__range=(period_start, today))
        .order_by("-paid_at")[:12]
    ]

    payload = {
        "slug": "financial",
        "title": "Rapports financiers",
        "subtitle": "Vue dediee aux encaissements, remboursements et repartitions de revenus.",
        "period": {
            "value": selected_period,
            "label": config["label"],
            "subtitle": config["subtitle"],
        },
        "report_links": get_report_navigation("financial", selected_period),
        "summary_cards": [
            {
                "label": "Montant encaisse",
                "value": format_amount(paid_payments.aggregate(total=Sum("amount"))["total"] or 0),
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
                "value": format_amount(refunded_payments.aggregate(total=Sum("amount"))["total"] or 0),
                "meta": "Transactions en statut rembourse",
            },
        ],
        "payment_methods": payment_methods,
        "source_breakdown": source_breakdown,
        "recent_rows": recent_payments,
    }
    return JsonResponse(payload)


@api_login_required
@module_permission_required("reports", action="view")
def occupancy_report_api(request):
    selected_period, config, today, period_start = get_report_period(request.GET.get("period", "today"))
    active_hotel, hotel_error = get_reports_hotel_scope(request)
    if hotel_error is not None:
        return hotel_error

    rooms_queryset = filter_for_active_hotel(Room.objects.all(), hotel=active_hotel)
    bookings_queryset = filter_for_active_hotel(Booking.objects.all(), hotel=active_hotel)
    stays_queryset = filter_for_active_hotel(Stay.objects.all(), hotel=active_hotel)
    room_types_queryset = filter_for_active_hotel(RoomType.objects.all(), hotel=active_hotel)

    total_rooms = rooms_queryset.count()
    available_rooms = rooms_queryset.filter(status=Room.Status.AVAILABLE, is_active=True).count()
    occupied_rooms = rooms_queryset.filter(status=Room.Status.OCCUPIED, is_active=True).count()
    cleaning_rooms = rooms_queryset.filter(status=Room.Status.CLEANING, is_active=True).count()
    out_of_service_rooms = rooms_queryset.filter(status=Room.Status.OUT_OF_SERVICE).count()
    occupancy_rate = round((occupied_rooms / total_rooms) * 100) if total_rooms else 0

    arrivals = bookings_queryset.filter(
        check_in_date__range=(period_start, today),
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN],
    ).count()
    departures = stays_queryset.filter(check_out_at__date__range=(period_start, today)).count()
    check_ins = stays_queryset.filter(check_in_at__date__range=(period_start, today)).count()

    room_type_breakdown = [
        {
            "name": item.name,
            "total_rooms": item.total_rooms,
            "available_count": item.available_count,
            "occupied_count": item.occupied_count,
            "cleaning_count": item.cleaning_count,
        }
        for item in room_types_queryset.annotate(
            total_rooms=Count("rooms", filter=Q(rooms__is_active=True) & Q(rooms__hotel=active_hotel) if active_hotel else Q(rooms__is_active=True)),
            available_count=Count("rooms", filter=Q(rooms__is_active=True, rooms__status=Room.Status.AVAILABLE) & Q(rooms__hotel=active_hotel) if active_hotel else Q(rooms__is_active=True, rooms__status=Room.Status.AVAILABLE)),
            occupied_count=Count("rooms", filter=Q(rooms__is_active=True, rooms__status=Room.Status.OCCUPIED) & Q(rooms__hotel=active_hotel) if active_hotel else Q(rooms__is_active=True, rooms__status=Room.Status.OCCUPIED)),
            cleaning_count=Count("rooms", filter=Q(rooms__is_active=True, rooms__status=Room.Status.CLEANING) & Q(rooms__hotel=active_hotel) if active_hotel else Q(rooms__is_active=True, rooms__status=Room.Status.CLEANING)),
        ).order_by("-total_rooms", "name")
    ]

    recent_stays = [
        {
            "reference": item.reference,
            "guest": item.guest.full_name,
            "room": item.room.number,
            "status": item.get_status_display(),
            "check_in": timezone.localtime(item.check_in_at).strftime("%d/%m/%Y %H:%M"),
            "check_out": timezone.localtime(item.check_out_at).strftime("%d/%m/%Y %H:%M") if item.check_out_at else "-",
        }
        for item in filter_for_active_hotel(
            Stay.objects.select_related("guest", "room", "booking"),
            hotel=active_hotel,
        )
        .filter(
            Q(check_in_at__date__range=(period_start, today))
            | Q(check_out_at__date__range=(period_start, today))
        )
        .order_by("-check_in_at")[:12]
    ]

    payload = {
        "slug": "occupancy",
        "title": "Rapports occupation",
        "subtitle": "Vue dediee aux chambres, a l'occupation et aux mouvements de sejour.",
        "period": {
            "value": selected_period,
            "label": config["label"],
            "subtitle": config["subtitle"],
        },
        "report_links": get_report_navigation("occupancy", selected_period),
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
        "recent_rows": recent_stays,
    }
    return JsonResponse(payload)


@api_login_required
@module_permission_required("reports", action="view")
def day_use_report_api(request):
    selected_period, config, today, period_start = get_report_period(request.GET.get("period", "today"))
    active_hotel, hotel_error = get_reports_hotel_scope(request)
    if hotel_error is not None:
        return hotel_error

    day_uses_queryset = filter_for_active_hotel(DayUse.objects.all(), hotel=active_hotel)
    payments_queryset = filter_for_active_hotel(Payment.objects.all(), hotel=active_hotel)

    created_day_uses = day_uses_queryset.filter(created_at__date__range=(period_start, today))
    completed_day_uses = day_uses_queryset.filter(check_out_at__date__range=(period_start, today))
    paid_day_use_payments = payments_queryset.filter(
        status=Payment.Status.PAID,
        day_use__isnull=False,
        paid_at__date__range=(period_start, today),
    )

    overtime_labels = dict(DayUse.OvertimeChoice.choices)
    overtime_breakdown = [
        {
            "label": overtime_labels.get(item["overtime_choice"], item["overtime_choice"]),
            "total_count": item["total_count"],
            "total_amount": format_amount(item["total_amount"] or 0),
        }
        for item in created_day_uses.values("overtime_choice")
        .annotate(total_count=Count("id"), total_amount=Sum("total_amount"))
        .order_by("-total_amount", "-total_count")
    ]

    recent_day_uses = [
        {
            "reference": item.reference,
            "guest": item.guest.full_name,
            "room": item.room.number,
            "status": item.get_status_display(),
            "total": format_amount(item.total_amount),
            "planned_entry": timezone.localtime(item.planned_entry_at).strftime("%d/%m/%Y %H:%M"),
        }
        for item in filter_for_active_hotel(
            DayUse.objects.select_related("guest", "room"),
            hotel=active_hotel,
        )
        .filter(created_at__date__range=(period_start, today))
        .order_by("-created_at")[:12]
    ]

    payload = {
        "slug": "day_use",
        "title": "Rapports day use",
        "subtitle": "Vue dediee a l'activite day use, aux statuts et aux revenus des flux courts.",
        "period": {
            "value": selected_period,
            "label": config["label"],
            "subtitle": config["subtitle"],
        },
        "report_links": get_report_navigation("day_use", selected_period),
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
                "value": format_amount(paid_day_use_payments.aggregate(total=Sum("amount"))["total"] or 0),
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
        "recent_rows": recent_day_uses,
    }
    return JsonResponse(payload)


@api_login_required
@module_permission_required("reports", action="manage")
def tenancy_readiness_report_api(request):
    if request.method != "GET":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    payload = build_tenancy_readiness_payload(strict_modules=getattr(settings, "TENANCY_STRICT_MODULES", {}))
    payload.update(
        {
            "title": "Controle de preparation tenancy",
            "subtitle": "Suivi des utilisateurs non rattaches et de l'etat des modules avant bascule stricte.",
            "recommended_rollout_order": [
                "satisfaction",
                "billing",
                "consumptions",
                "guests",
                "operations",
            ],
        }
    )
    return JsonResponse(payload)


@api_login_required
@module_permission_required("reports", action="manage")
def assign_default_hotel_report_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Methode non autorisee."}, status=405)
    platform_admin_error = require_platform_admin_response(request)
    if platform_admin_error is not None:
        return platform_admin_error

    result = assign_default_hotel_to_users(get_users_without_hotel_queryset())
    payload = build_tenancy_readiness_payload(strict_modules=getattr(settings, "TENANCY_STRICT_MODULES", {}))
    payload.update(
        {
            "title": "Controle de preparation tenancy",
            "subtitle": "Suivi des utilisateurs non rattaches et de l'etat des modules avant bascule stricte.",
            "recommended_rollout_order": [
                "satisfaction",
                "billing",
                "consumptions",
                "guests",
                "operations",
            ],
            "assignment_result": {
                "assigned": result["assigned"],
                "skipped": result["skipped"],
                "hotel_name": result["hotel"].name,
                "organization_name": result["organization"].name,
                "message": (
                    f"{result['assigned']} utilisateur(s) rattache(s) a {result['hotel'].name}."
                    if result["assigned"]
                    else "Aucun utilisateur sans hotel n'etait a corriger."
                ),
            },
        }
    )
    return JsonResponse(payload)
