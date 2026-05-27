from django.db import migrations


ROLE_PERMISSION_CODES = {
    "HOTEL_ADMIN": (
        "rooms.block",
        "rooms.unblock",
        "rooms.maintenance",
        "rooms.cleaning_complete",
        "billing.issue_invoice",
        "billing.cancel_invoice",
        "billing.validate_invoice",
        "reports.view_financial",
        "reports.view_occupancy",
        "reports.view_dayuse",
        "reports.export",
        "users.deactivate",
        "settings.update_hotel",
        "settings.update_security",
        "settings.update_modules",
        "housekeeping.assign",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
        "maintenance.create",
        "maintenance.resolve",
    ),
    "HOTEL_MANAGER": (
        "rooms.block",
        "rooms.unblock",
        "rooms.maintenance",
        "rooms.cleaning_complete",
        "reports.view_occupancy",
        "reports.view_dayuse",
        "settings.update_hotel",
        "housekeeping.assign",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
        "maintenance.create",
        "maintenance.resolve",
    ),
    "RECEPTIONIST": (
        "rooms.cleaning_complete",
        "reports.view_occupancy",
        "reports.view_dayuse",
    ),
    "ACCOUNTANT": (
        "billing.issue_invoice",
        "billing.cancel_invoice",
        "billing.validate_invoice",
        "reports.view_financial",
        "reports.export",
    ),
    "STAFF": (
        "rooms.cleaning_complete",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
    ),
    "HOUSEKEEPING": (
        "rooms.cleaning_complete",
        "housekeeping.start",
        "housekeeping.complete",
        "housekeeping.report_problem",
    ),
}


DESCRIPTIONS = {
    "rooms.block": "Bloquer une chambre.",
    "rooms.unblock": "Debloquer une chambre.",
    "rooms.maintenance": "Basculer ou gerer une chambre en maintenance.",
    "rooms.cleaning_complete": "Cloturer le nettoyage d'une chambre.",
    "billing.issue_invoice": "Emettre une facture.",
    "billing.cancel_invoice": "Annuler une facture.",
    "billing.validate_invoice": "Valider ou corriger une facture.",
    "reports.view_financial": "Consulter les rapports financiers.",
    "reports.view_occupancy": "Consulter les rapports d'occupation.",
    "reports.view_dayuse": "Consulter les rapports day use.",
    "reports.export": "Exporter des rapports.",
    "users.deactivate": "Desactiver un utilisateur.",
    "settings.update_hotel": "Modifier les parametres hotel.",
    "settings.update_security": "Modifier les parametres de securite.",
    "settings.update_modules": "Modifier les parametres de modules.",
    "housekeeping.assign": "Assigner une tache housekeeping.",
    "housekeeping.start": "Demarrer une tache housekeeping.",
    "housekeeping.complete": "Terminer une tache housekeeping.",
    "housekeeping.report_problem": "Signaler un probleme housekeeping.",
    "maintenance.create": "Creer une intervention maintenance.",
    "maintenance.resolve": "Resoudre une intervention maintenance.",
}


def seed_permissions(apps, schema_editor):
    IAMRole = apps.get_model("users", "IAMRole")
    IAMPermission = apps.get_model("users", "IAMPermission")
    IAMRolePermission = apps.get_model("users", "IAMRolePermission")

    permission_codes = sorted({code for codes in ROLE_PERMISSION_CODES.values() for code in codes})
    permissions = {}
    for code in permission_codes:
        module_code, action = code.split(".", 1)
        permissions[code], _ = IAMPermission.objects.update_or_create(
            code=code,
            defaults={
                "module_code": module_code,
                "action": action,
                "description": DESCRIPTIONS.get(code, ""),
                "is_active": True,
            },
        )

    for role_code, codes in ROLE_PERMISSION_CODES.items():
        role = IAMRole.objects.filter(code=role_code).first()
        if not role:
            continue
        for code in codes:
            IAMRolePermission.objects.get_or_create(role=role, permission=permissions[code])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0015_fine_grained_business_permissions"),
    ]

    operations = [
        migrations.RunPython(seed_permissions, migrations.RunPython.noop),
    ]
