from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="hotelsettings",
            name="checkout_payment_policy",
            field=models.CharField(
                choices=[("BLOCKING", "Bloquant"), ("NON_BLOCKING", "Non bloquant")],
                default="BLOCKING",
                max_length=20,
                verbose_name="Politique paiement check-out",
            ),
        ),
    ]
