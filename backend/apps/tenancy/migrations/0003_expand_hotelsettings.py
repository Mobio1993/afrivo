from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0002_hotelsettings_checkout_payment_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="hotelsettings",
            name="address",
            field=models.CharField(blank=True, max_length=255, verbose_name="Adresse"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="allow_negative_balance",
            field=models.BooleanField(default=False, verbose_name="Autoriser solde negatif"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="cancellation_policy",
            field=models.CharField(
                choices=[("FLEXIBLE", "Flexible"), ("MODERATE", "Moderee"), ("STRICT", "Stricte")],
                default="MODERATE",
                max_length=20,
                verbose_name="Politique d'annulation",
            ),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="checkin_time",
            field=models.TimeField(default="14:00", verbose_name="Heure de check-in"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="checkout_time",
            field=models.TimeField(default="12:00", verbose_name="Heure de check-out"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="currency",
            field=models.CharField(
                choices=[
                    ("XOF", "Franc CFA"),
                    ("EUR", "Euro"),
                    ("USD", "Dollar US"),
                    ("GNF", "Franc guineen"),
                    ("CDF", "Franc congolais"),
                ],
                default="XOF",
                max_length=3,
                verbose_name="Devise",
            ),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="deposit_percentage",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5, verbose_name="Pourcentage acompte"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="deposit_required",
            field=models.BooleanField(default=False, verbose_name="Acompte obligatoire"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="email",
            field=models.EmailField(blank=True, max_length=254, verbose_name="Email"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="enable_activity_log",
            field=models.BooleanField(default=True, verbose_name="Journal d'activite active"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="grace_period_minutes",
            field=models.PositiveSmallIntegerField(default=60, verbose_name="Duree de grace"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="hotel_name_display",
            field=models.CharField(blank=True, max_length=180, verbose_name="Nom commercial affiche"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="invoice_start_number",
            field=models.PositiveIntegerField(default=1, verbose_name="Numero de depart facture"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="logo",
            field=models.FileField(blank=True, upload_to="hotel_logos/", verbose_name="Logo"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="no_show_policy",
            field=models.CharField(
                choices=[("MANUAL", "Manuel"), ("AUTO_AFTER_GRACE", "Automatique apres delai de grace")],
                default="AUTO_AFTER_GRACE",
                max_length=30,
                verbose_name="Politique no-show",
            ),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="payment_methods",
            field=models.JSONField(blank=True, default=list, verbose_name="Modes de paiement"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="phone",
            field=models.CharField(blank=True, max_length=40, verbose_name="Telephone"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="primary_color",
            field=models.CharField(default="#0f9d8a", max_length=7, verbose_name="Couleur principale"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="require_delete_confirmation",
            field=models.BooleanField(default=True, verbose_name="Confirmation avant suppression"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="require_payment_before_checkout",
            field=models.BooleanField(default=True, verbose_name="Paiement requis avant checkout"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="session_timeout_minutes",
            field=models.PositiveSmallIntegerField(default=60, verbose_name="Duree de session"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="tax_rate",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5, verbose_name="Taux de taxe"),
        ),
        migrations.AddField(
            model_name="hotelsettings",
            name="timezone",
            field=models.CharField(default="Atlantic/Reykjavik", max_length=64, verbose_name="Fuseau horaire"),
        ),
    ]
