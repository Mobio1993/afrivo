from django.db import models
from django.utils.text import slugify

from apps.tenancy.models import Hotel, HotelSettings, Organization
from apps.users.models import User


DEFAULT_ORG_NAME = "AFRIVO Default Organization"
DEFAULT_HOTEL_NAME = "AFRIVO Default Hotel"
DEFAULT_HOTEL_CODE = "AFRIVO-DEFAULT"
STRICT_MODULE_ENV_VARS = {
    "satisfaction": "TENANCY_STRICT_SATISFACTION",
    "billing": "TENANCY_STRICT_BILLING",
    "consumptions": "TENANCY_STRICT_CONSUMPTIONS",
    "guests": "TENANCY_STRICT_GUESTS",
    "operations": "TENANCY_STRICT_OPERATIONS",
    "history": "TENANCY_STRICT_HISTORY",
    "rooms": "TENANCY_STRICT_ROOMS",
    "bookings": "TENANCY_STRICT_BOOKINGS",
}


def get_or_create_default_tenancy():
    organization, _ = Organization.objects.get_or_create(
        slug=slugify(DEFAULT_ORG_NAME) or "afrivo-default-organization",
        defaults={
            "name": DEFAULT_ORG_NAME,
            "is_active": True,
        },
    )
    hotel, _ = Hotel.objects.get_or_create(
        organization=organization,
        code=DEFAULT_HOTEL_CODE,
        defaults={
            "name": DEFAULT_HOTEL_NAME,
            "slug": slugify(DEFAULT_HOTEL_NAME) or "afrivo-default-hotel",
            "timezone": "Atlantic/Reykjavik",
            "currency": "XOF",
            "is_active": True,
        },
    )
    HotelSettings.objects.get_or_create(hotel=hotel)
    return organization, hotel


def get_users_without_hotel_queryset():
    return User.objects.select_related("organization", "hotel").filter(hotel__isnull=True).order_by("username")


def assign_default_hotel_to_users(queryset):
    organization, hotel = get_or_create_default_tenancy()
    assigned = 0
    skipped = 0

    for user in queryset.select_related("organization", "hotel"):
        if user.hotel_id:
            skipped += 1
            continue
        user.hotel = hotel
        if not user.organization_id:
            user.organization = organization
        user.save()
        assigned += 1

    return {
        "organization": organization,
        "hotel": hotel,
        "assigned": assigned,
        "skipped": skipped,
    }


def build_tenancy_readiness_payload(strict_modules=None):
    users_queryset = User.objects.select_related("organization", "hotel")
    users_without_hotel = get_users_without_hotel_queryset()
    total_users = users_queryset.count()
    assigned_users = users_queryset.filter(hotel__isnull=False).count()
    unassigned_users = users_without_hotel.count()
    role_labels = dict(User.Role.choices)
    role_breakdown = [
        {
            "role": item["role"],
            "label": role_labels.get(item["role"], item["role"]),
            "count": item["count"],
            "missing_hotel_count": users_without_hotel.filter(role=item["role"]).count(),
        }
        for item in users_queryset.values("role").order_by("role").annotate(count=models.Count("id"))
    ]

    strict_modules = strict_modules or {}
    module_order = ["satisfaction", "billing", "consumptions", "guests", "rooms", "bookings", "operations", "history"]
    module_readiness = []
    for module_key in module_order:
        env_var = STRICT_MODULE_ENV_VARS.get(module_key, "")
        ready_for_strict_mode = unassigned_users == 0
        module_readiness.append(
            {
                "module": module_key,
                "strict_enabled": bool(strict_modules.get(module_key, False)),
                "ready_for_strict_mode": ready_for_strict_mode,
                "blocking_users": unassigned_users,
                "env_var": env_var,
                "activation_value": "true",
                "activation_instruction": (
                    f"Definir {env_var}=true puis redeployer le backend."
                    if env_var
                    else "Aucune variable d'activation configuree."
                ),
            }
        )

    next_module = next((item for item in module_readiness if not item["strict_enabled"]), None)
    if next_module:
        next_activation = {
            "module": next_module["module"],
            "env_var": next_module["env_var"],
            "activation_value": next_module["activation_value"],
            "activation_instruction": next_module["activation_instruction"],
            "blocking_users": unassigned_users,
            "can_activate_now": unassigned_users == 0,
            "status": "ready" if unassigned_users == 0 else "blocked",
        }
    else:
        next_activation = {
            "module": "",
            "env_var": "",
            "activation_value": "true",
            "activation_instruction": "Tous les modules cibles sont deja en mode strict.",
            "blocking_users": 0,
            "can_activate_now": False,
            "status": "complete",
        }

    rollout_journal = []
    for item in module_readiness:
        if item["strict_enabled"]:
            status = "completed"
            title = f"{item['module']} deja en mode strict"
            message = "Le module applique deja le controle hotel strict."
        elif next_module and item["module"] == next_module["module"]:
            status = "ready" if unassigned_users == 0 else "blocked"
            title = f"{item['module']} est le prochain module recommande"
            message = (
                "Le module peut etre active des maintenant."
                if unassigned_users == 0
                else f"{unassigned_users} compte(s) doivent encore etre rattaches avant cette bascule."
            )
        else:
            status = "pending"
            title = f"{item['module']} reste planifie apres la prochaine bascule"
            message = "Ce module viendra apres les activations strictes precedentes dans l'ordre recommande."

        rollout_journal.append(
            {
                "module": item["module"],
                "status": status,
                "title": title,
                "message": message,
                "env_var": item["env_var"],
            }
        )

    return {
        "summary": {
            "total_users": total_users,
            "assigned_users": assigned_users,
            "unassigned_users": unassigned_users,
            "readiness_ratio": round((assigned_users / total_users) * 100, 2) if total_users else 100.0,
        },
        "recommended_rollout_order": module_order,
        "next_activation": next_activation,
        "rollout_journal": rollout_journal,
        "role_breakdown": role_breakdown,
        "strict_modules": module_readiness,
        "users_without_hotel": [
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name().strip() or user.username,
                "email": user.email or "",
                "role": user.role,
                "role_label": user.get_role_display(),
                "organization_id": user.organization_id,
                "organization_name": user.organization.name if user.organization_id else "",
                "is_active": user.is_active,
                "is_staff": user.is_staff,
            }
            for user in users_without_hotel
        ],
    }
