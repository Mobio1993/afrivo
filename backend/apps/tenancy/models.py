from django.core.exceptions import ValidationError
from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=150, unique=True, verbose_name="Nom")
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Slug")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"
        ordering = ["name", "-id"]
        indexes = [
            models.Index(fields=["slug"], name="org_slug_idx"),
            models.Index(fields=["is_active"], name="org_active_idx"),
        ]

    def __str__(self):
        return self.name


class Hotel(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="hotels",
        verbose_name="Organisation",
    )
    name = models.CharField(max_length=150, verbose_name="Nom")
    code = models.CharField(max_length=40, verbose_name="Code")
    slug = models.SlugField(max_length=160, verbose_name="Slug")
    country = models.CharField(max_length=100, blank=True, verbose_name="Pays")
    city = models.CharField(max_length=100, blank=True, verbose_name="Ville")
    timezone = models.CharField(max_length=64, default="Atlantic/Reykjavik", verbose_name="Fuseau horaire")
    currency = models.CharField(max_length=3, default="XOF", verbose_name="Devise")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Hotel"
        verbose_name_plural = "Hotels"
        ordering = ["organization__name", "name", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="uniq_hotel_code_per_org"),
            models.UniqueConstraint(fields=["organization", "slug"], name="uniq_hotel_slug_per_org"),
        ]
        indexes = [
            models.Index(fields=["organization", "name"], name="hotel_org_name_idx"),
            models.Index(fields=["organization", "code"], name="hotel_org_code_idx"),
            models.Index(fields=["is_active"], name="hotel_active_idx"),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class HotelSettings(models.Model):
    hotel = models.OneToOneField(
        Hotel,
        on_delete=models.CASCADE,
        related_name="settings",
        verbose_name="Hotel",
    )
    check_in_hour = models.PositiveSmallIntegerField(default=14, verbose_name="Heure de check-in")
    check_out_hour = models.PositiveSmallIntegerField(default=12, verbose_name="Heure de check-out")
    default_language = models.CharField(max_length=10, default="fr", verbose_name="Langue par defaut")
    invoice_prefix = models.CharField(max_length=10, default="INV", verbose_name="Prefixe facture")
    payment_prefix = models.CharField(max_length=10, default="PAY", verbose_name="Prefixe paiement")
    booking_prefix = models.CharField(max_length=10, default="RES", verbose_name="Prefixe reservation")
    stay_prefix = models.CharField(max_length=10, default="STY", verbose_name="Prefixe sejour")
    day_use_prefix = models.CharField(max_length=10, default="DAY", verbose_name="Prefixe day use")
    satisfaction_enabled = models.BooleanField(default=True, verbose_name="Satisfaction activee")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Parametres hotel"
        verbose_name_plural = "Parametres hotel"

    def __str__(self):
        return f"Parametres - {self.hotel.name}"

    def clean(self):
        errors = {}
        if not 0 <= self.check_in_hour <= 23:
            errors["check_in_hour"] = "L'heure de check-in doit etre comprise entre 0 et 23."
        if not 0 <= self.check_out_hour <= 23:
            errors["check_out_hour"] = "L'heure de check-out doit etre comprise entre 0 et 23."
        if errors:
            raise ValidationError(errors)

