from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class SubscriptionPlan(models.Model):
    code = models.CharField(max_length=40, unique=True, verbose_name="Code")
    name = models.CharField(max_length=120, verbose_name="Nom")
    description = models.TextField(blank=True, verbose_name="Description")
    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Prix mensuel",
    )
    yearly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Prix annuel",
    )
    max_hotels = models.PositiveIntegerField(default=1, verbose_name="Hotels maximum")
    max_users = models.PositiveIntegerField(default=5, verbose_name="Utilisateurs maximum")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Plan d'abonnement"
        verbose_name_plural = "Plans d'abonnement"
        ordering = ["name", "code"]
        indexes = [
            models.Index(fields=["code"], name="sub_plan_code_idx"),
            models.Index(fields=["is_active"], name="sub_plan_active_idx"),
        ]

    def __str__(self):
        return self.name


class HotelSubscription(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        TRIAL = "trial", "Essai"
        ACTIVE = "active", "Actif"
        SUSPENDED = "suspended", "Suspendu"
        EXPIRED = "expired", "Expire"
        CANCELLED = "cancelled", "Annule"

    class BillingCycle(models.TextChoices):
        MONTHLY = "monthly", "Mensuel"
        YEARLY = "yearly", "Annuel"
        CUSTOM = "custom", "Personnalise"

    organization = models.ForeignKey(
        "tenancy.Organization",
        on_delete=models.PROTECT,
        related_name="hotel_subscriptions",
        verbose_name="Organisation",
    )
    hotel = models.OneToOneField(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="subscription",
        verbose_name="Hotel",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="hotel_subscriptions",
        verbose_name="Plan",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Statut",
    )
    starts_at = models.DateTimeField(default=timezone.now, verbose_name="Debut")
    ends_at = models.DateTimeField(blank=True, null=True, verbose_name="Fin")
    trial_ends_at = models.DateTimeField(blank=True, null=True, verbose_name="Fin d'essai")
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.MONTHLY,
        verbose_name="Cycle de facturation",
    )
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Abonnement hotel"
        verbose_name_plural = "Abonnements hotels"
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["organization", "status"], name="hotel_sub_org_status_idx"),
            models.Index(fields=["plan", "status"], name="hotel_sub_plan_status_idx"),
            models.Index(fields=["ends_at"], name="hotel_sub_ends_at_idx"),
            models.Index(fields=["trial_ends_at"], name="hotel_sub_trial_ends_idx"),
        ]

    def __str__(self):
        return f"{self.hotel.name} - {self.plan.name}"

    def clean(self):
        errors = {}

        if self.hotel_id and self.organization_id != self.hotel.organization_id:
            errors["organization"] = "L'organisation doit correspondre a celle de l'hotel selectionne."

        if self.ends_at and self.ends_at < self.starts_at:
            errors["ends_at"] = "La fin d'abonnement ne peut pas etre anterieure au debut."

        if self.trial_ends_at and self.trial_ends_at < self.starts_at:
            errors["trial_ends_at"] = "La fin d'essai ne peut pas etre anterieure au debut."

        if self.status == self.Status.TRIAL and not self.trial_ends_at:
            errors["trial_ends_at"] = "Une date de fin d'essai est requise pour un abonnement en essai."

        if errors:
            raise ValidationError(errors)


class PlatformAuditEvent(models.Model):
    class EventType(models.TextChoices):
        ORGANIZATION_CREATED = "organization_created", "Organisation creee"
        ORGANIZATION_UPDATED = "organization_updated", "Organisation mise a jour"
        HOTEL_CREATED = "hotel_created", "Hotel cree"
        HOTEL_UPDATED = "hotel_updated", "Hotel mis a jour"
        HOTEL_SUSPENDED = "hotel_suspended", "Hotel suspendu"
        HOTEL_REACTIVATED = "hotel_reactivated", "Hotel reactive"
        SUBSCRIPTION_CREATED = "subscription_created", "Abonnement cree"
        SUBSCRIPTION_UPDATED = "subscription_updated", "Abonnement mis a jour"
        USER_LINKED = "user_linked", "Utilisateur rattache"
        SECURITY_REVIEW = "security_review", "Revue de securite"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="platform_audit_events",
        blank=True,
        null=True,
        verbose_name="Acteur",
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices, verbose_name="Type d'evenement")
    target_type = models.CharField(max_length=50, verbose_name="Type de cible")
    target_id = models.PositiveIntegerField(blank=True, null=True, verbose_name="ID cible")
    target_label = models.CharField(max_length=150, blank=True, verbose_name="Libelle cible")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadonnees")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Evenement d'audit plateforme"
        verbose_name_plural = "Evenements d'audit plateforme"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["event_type", "created_at"], name="plat_audit_type_created_idx"),
            models.Index(fields=["target_type", "target_id"], name="plat_audit_target_idx"),
            models.Index(fields=["created_at"], name="plat_audit_created_idx"),
        ]

    def __str__(self):
        label = self.target_label or self.target_type
        return f"{self.get_event_type_display()} - {label}"

