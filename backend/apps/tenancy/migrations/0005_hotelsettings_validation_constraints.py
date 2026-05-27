from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0004_settings_navigation_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hotelsettings",
            name="deposit_percentage",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=5,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
                verbose_name="Pourcentage acompte",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="grace_period_minutes",
            field=models.PositiveSmallIntegerField(
                default=60,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(1440),
                ],
                verbose_name="Duree de grace",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="invoice_start_number",
            field=models.PositiveIntegerField(
                default=1,
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name="Numero de depart facture",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="primary_color",
            field=models.CharField(
                default="#0f9d8a",
                max_length=7,
                validators=[
                    django.core.validators.RegexValidator(
                        message="La couleur principale doit etre au format hexadecimal #RRGGBB.",
                        regex="^#[0-9A-Fa-f]{6}$",
                    )
                ],
                verbose_name="Couleur principale",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="session_timeout_minutes",
            field=models.PositiveSmallIntegerField(
                default=60,
                validators=[
                    django.core.validators.MinValueValidator(5),
                    django.core.validators.MaxValueValidator(1440),
                ],
                verbose_name="Duree de session",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="tax_rate",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=5,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
                verbose_name="Taux de taxe",
            ),
        ),
        migrations.AlterField(
            model_name="hotelsettings",
            name="total_rooms",
            field=models.PositiveIntegerField(
                default=1,
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name="Capacite totale de chambres",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("total_rooms__gte", 1)),
                name="settings_total_rooms_gte_1",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("deposit_percentage__gte", 0), ("deposit_percentage__lte", 100)),
                name="settings_deposit_pct_0_100",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("invoice_start_number__gte", 1)),
                name="settings_invoice_start_gte_1",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("tax_rate__gte", 0), ("tax_rate__lte", 100)),
                name="settings_tax_rate_0_100",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("grace_period_minutes__gte", 0), ("grace_period_minutes__lte", 1440)),
                name="settings_grace_0_1440",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=models.Q(("session_timeout_minutes__gte", 5), ("session_timeout_minutes__lte", 1440)),
                name="settings_session_5_1440",
            ),
        ),
        migrations.AddConstraint(
            model_name="hotelsettings",
            constraint=models.CheckConstraint(
                condition=~models.Q(("checkin_time", models.F("checkout_time"))),
                name="settings_checkin_checkout_diff",
            ),
        ),
    ]
