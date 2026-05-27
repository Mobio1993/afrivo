from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("pos_restaurant", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="menuitem",
            name="image",
            field=models.ImageField(
                blank=True,
                help_text="Photo du plat ou de la boisson. Formats acceptes : JPG, PNG, WEBP. Recommande : 400x300px minimum.",
                null=True,
                upload_to="pos/menu/",
            ),
        ),
        migrations.AddField(
            model_name="menuitem",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="menuitem",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
