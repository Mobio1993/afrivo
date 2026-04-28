from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stays", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stay",
            name="check_out_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Check-out effectue le",
            ),
        ),
    ]
