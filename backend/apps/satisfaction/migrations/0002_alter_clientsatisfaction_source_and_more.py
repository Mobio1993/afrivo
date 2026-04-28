from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("satisfaction", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="clientsatisfaction",
            name="source",
            field=models.CharField(
                choices=[
                    ("mobile_app", "Application mobile"),
                    ("web_app", "Application web"),
                    ("frontdesk", "Reception"),
                    ("post_stay", "Post-sejour"),
                    ("email", "Email"),
                    ("phone", "Telephone"),
                    ("qr_code", "QR code"),
                    ("manual", "Saisie manuelle"),
                    ("other", "Autre"),
                ],
                default="manual",
                max_length=20,
                verbose_name="Origine",
            ),
        ),
        migrations.AlterField(
            model_name="clientsatisfaction",
            name="status",
            field=models.CharField(
                choices=[
                    ("submitted", "Soumis"),
                    ("flagged", "A verifier"),
                    ("recorded", "Enregistre"),
                    ("reviewed", "Relu"),
                    ("escalated", "A traiter"),
                    ("closed", "Clos"),
                ],
                default="submitted",
                max_length=20,
                verbose_name="Statut",
            ),
        ),
    ]
