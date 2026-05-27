from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0003_expand_hotelsettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="hotelsettings",
            name="total_rooms",
            field=models.PositiveIntegerField(default=1, verbose_name="Capacite totale de chambres"),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="cancellation_policy",
            field=models.CharField(
                choices=[
                    ("FLEXIBLE", "Flexible"),
                    ("MODERATE", "Moderee"),
                    ("STRICT", "Stricte"),
                    ("NON_REFUNDABLE", "Non remboursable"),
                ],
                default="MODERATE",
                max_length=20,
                verbose_name="Politique d'annulation",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="currency",
            field=models.CharField(
                choices=[
                    ("XOF", "Franc CFA"),
                    ("EUR", "Euro"),
                    ("USD", "Dollar US"),
                    ("GBP", "Livre sterling"),
                    ("GNF", "Franc guineen"),
                    ("CDF", "Franc congolais"),
                ],
                default="XOF",
                max_length=3,
                verbose_name="Devise",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="no_show_policy",
            field=models.CharField(
                choices=[
                    ("MANUAL", "Manuel"),
                    ("AUTO_AFTER_GRACE", "Automatique apres delai de grace"),
                    ("DISABLED", "Desactive"),
                ],
                default="AUTO_AFTER_GRACE",
                max_length=30,
                verbose_name="Politique no-show",
            ),
        ),
    ]
