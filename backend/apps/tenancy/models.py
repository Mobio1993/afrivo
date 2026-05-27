import re

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q


HEX_COLOR_VALIDATOR = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="La couleur principale doit etre au format hexadecimal #RRGGBB.",
)


class Organization(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspendue"
        INACTIVE = "inactive", "Inactive"

    name = models.CharField(max_length=150, unique=True, verbose_name="Nom")
    slug = models.SlugField(max_length=160, unique=True, verbose_name="Slug")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="Statut",
    )
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    platform = models.ForeignKey(
        "super_root.SuperRootPlatform",
        on_delete=models.SET_NULL,
        related_name="organizations",
        null=True,
        blank=True,
        verbose_name="Plateforme Super Root",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"
        ordering = ["name", "-id"]
        indexes = [
            models.Index(fields=["slug"], name="org_slug_idx"),
            models.Index(fields=["status"], name="org_status_idx"),
            models.Index(fields=["is_active"], name="org_active_idx"),
            models.Index(fields=["platform"], name="org_platform_idx"),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        update_fields = set(kwargs.get("update_fields") or [])
        if update_fields:
            if "status" in update_fields and "is_active" not in update_fields:
                self.is_active = self.status == self.Status.ACTIVE
                kwargs["update_fields"] = update_fields | {"is_active"}
            elif "is_active" in update_fields and "status" not in update_fields:
                self.status = self.Status.ACTIVE if self.is_active else self.Status.INACTIVE
                kwargs["update_fields"] = update_fields | {"status"}
        elif self.status != self.Status.ACTIVE:
            self.is_active = False
        elif not self.is_active:
            self.status = self.Status.INACTIVE
        super().save(*args, **kwargs)


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
    platform = models.ForeignKey(
        "super_root.SuperRootPlatform",
        on_delete=models.SET_NULL,
        related_name="hotels",
        null=True,
        blank=True,
        verbose_name="Plateforme Super Root",
    )
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
            models.Index(fields=["platform"], name="hotel_platform_idx"),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class HotelSettings(models.Model):
    class CheckoutPaymentPolicy(models.TextChoices):
        BLOCKING = "BLOCKING", "Bloquant"
        NON_BLOCKING = "NON_BLOCKING", "Non bloquant"

    class NoShowPolicy(models.TextChoices):
        MANUAL = "MANUAL", "Manuel"
        AUTO_AFTER_GRACE = "AUTO_AFTER_GRACE", "Automatique apres delai de grace"
        DISABLED = "DISABLED", "Desactive"

    class CancellationPolicy(models.TextChoices):
        FLEXIBLE = "FLEXIBLE", "Flexible"
        MODERATE = "MODERATE", "Moderee"
        STRICT = "STRICT", "Stricte"
        NON_REFUNDABLE = "NON_REFUNDABLE", "Non remboursable"

    class Currency(models.TextChoices):
        XOF = "XOF", "Franc CFA"
        EUR = "EUR", "Euro"
        USD = "USD", "Dollar US"
        GBP = "GBP", "Livre sterling"
        GNF = "GNF", "Franc guineen"
        CDF = "CDF", "Franc congolais"

    hotel = models.OneToOneField(
        Hotel,
        on_delete=models.CASCADE,
        related_name="settings",
        verbose_name="Hotel",
    )
    hotel_name_display = models.CharField(max_length=180, blank=True, verbose_name="Nom commercial affiche")
    logo = models.FileField(upload_to="hotel_logos/", blank=True, verbose_name="Logo")
    address = models.CharField(max_length=255, blank=True, verbose_name="Adresse")
    phone = models.CharField(max_length=40, blank=True, verbose_name="Telephone")
    email = models.EmailField(blank=True, verbose_name="Email")
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.XOF, verbose_name="Devise")
    timezone = models.CharField(max_length=64, default="Atlantic/Reykjavik", verbose_name="Fuseau horaire")
    total_rooms = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name="Capacite totale de chambres",
    )
    checkin_time = models.TimeField(default="14:00", verbose_name="Heure de check-in")
    checkout_time = models.TimeField(default="12:00", verbose_name="Heure de check-out")
    grace_period_minutes = models.PositiveSmallIntegerField(
        default=60,
        validators=[MinValueValidator(0), MaxValueValidator(1440)],
        verbose_name="Duree de grace",
    )
    no_show_policy = models.CharField(
        max_length=30,
        choices=NoShowPolicy.choices,
        default=NoShowPolicy.AUTO_AFTER_GRACE,
        verbose_name="Politique no-show",
    )
    cancellation_policy = models.CharField(
        max_length=20,
        choices=CancellationPolicy.choices,
        default=CancellationPolicy.MODERATE,
        verbose_name="Politique d'annulation",
    )
    deposit_required = models.BooleanField(default=False, verbose_name="Acompte obligatoire")
    deposit_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Pourcentage acompte",
    )
    check_in_hour = models.PositiveSmallIntegerField(default=14, verbose_name="Heure de check-in")
    check_out_hour = models.PositiveSmallIntegerField(default=12, verbose_name="Heure de check-out")
    default_language = models.CharField(max_length=10, default="fr", verbose_name="Langue par defaut")
    invoice_prefix = models.CharField(max_length=10, default="INV", verbose_name="Prefixe facture")
    invoice_start_number = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name="Numero de depart facture",
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Taux de taxe",
    )
    payment_methods = models.JSONField(default=list, blank=True, verbose_name="Modes de paiement")
    allow_negative_balance = models.BooleanField(default=False, verbose_name="Autoriser solde negatif")
    require_payment_before_checkout = models.BooleanField(default=True, verbose_name="Paiement requis avant checkout")
    payment_prefix = models.CharField(max_length=10, default="PAY", verbose_name="Prefixe paiement")
    booking_prefix = models.CharField(max_length=10, default="RES", verbose_name="Prefixe reservation")
    stay_prefix = models.CharField(max_length=10, default="STY", verbose_name="Prefixe sejour")
    day_use_prefix = models.CharField(max_length=10, default="DAY", verbose_name="Prefixe day use")
    satisfaction_enabled = models.BooleanField(default=True, verbose_name="Satisfaction activee")
    session_timeout_minutes = models.PositiveSmallIntegerField(
        default=60,
        validators=[MinValueValidator(5), MaxValueValidator(1440)],
        verbose_name="Duree de session",
    )
    require_delete_confirmation = models.BooleanField(default=True, verbose_name="Confirmation avant suppression")
    enable_activity_log = models.BooleanField(default=True, verbose_name="Journal d'activite active")
    primary_color = models.CharField(
        max_length=7,
        default="#0f9d8a",
        validators=[HEX_COLOR_VALIDATOR],
        verbose_name="Couleur principale",
    )
    checkout_payment_policy = models.CharField(
        max_length=20,
        choices=CheckoutPaymentPolicy.choices,
        default=CheckoutPaymentPolicy.BLOCKING,
        verbose_name="Politique paiement check-out",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Parametres hotel"
        verbose_name_plural = "Parametres hotel"
        constraints = [
            models.CheckConstraint(condition=Q(total_rooms__gte=1), name="settings_total_rooms_gte_1"),
            models.CheckConstraint(
                condition=Q(deposit_percentage__gte=0) & Q(deposit_percentage__lte=100),
                name="settings_deposit_pct_0_100",
            ),
            models.CheckConstraint(condition=Q(invoice_start_number__gte=1), name="settings_invoice_start_gte_1"),
            models.CheckConstraint(
                condition=Q(tax_rate__gte=0) & Q(tax_rate__lte=100),
                name="settings_tax_rate_0_100",
            ),
            models.CheckConstraint(
                condition=Q(grace_period_minutes__gte=0) & Q(grace_period_minutes__lte=1440),
                name="settings_grace_0_1440",
            ),
            models.CheckConstraint(
                condition=Q(session_timeout_minutes__gte=5) & Q(session_timeout_minutes__lte=1440),
                name="settings_session_5_1440",
            ),
            models.CheckConstraint(
                condition=~Q(checkin_time=F("checkout_time")),
                name="settings_checkin_checkout_diff",
            ),
        ]

    def __str__(self):
        return f"Parametres - {self.hotel.name}"

    def clean(self):
        errors = {}
        if not 0 <= self.check_in_hour <= 23:
            errors["check_in_hour"] = "L'heure de check-in doit etre comprise entre 0 et 23."
        if not 0 <= self.check_out_hour <= 23:
            errors["check_out_hour"] = "L'heure de check-out doit etre comprise entre 0 et 23."
        if self.checkin_time and self.checkout_time and self.checkin_time == self.checkout_time:
            errors["checkout_time"] = "L'heure de check-out doit etre differente de l'heure de check-in."
        if self.deposit_percentage < 0 or self.deposit_percentage > 100:
            errors["deposit_percentage"] = "Le pourcentage d'acompte doit etre compris entre 0 et 100."
        if self.deposit_required and self.deposit_percentage <= 0:
            errors["deposit_percentage"] = "Un acompte obligatoire doit avoir un pourcentage superieur a 0."
        if self.tax_rate < 0 or self.tax_rate > 100:
            errors["tax_rate"] = "Le taux de taxe doit etre compris entre 0 et 100."
        if self.invoice_start_number < 1:
            errors["invoice_start_number"] = "Le numero de depart doit etre superieur ou egal a 1."
        if self.total_rooms < 1:
            errors["total_rooms"] = "La capacite totale de chambres doit etre superieure ou egale a 1."
        if self.grace_period_minutes > 1440:
            errors["grace_period_minutes"] = "La duree de grace ne peut pas depasser 24 heures."
        if self.session_timeout_minutes < 5 or self.session_timeout_minutes > 1440:
            errors["session_timeout_minutes"] = "La session doit durer entre 5 minutes et 24 heures."
        if self.primary_color and not re.match(r"^#[0-9A-Fa-f]{6}$", self.primary_color):
            errors["primary_color"] = "La couleur principale doit etre au format hexadecimal, exemple #0f9d8a."
        if self.payment_methods is not None and not isinstance(self.payment_methods, list):
            errors["payment_methods"] = "Les modes de paiement doivent etre une liste."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if update_fields and "checkout_payment_policy" in update_fields and "require_payment_before_checkout" not in update_fields:
            self.require_payment_before_checkout = self.checkout_payment_policy == self.CheckoutPaymentPolicy.BLOCKING
            kwargs["update_fields"] = set(update_fields) | {"require_payment_before_checkout"}
        else:
            self.checkout_payment_policy = (
                self.CheckoutPaymentPolicy.BLOCKING
                if self.require_payment_before_checkout
                else self.CheckoutPaymentPolicy.NON_BLOCKING
            )
        super().save(*args, **kwargs)
