from django.db import migrations, models


def copy_adults_to_adults_count(apps, schema_editor):
    """
    Copie adults → adults_count et children → children_count pour tous les séjours
    où les valeurs divergeraient (protection contre d'éventuelles incohérences).
    En pratique _sync_operational_fields les a toujours maintenus identiques,
    mais on garantit l'intégrité avant de supprimer les anciens champs.
    """
    Stay = apps.get_model("stays", "Stay")
    for stay in Stay.objects.all():
        updated_fields = []
        if stay.adults_count != stay.adults:
            stay.adults_count = stay.adults
            updated_fields.append("adults_count")
        if stay.children_count != stay.children:
            stay.children_count = stay.children
            updated_fields.append("children_count")
        if updated_fields:
            Stay.objects.filter(pk=stay.pk).update(
                **{f: getattr(stay, f) for f in updated_fields}
            )


def reverse_copy(apps, schema_editor):
    """
    Restaure adults et children à partir des valeurs canoniques.
    """
    Stay = apps.get_model("stays", "Stay")
    Stay.objects.all().update(
        adults=models.F("adults_count"),
        children=models.F("children_count"),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("stays", "0004_stay_hotel"),
    ]

    operations = [
        # 1. Copie de sécurité des données avant suppression des anciens champs
        migrations.RunPython(copy_adults_to_adults_count, reverse_copy),

        # 2. Mise à jour de la contrainte CHECK : adults → adults_count
        migrations.RemoveConstraint(
            model_name="stay",
            name="stay_at_least_one_adult",
        ),
        migrations.AddConstraint(
            model_name="stay",
            constraint=models.CheckConstraint(
                condition=models.Q(adults_count__gte=1),
                name="stay_at_least_one_adult",
            ),
        ),

        # 3. Suppression des champs redondants
        migrations.RemoveField(
            model_name="stay",
            name="adults",
        ),
        migrations.RemoveField(
            model_name="stay",
            name="children",
        ),
    ]
