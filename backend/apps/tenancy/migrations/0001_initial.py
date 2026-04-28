from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150, unique=True, verbose_name="Nom")),
                ("slug", models.SlugField(max_length=160, unique=True, verbose_name="Slug")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
            ],
            options={
                "verbose_name": "Organisation",
                "verbose_name_plural": "Organisations",
                "ordering": ["name", "-id"],
            },
        ),
        migrations.CreateModel(
            name="Hotel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150, verbose_name="Nom")),
                ("code", models.CharField(max_length=40, verbose_name="Code")),
                ("slug", models.SlugField(max_length=160, verbose_name="Slug")),
                ("country", models.CharField(blank=True, max_length=100, verbose_name="Pays")),
                ("city", models.CharField(blank=True, max_length=100, verbose_name="Ville")),
                ("timezone", models.CharField(default="Atlantic/Reykjavik", max_length=64, verbose_name="Fuseau horaire")),
                ("currency", models.CharField(default="XOF", max_length=3, verbose_name="Devise")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="hotels",
                        to="tenancy.organization",
                        verbose_name="Organisation",
                    ),
                ),
            ],
            options={
                "verbose_name": "Hotel",
                "verbose_name_plural": "Hotels",
                "ordering": ["organization__name", "name", "-id"],
            },
        ),
        migrations.CreateModel(
            name="HotelSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("check_in_hour", models.PositiveSmallIntegerField(default=14, verbose_name="Heure de check-in")),
                ("check_out_hour", models.PositiveSmallIntegerField(default=12, verbose_name="Heure de check-out")),
                ("default_language", models.CharField(default="fr", max_length=10, verbose_name="Langue par defaut")),
                ("invoice_prefix", models.CharField(default="INV", max_length=10, verbose_name="Prefixe facture")),
                ("payment_prefix", models.CharField(default="PAY", max_length=10, verbose_name="Prefixe paiement")),
                ("booking_prefix", models.CharField(default="RES", max_length=10, verbose_name="Prefixe reservation")),
                ("stay_prefix", models.CharField(default="STY", max_length=10, verbose_name="Prefixe sejour")),
                ("day_use_prefix", models.CharField(default="DAY", max_length=10, verbose_name="Prefixe day use")),
                ("satisfaction_enabled", models.BooleanField(default=True, verbose_name="Satisfaction activee")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "hotel",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="settings",
                        to="tenancy.hotel",
                        verbose_name="Hotel",
                    ),
                ),
            ],
            options={
                "verbose_name": "Parametres hotel",
                "verbose_name_plural": "Parametres hotel",
            },
        ),
        migrations.AddIndex(
            model_name="organization",
            index=models.Index(fields=["slug"], name="org_slug_idx"),
        ),
        migrations.AddIndex(
            model_name="organization",
            index=models.Index(fields=["is_active"], name="org_active_idx"),
        ),
        migrations.AddConstraint(
            model_name="hotel",
            constraint=models.UniqueConstraint(fields=("organization", "code"), name="uniq_hotel_code_per_org"),
        ),
        migrations.AddConstraint(
            model_name="hotel",
            constraint=models.UniqueConstraint(fields=("organization", "slug"), name="uniq_hotel_slug_per_org"),
        ),
        migrations.AddIndex(
            model_name="hotel",
            index=models.Index(fields=["organization", "name"], name="hotel_org_name_idx"),
        ),
        migrations.AddIndex(
            model_name="hotel",
            index=models.Index(fields=["organization", "code"], name="hotel_org_code_idx"),
        ),
        migrations.AddIndex(
            model_name="hotel",
            index=models.Index(fields=["is_active"], name="hotel_active_idx"),
        ),
    ]
