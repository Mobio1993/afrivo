from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0002_remove_guest_unique_guest_identity_document_and_more"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="guest",
            constraint=models.UniqueConstraint(
                condition=~models.Q(phone=""),
                fields=("phone",),
                name="unique_guest_phone",
            ),
        ),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(fields=["last_name", "first_name"], name="guest_name_idx"),
        ),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(fields=["phone"], name="guest_phone_idx"),
        ),
        migrations.AddIndex(
            model_name="guest",
            index=models.Index(fields=["identity_document_number"], name="guest_identity_idx"),
        ),
    ]
