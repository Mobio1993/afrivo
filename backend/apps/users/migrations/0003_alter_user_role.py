from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_organization_user_hotel"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Administrateur"),
                    ("reception", "Reception"),
                    ("cashier", "Caissier"),
                    ("housekeeping", "Housekeeping"),
                    ("manager", "Manager"),
                    ("restaurant", "Restaurant"),
                ],
                default="reception",
                max_length=20,
                verbose_name="Role",
            ),
        ),
    ]
