from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("history", "0004_activitylog"),
    ]

    operations = [
        migrations.AddField(
            model_name="activitylog",
            name="previous_integrity_hash",
            field=models.CharField(blank=True, max_length=64, verbose_name="Hash precedent"),
        ),
        migrations.AddField(
            model_name="activitylog",
            name="integrity_hash",
            field=models.CharField(blank=True, db_index=True, max_length=64, verbose_name="Hash integrite"),
        ),
    ]
