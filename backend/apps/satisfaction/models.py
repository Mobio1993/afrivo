from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.consumptions.models import ClientConsumption
from apps.core.references import generate_unique_reference
from apps.guests.models import Guest
from apps.stays.models import Stay


RATING_VALIDATORS = [MinValueValidator(1), MaxValueValidator(5)]
RECOMMENDATION_VALIDATORS = [MinValueValidator(0), MaxValueValidator(10)]


class ClientSatisfaction(models.Model):
    class SatisfactionLevel(models.TextChoices):
        VERY_SATISFIED = "very_satisfied", "Tres satisfait"
        SATISFIED = "satisfied", "Satisfait"
        NEUTRAL = "neutral", "Neutre"
        DISSATISFIED = "dissatisfied", "Insatisfait"
        VERY_DISSATISFIED = "very_dissatisfied", "Tres insatisfait"

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Soumis"
        FLAGGED = "flagged", "A verifier"
        RECORDED = "recorded", "Enregistre"
        REVIEWED = "reviewed", "Relu"
        ESCALATED = "escalated", "A traiter"
        CLOSED = "closed", "Clos"

    class Source(models.TextChoices):
        MOBILE_APP = "mobile_app", "Application mobile"
        WEB_APP = "web_app", "Application web"
        FRONTDESK = "frontdesk", "Reception"
        POST_STAY = "post_stay", "Post-sejour"
        EMAIL = "email", "Email"
        PHONE = "phone", "Telephone"
        QR_CODE = "qr_code", "QR code"
        MANUAL = "manual", "Saisie manuelle"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    client = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="satisfactions",
        verbose_name="Client",
    )
    stay = models.ForeignKey(
        Stay,
        on_delete=models.PROTECT,
        related_name="satisfactions",
        blank=True,
        null=True,
        verbose_name="Sejour",
    )
    consumption = models.ForeignKey(
        ClientConsumption,
        on_delete=models.PROTECT,
        related_name="satisfactions",
        blank=True,
        null=True,
        verbose_name="Consommation",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="client_satisfactions_recorded",
        blank=True,
        null=True,
        verbose_name="Enregistre par",
    )
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.SET_NULL,
        related_name="satisfactions",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    overall_rating = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        validators=RATING_VALIDATORS,
        verbose_name="Note globale",
    )
    satisfaction_level = models.CharField(
        max_length=24,
        choices=SatisfactionLevel.choices,
        blank=True,
        verbose_name="Niveau de satisfaction",
    )
    recommendation_score = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        validators=RECOMMENDATION_VALIDATORS,
        verbose_name="Score de recommandation",
    )
    would_recommend = models.BooleanField(
        blank=True,
        null=True,
        verbose_name="Recommanderait l'hotel",
    )
    reception_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Accueil")
    room_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Chambre")
    cleanliness_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Proprete")
    restaurant_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Restaurant")
    bar_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Bar")
    pool_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Piscine")
    spa_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Spa")
    laundry_rating = models.PositiveSmallIntegerField(blank=True, null=True, validators=RATING_VALIDATORS, verbose_name="Blanchisserie")
    positive_points = models.TextField(blank=True, verbose_name="Points positifs")
    negative_points = models.TextField(blank=True, verbose_name="Points negatifs")
    suggestions = models.TextField(blank=True, verbose_name="Suggestions")
    notes = models.TextField(blank=True, verbose_name="Notes internes")
    submitted_at = models.DateTimeField(default=timezone.now, verbose_name="Soumis le")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
        verbose_name="Statut",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Origine",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Satisfaction client"
        verbose_name_plural = "Satisfactions clients"
        ordering = ["-submitted_at", "-id"]
        indexes = [
            models.Index(fields=["client", "submitted_at"], name="satisfaction_client_date_idx"),
            models.Index(fields=["stay", "submitted_at"], name="satisfaction_stay_date_idx"),
            models.Index(fields=["status"], name="satisfaction_status_idx"),
            models.Index(fields=["satisfaction_level"], name="satisfaction_level_idx"),
            models.Index(fields=["overall_rating"], name="satisfaction_rating_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.client.full_name}"

    @staticmethod
    def generate_reference():
        return generate_unique_reference(ClientSatisfaction, "SAT")

    @staticmethod
    def derive_satisfaction_level(overall_rating):
        if overall_rating is None:
            return ""
        if overall_rating >= 5:
            return ClientSatisfaction.SatisfactionLevel.VERY_SATISFIED
        if overall_rating == 4:
            return ClientSatisfaction.SatisfactionLevel.SATISFIED
        if overall_rating == 3:
            return ClientSatisfaction.SatisfactionLevel.NEUTRAL
        if overall_rating == 2:
            return ClientSatisfaction.SatisfactionLevel.DISSATISFIED
        return ClientSatisfaction.SatisfactionLevel.VERY_DISSATISFIED

    def clean(self):
        errors = {}

        if self.stay_id and self.stay and self.stay.guest_id != self.client_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme client."

        if self.consumption_id and self.consumption and self.consumption.client_id != self.client_id:
            errors["consumption"] = "La consommation selectionnee doit appartenir au meme client."

        if self.consumption_id and self.consumption and self.stay_id and self.consumption.stay_id:
            if self.consumption.stay_id != self.stay_id:
                errors["consumption"] = "La consommation ne correspond pas au sejour selectionne."

        if self.consumption_id and self.consumption and not self.stay_id and self.consumption.stay_id:
            self.stay = self.consumption.stay

        if self.submitted_at and self.submitted_at > timezone.now() + timezone.timedelta(minutes=5):
            errors["submitted_at"] = "La date de soumission ne peut pas etre dans le futur."

        if not self.satisfaction_level and self.overall_rating:
            self.satisfaction_level = self.derive_satisfaction_level(self.overall_rating)

        duplicate_queryset = ClientSatisfaction.objects.filter(client=self.client, stay=self.stay)
        if self.pk:
            duplicate_queryset = duplicate_queryset.exclude(pk=self.pk)
        if self.stay_id and duplicate_queryset.exists():
            errors["stay"] = "Un avis existe deja pour ce sejour."

        if not any(
            [
                self.overall_rating,
                self.recommendation_score is not None,
                self.positive_points,
                self.negative_points,
                self.suggestions,
                self.reception_rating,
                self.room_rating,
                self.cleanliness_rating,
                self.restaurant_rating,
                self.bar_rating,
                self.pool_rating,
                self.spa_rating,
                self.laundry_rating,
            ]
        ):
            errors["overall_rating"] = "Renseigne au moins une note ou un commentaire de satisfaction."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self.generate_reference()
        if not self.satisfaction_level and self.overall_rating:
            self.satisfaction_level = self.derive_satisfaction_level(self.overall_rating)
        self.full_clean()
        super().save(*args, **kwargs)
