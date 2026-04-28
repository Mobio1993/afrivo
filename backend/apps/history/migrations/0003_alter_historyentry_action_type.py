from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("history", "0002_historyentry_hotel"),
    ]

    operations = [
        migrations.AlterField(
            model_name="historyentry",
            name="action_type",
            field=models.CharField(
                choices=[
                    ("booking_created", "Reservation creee"),
                    ("check_in", "Check-in"),
                    ("check_out", "Check-out"),
                    ("day_use_created", "Day use cree"),
                    ("day_use_check_in", "Day use entree"),
                    ("day_use_check_out", "Day use sortie"),
                    ("cleaning_completed", "Nettoyage termine"),
                    ("payment_recorded", "Paiement enregistre"),
                    ("satisfaction_recorded", "Satisfaction enregistree"),
                    ("status_updated", "Statut mis a jour"),
                    ("other", "Autre"),
                ],
                max_length=40,
                verbose_name="Type d'action",
            ),
        ),
    ]
