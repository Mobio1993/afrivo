from django.db import migrations, models


def enable_existing_day_use_room_types(apps, schema_editor):
    RoomType = apps.get_model("rooms", "RoomType")
    RoomType.objects.filter(
        base_price_day_use=0,
        base_price_per_night__gt=0,
    ).update(
        base_price_day_use=models.F("base_price_per_night"),
        is_day_use_available=True,
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("rooms", "0005_smart_rooms"),
    ]

    operations = [
        migrations.RunPython(enable_existing_day_use_room_types, noop_reverse),
    ]
