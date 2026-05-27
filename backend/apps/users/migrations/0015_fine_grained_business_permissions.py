from django.db import migrations


ROLE_PERMISSION_CODES = {
    "HOTEL_ADMIN": (
        "operations.check_in",
        "operations.check_out",
        "operations.cancel",
        "operations.no_show",
        "operations.relocate",
        "dayuse.check_in",
        "dayuse.check_out",
        "dayuse.cancel",
        "payments.record",
        "payments.correct",
        "payments.refund",
        "payments.cancel",
        "users.change_role",
        "users.reset_password",
    ),
    "HOTEL_MANAGER": (
        "operations.check_in",
        "operations.check_out",
        "operations.cancel",
        "operations.no_show",
        "operations.relocate",
        "dayuse.check_in",
        "dayuse.check_out",
        "dayuse.cancel",
    ),
    "RECEPTIONIST": (
        "operations.check_in",
        "operations.check_out",
        "dayuse.check_in",
        "dayuse.check_out",
        "payments.record",
    ),
    "ACCOUNTANT": (
        "payments.record",
        "payments.correct",
        "payments.refund",
        "payments.cancel",
    ),
}


PERMISSION_DESCRIPTIONS = {
    "operations.check_in": "Effectuer un check-in sejour ou reservation.",
    "operations.check_out": "Effectuer un check-out sejour.",
    "operations.cancel": "Annuler une operation hoteliere.",
    "operations.no_show": "Marquer une reservation en no-show.",
    "operations.relocate": "Reloger une reservation ou un sejour.",
    "dayuse.check_in": "Effectuer l'entree d'un day use.",
    "dayuse.check_out": "Effectuer la sortie d'un day use.",
    "dayuse.cancel": "Annuler un day use.",
    "payments.record": "Enregistrer un paiement.",
    "payments.correct": "Corriger un paiement.",
    "payments.refund": "Rembourser un paiement.",
    "payments.cancel": "Annuler un paiement.",
    "users.change_role": "Modifier le role IAM d'un utilisateur.",
    "users.reset_password": "Reinitialiser le mot de passe d'un utilisateur.",
}


def seed_fine_grained_permissions(apps, schema_editor):
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
                "description": PERMISSION_DESCRIPTIONS.get(code, ""),
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
        ("users", "0014_canonical_iam_roles"),
    ]

    operations = [
        migrations.RunPython(seed_fine_grained_permissions, migrations.RunPython.noop),
    ]
