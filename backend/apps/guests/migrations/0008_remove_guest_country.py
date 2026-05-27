from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0007_remove_guest_middle_name"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="guest",
            name="country",
        ),
    ]
