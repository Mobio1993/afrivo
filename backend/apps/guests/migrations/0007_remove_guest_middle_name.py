from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("guests", "0006_guest_client_code"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="guest",
            name="middle_name",
        ),
    ]
