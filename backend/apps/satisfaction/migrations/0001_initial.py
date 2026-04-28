from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("consumptions", "0002_clientconsumption_reservation_clientconsumption_room_and_more"),
        ("guests", "0004_guest_client_type_guest_document_expiry_date_and_more"),
        ("stays", "0003_stay_actual_check_in_stay_actual_check_out_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ClientSatisfaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(max_length=20, unique=True, verbose_name="Reference")),
                ("overall_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Note globale")),
                ("satisfaction_level", models.CharField(blank=True, choices=[("very_satisfied", "Tres satisfait"), ("satisfied", "Satisfait"), ("neutral", "Neutre"), ("dissatisfied", "Insatisfait"), ("very_dissatisfied", "Tres insatisfait")], max_length=24, verbose_name="Niveau de satisfaction")),
                ("recommendation_score", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(10)], verbose_name="Score de recommandation")),
                ("would_recommend", models.BooleanField(blank=True, null=True, verbose_name="Recommanderait l'hotel")),
                ("reception_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Accueil")),
                ("room_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Chambre")),
                ("cleanliness_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Proprete")),
                ("restaurant_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Restaurant")),
                ("bar_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Bar")),
                ("pool_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Piscine")),
                ("spa_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Spa")),
                ("laundry_rating", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name="Blanchisserie")),
                ("positive_points", models.TextField(blank=True, verbose_name="Points positifs")),
                ("negative_points", models.TextField(blank=True, verbose_name="Points negatifs")),
                ("suggestions", models.TextField(blank=True, verbose_name="Suggestions")),
                ("notes", models.TextField(blank=True, verbose_name="Notes internes")),
                ("submitted_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Soumis le")),
                ("status", models.CharField(choices=[("recorded", "Enregistre"), ("reviewed", "Relu"), ("escalated", "A traiter"), ("closed", "Clos")], default="recorded", max_length=20, verbose_name="Statut")),
                ("source", models.CharField(choices=[("frontdesk", "Reception"), ("post_stay", "Post-sejour"), ("email", "Email"), ("phone", "Telephone"), ("qr_code", "QR code"), ("manual", "Saisie manuelle"), ("other", "Autre")], default="manual", max_length=20, verbose_name="Origine")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                ("client", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="satisfactions", to="guests.guest", verbose_name="Client")),
                ("consumption", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="satisfactions", to="consumptions.clientconsumption", verbose_name="Consommation")),
                ("recorded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="client_satisfactions_recorded", to=settings.AUTH_USER_MODEL, verbose_name="Enregistre par")),
                ("stay", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="satisfactions", to="stays.stay", verbose_name="Sejour")),
            ],
            options={
                "verbose_name": "Satisfaction client",
                "verbose_name_plural": "Satisfactions clients",
                "ordering": ["-submitted_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="clientsatisfaction",
            index=models.Index(fields=["client", "submitted_at"], name="satisfaction_client_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientsatisfaction",
            index=models.Index(fields=["stay", "submitted_at"], name="satisfaction_stay_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientsatisfaction",
            index=models.Index(fields=["status"], name="satisfaction_status_idx"),
        ),
        migrations.AddIndex(
            model_name="clientsatisfaction",
            index=models.Index(fields=["satisfaction_level"], name="satisfaction_level_idx"),
        ),
        migrations.AddIndex(
            model_name="clientsatisfaction",
            index=models.Index(fields=["overall_rating"], name="satisfaction_rating_idx"),
        ),
    ]
