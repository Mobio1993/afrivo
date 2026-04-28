from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone

from apps.bookings.models import Booking
from apps.core.references import generate_unique_reference
from apps.guests.models import Guest
from apps.rooms.models import Room
from apps.stays.models import Stay


AMOUNT_QUANTIZER = Decimal("0.01")


def normalize_decimal(value, default="0.00"):
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


class ServiceDepartment(models.Model):
    class DepartmentType(models.TextChoices):
        ROOM = "room", "Chambre"
        RESTAURANT = "restaurant", "Restaurant"
        BAR = "bar", "Bar"
        POOL = "pool", "Piscine"
        NIGHTCLUB = "nightclub", "Night-club"
        SPA = "spa", "Spa"
        LAUNDRY = "laundry", "Blanchisserie"
        EVENTS = "events", "Evenements"
        OTHER = "other", "Autres services"

    code = models.SlugField(max_length=50, unique=True, verbose_name="Code")
    name = models.CharField(max_length=100, unique=True, verbose_name="Nom")
    department_type = models.CharField(
        max_length=20,
        choices=DepartmentType.choices,
        default=DepartmentType.OTHER,
        verbose_name="Type de service",
    )
    description = models.TextField(blank=True, verbose_name="Description")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Departement de service"
        verbose_name_plural = "Departements de service"
        ordering = ["name", "-id"]
        indexes = [
            models.Index(fields=["department_type"], name="svc_dept_type_idx"),
            models.Index(fields=["is_active"], name="svc_dept_active_idx"),
        ]

    def __str__(self):
        return self.name


class ClientConsumption(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        POSTED = "posted", "Validee"
        BILLED = "billed", "Facturee"
        CANCELLED = "cancelled", "Annulee"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Non payee"
        PARTIAL = "partial", "Partiellement payee"
        PAID = "paid", "Payee"
        REFUNDED = "refunded", "Remboursee"

    class Source(models.TextChoices):
        MANUAL = "manual", "Saisie manuelle"
        ROOM = "room", "Chambre"
        RESTAURANT = "restaurant", "Restaurant"
        BAR = "bar", "Bar"
        POOL = "pool", "Piscine"
        NIGHTCLUB = "nightclub", "Night-club"
        SPA = "spa", "Spa"
        LAUNDRY = "laundry", "Blanchisserie"
        EVENTS = "events", "Evenements"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=30, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    client = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Client",
    )
    stay = models.ForeignKey(
        Stay,
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Sejour",
        blank=True,
        null=True,
    )
    reservation = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Reservation",
        blank=True,
        null=True,
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Chambre",
        blank=True,
        null=True,
    )
    service_department = models.ForeignKey(
        ServiceDepartment,
        on_delete=models.PROTECT,
        related_name="consumptions",
        verbose_name="Departement de service",
    )
    label = models.CharField(max_length=150, verbose_name="Libelle")
    description = models.TextField(blank=True, verbose_name="Description")
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
        verbose_name="Quantite",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Prix unitaire",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Montant total",
    )
    service_date = models.DateTimeField(default=timezone.now, verbose_name="Date de service")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Statut",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        verbose_name="Statut de paiement",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Source",
    )
    billing_reference = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Reference de facturation",
        help_text="Reference externe de facture/folio pour eviter une double facturation.",
    )
    billed_at = models.DateTimeField(blank=True, null=True, verbose_name="Facturee le")
    tenant_code = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Code hotel/tenant",
        help_text="Champ de preparation SaaS en attendant un vrai modele Hotel/Tenant.",
    )
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="client_consumptions_created",
        verbose_name="Cree par",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Consommation client"
        verbose_name_plural = "Consommations clients"
        ordering = ["-service_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="client_consumption_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="client_consumption_unit_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="client_consumption_quantity_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "service_date"], name="cons_hotel_date_idx"),
            models.Index(fields=["hotel", "status"], name="cons_hotel_status_idx"),
            models.Index(fields=["client", "service_date"], name="cons_client_date_idx"),
            models.Index(fields=["stay", "service_date"], name="cons_stay_date_idx"),
            models.Index(fields=["reservation", "service_date"], name="cons_booking_date_idx"),
            models.Index(fields=["room", "service_date"], name="cons_room_date_idx"),
            models.Index(fields=["service_department", "service_date"], name="cons_dept_date_idx"),
            models.Index(fields=["status"], name="cons_status_idx"),
            models.Index(fields=["payment_status"], name="cons_payment_status_idx"),
            models.Index(fields=["source"], name="cons_source_idx"),
            models.Index(fields=["billing_reference"], name="cons_billing_ref_idx"),
            models.Index(fields=["tenant_code"], name="cons_tenant_code_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.label}"

    @property
    def consumed_at(self):
        return self.service_date

    @property
    def service(self):
        return self.service_department

    @property
    def is_billed(self):
        return self.status == self.Status.BILLED

    @property
    def is_paid(self):
        return self.payment_status == self.PaymentStatus.PAID

    def clean(self):
        errors = {}

        if self.stay_id and self.stay and self.stay.hotel_id and not self.hotel_id:
            self.hotel = self.stay.hotel
        if self.reservation_id and self.reservation and self.reservation.hotel_id and not self.hotel_id:
            self.hotel = self.reservation.hotel
        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel
        if self.client_id and self.client and self.client.hotel_id and not self.hotel_id:
            self.hotel = self.client.hotel

        if self.stay_id and self.stay and self.stay.guest_id != self.client_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme client."

        if self.reservation_id and self.reservation and self.reservation.guest_id != self.client_id:
            errors["reservation"] = "La reservation selectionnee doit appartenir au meme client."

        if self.stay_id and self.stay and self.stay.booking_id and not self.reservation_id:
            self.reservation = self.stay.booking

        if self.stay_id and self.stay and not self.room_id:
            self.room = self.stay.room

        if self.reservation_id and self.reservation and not self.room_id and self.reservation.room_id:
            self.room = self.reservation.room

        if self.stay_id and self.reservation_id and self.stay and self.reservation:
            if self.stay.booking_id and self.stay.booking_id != self.reservation_id:
                errors["reservation"] = "La reservation ne correspond pas au sejour selectionne."

        if self.room_id and self.room and not self.room.is_active:
            errors["room"] = "La chambre selectionnee est inactive."

        if self.room_id and self.stay_id and self.stay and self.stay.room_id != self.room_id:
            errors["room"] = "La chambre doit correspondre a celle du sejour selectionne."

        if self.room_id and self.reservation_id and self.reservation and self.reservation.room_id:
            if self.reservation.room_id != self.room_id:
                errors["room"] = "La chambre doit correspondre a celle de la reservation selectionnee."

        if self.hotel_id and self.client_id and self.client and self.client.hotel_id and self.client.hotel_id != self.hotel_id:
            errors["client"] = "Le client selectionne doit appartenir au meme hotel que la consommation."

        if self.hotel_id and self.stay_id and self.stay and self.stay.hotel_id and self.stay.hotel_id != self.hotel_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme hotel que la consommation."

        if self.hotel_id and self.reservation_id and self.reservation and self.reservation.hotel_id and self.reservation.hotel_id != self.hotel_id:
            errors["reservation"] = "La reservation selectionnee doit appartenir au meme hotel que la consommation."

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre selectionnee doit appartenir au meme hotel que la consommation."

        if self.status == self.Status.BILLED and not self.billing_reference:
            errors["billing_reference"] = ["Une reference de facturation est requise pour une consommation facturee."]

        if self.status == self.Status.CANCELLED and self.payment_status == self.PaymentStatus.PAID:
            errors["payment_status"] = ["Une consommation annulee ne peut pas rester au statut paye."]

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self.generate_reference()

        if self.status == self.Status.BILLED and not self.billed_at:
            self.billed_at = timezone.now()
        if self.status != self.Status.BILLED and self.billed_at:
            self.billed_at = None
            self.billing_reference = self.billing_reference if self.status == self.Status.CANCELLED else ""

        existing_pk = self.pk
        self.total_amount = self.calculate_total_amount()
        self.full_clean()
        super().save(*args, **kwargs)

        # If line items already exist, the header total must reflect the sum of its lines.
        if existing_pk:
            self.refresh_totals_from_items()

    def delete(self, using=None, keep_parents=False):
        if self.status != self.Status.CANCELLED:
            self.status = self.Status.CANCELLED
            self.save(update_fields=["status", "updated_at"])
        return 0, {self._meta.label: 1}

    def calculate_total_amount(self):
        if self.pk and self.items.exists():
            aggregated = self.items.aggregate(total=Sum("total_amount"))
            return (aggregated["total"] or Decimal("0.00")).quantize(AMOUNT_QUANTIZER)
        return (normalize_decimal(self.quantity) * normalize_decimal(self.unit_price)).quantize(AMOUNT_QUANTIZER)

    def refresh_totals_from_items(self):
        if not self.pk or not self.items.exists():
            return

        aggregated = self.items.aggregate(total=Sum("total_amount"))
        computed_total = (aggregated["total"] or Decimal("0.00")).quantize(AMOUNT_QUANTIZER)
        if self.total_amount != computed_total:
            self.total_amount = computed_total
            super().save(update_fields=["total_amount", "updated_at"])

    def mark_as_posted(self):
        if self.status != self.Status.DRAFT:
            raise ValidationError("Seule une consommation en brouillon peut etre validee.")
        self.status = self.Status.POSTED
        self.save(update_fields=["status", "updated_at"])

    def mark_as_billed(self, billing_reference):
        if self.status == self.Status.BILLED:
            raise ValidationError("Cette consommation est deja facturee.")
        if self.status == self.Status.CANCELLED:
            raise ValidationError("Une consommation annulee ne peut pas etre facturee.")
        self.status = self.Status.BILLED
        self.billing_reference = (billing_reference or "").strip()
        self.billed_at = timezone.now()
        self.save(update_fields=["status", "billing_reference", "billed_at", "updated_at"])

    def cancel(self, note=""):
        if self.status == self.Status.BILLED:
            raise ValidationError("Une consommation deja facturee ne peut pas etre annulee directement.")
        self.status = self.Status.CANCELLED
        if note:
            self.notes = f"{self.notes}\n{note}".strip() if self.notes else note
        self.save(update_fields=["status", "notes", "updated_at"])

    @staticmethod
    def generate_reference():
        return generate_unique_reference(ClientConsumption, "CON")


class ClientConsumptionItem(models.Model):
    consumption = models.ForeignKey(
        ClientConsumption,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Consommation",
    )
    label = models.CharField(max_length=150, verbose_name="Libelle")
    description = models.TextField(blank=True, verbose_name="Description")
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
        verbose_name="Quantite",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Prix unitaire",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Montant total",
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Ordre")
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Ligne de consommation client"
        verbose_name_plural = "Lignes de consommation client"
        ordering = ["sort_order", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="client_consumption_item_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="client_consumption_item_unit_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="client_consumption_item_quantity_positive",
            ),
        ]

    def __str__(self):
        return f"{self.consumption.reference} - {self.label}"

    def save(self, *args, **kwargs):
        self.total_amount = (normalize_decimal(self.quantity) * normalize_decimal(self.unit_price)).quantize(
            AMOUNT_QUANTIZER
        )
        self.full_clean()

        with transaction.atomic():
            super().save(*args, **kwargs)
            self.consumption.refresh_totals_from_items()
