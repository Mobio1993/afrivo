from django.db import migrations, models
import django.db.models.expressions


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Guest",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("first_name", models.CharField(max_length=100, verbose_name="Prenom")),
                ("last_name", models.CharField(max_length=100, verbose_name="Nom")),
                (
                    "gender",
                    models.CharField(
                        blank=True,
                        choices=[("male", "Homme"), ("female", "Femme"), ("other", "Autre")],
                        max_length=20,
                        verbose_name="Sexe",
                    ),
                ),
                (
                    "date_of_birth",
                    models.DateField(blank=True, null=True, verbose_name="Date de naissance"),
                ),
                ("phone", models.CharField(blank=True, max_length=20, verbose_name="Telephone")),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="Email")),
                ("address", models.CharField(blank=True, max_length=255, verbose_name="Adresse")),
                ("city", models.CharField(blank=True, max_length=100, verbose_name="Ville")),
                ("country", models.CharField(blank=True, max_length=100, verbose_name="Pays")),
                (
                    "identity_document_type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("national_id", "Carte nationale d'identite"),
                            ("passport", "Passeport"),
                            ("driver_license", "Permis de conduire"),
                            ("other", "Autre"),
                        ],
                        max_length=30,
                        verbose_name="Type de piece",
                    ),
                ),
                (
                    "identity_document_number",
                    models.CharField(blank=True, max_length=100, verbose_name="Numero de piece"),
                ),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("is_blacklisted", models.BooleanField(default=False, verbose_name="Blacklist")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
            ],
            options={
                "verbose_name": "Client",
                "verbose_name_plural": "Clients",
                "ordering": ["last_name", "first_name", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="guest",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("identity_document_number__gt", ""),
                    ("identity_document_type__gt", ""),
                ),
                fields=("identity_document_type", "identity_document_number"),
                name="unique_guest_identity_document",
            ),
        ),
    ]
