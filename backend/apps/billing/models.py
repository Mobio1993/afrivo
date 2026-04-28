from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone

from apps.bookings.models import Booking, DayUse
from apps.consumptions.models import ClientConsumption, ServiceDepartment
from apps.core.references import generate_unique_reference
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.rooms.models import Room
from apps.stays.models import Stay


AMOUNT_QUANTIZER = Decimal("0.01")


def normalize_decimal(value, default="0.00"):
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


class ClientInvoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        ISSUED = "issued", "Emise"
        PARTIALLY_PAID = "partially_paid", "Partiellement payee"
        PAID = "paid", "Payee"
        CANCELLED = "cancelled", "Annulee"

    class Source(models.TextChoices):
        MANUAL = "manual", "Saisie manuelle"
        STAY_FOLIO = "stay_folio", "Folio de sejour"
        SERVICE_BATCH = "service_batch", "Lot de services"
        CONSUMPTIONS = "consumptions", "Selection de consommations"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="invoices",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    client = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="invoices",
        verbose_name="Client",
    )
    stay = models.ForeignKey(
        Stay,
        on_delete=models.PROTECT,
        related_name="invoices",
        verbose_name="Sejour",
        blank=True,
        null=True,
    )
    reservation = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="invoices",
        verbose_name="Reservation",
        blank=True,
        null=True,
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="client_invoices_issued",
        verbose_name="Emise par",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Statut",
    )
    issued_at = models.DateTimeField(default=timezone.now, verbose_name="Emise le")
    due_date = models.DateField(blank=True, null=True, verbose_name="Date d'echeance")
    subtotal_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Sous-total",
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Remise",
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Taxe",
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Total",
    )
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Montant paye",
    )
    balance_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Solde restant",
    )
    currency = models.CharField(max_length=3, default="XOF", verbose_name="Devise")
    notes = models.TextField(blank=True, verbose_name="Notes")
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Origine",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Facture client"
        verbose_name_plural = "Factures clients"
        ordering = ["-issued_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(subtotal_amount__gte=0), name="invoice_subtotal_non_negative"),
            models.CheckConstraint(condition=models.Q(discount_amount__gte=0), name="invoice_discount_non_negative"),
            models.CheckConstraint(condition=models.Q(tax_amount__gte=0), name="invoice_tax_non_negative"),
            models.CheckConstraint(condition=models.Q(total_amount__gte=0), name="invoice_total_non_negative"),
            models.CheckConstraint(condition=models.Q(amount_paid__gte=0), name="invoice_amount_paid_non_negative"),
            models.CheckConstraint(condition=models.Q(balance_due__gte=0), name="invoice_balance_due_non_negative"),
        ]
        indexes = [
            models.Index(fields=["hotel", "issued_at"], name="invoice_hotel_issued_idx"),
            models.Index(fields=["hotel", "status"], name="invoice_hotel_status_idx"),
            models.Index(fields=["client", "issued_at"], name="invoice_client_issued_idx"),
            models.Index(fields=["stay", "issued_at"], name="invoice_stay_issued_idx"),
            models.Index(fields=["reservation", "issued_at"], name="invoice_booking_issued_idx"),
            models.Index(fields=["status"], name="invoice_status_idx"),
        ]

    def __str__(self):
        return self.reference

    @property
    def invoice_number(self):
        return self.reference

    def clean(self):
        errors = {}

        if self.stay_id and self.stay and self.stay.hotel_id and not self.hotel_id:
            self.hotel = self.stay.hotel
        if self.reservation_id and self.reservation and self.reservation.hotel_id and not self.hotel_id:
            self.hotel = self.reservation.hotel
        if self.client_id and self.client and self.client.hotel_id and not self.hotel_id:
            self.hotel = self.client.hotel

        if self.stay_id and self.stay and self.stay.guest_id != self.client_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme client."

        if self.reservation_id and self.reservation and self.reservation.guest_id != self.client_id:
            errors["reservation"] = "La reservation selectionnee doit appartenir au meme client."

        if self.stay_id and self.stay and self.stay.booking_id and not self.reservation_id:
            self.reservation = self.stay.booking

        if self.stay_id and self.reservation_id and self.stay and self.reservation:
            if self.stay.booking_id and self.stay.booking_id != self.reservation_id:
                errors["reservation"] = "La reservation ne correspond pas au sejour selectionne."

        if self.hotel_id and self.client_id and self.client and self.client.hotel_id and self.client.hotel_id != self.hotel_id:
            errors["client"] = "Le client selectionne doit appartenir au meme hotel que la facture."

        if self.hotel_id and self.stay_id and self.stay and self.stay.hotel_id and self.stay.hotel_id != self.hotel_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme hotel que la facture."

        if self.hotel_id and self.reservation_id and self.reservation and self.reservation.hotel_id and self.reservation.hotel_id != self.hotel_id:
            errors["reservation"] = "La reservation selectionnee doit appartenir au meme hotel que la facture."

        if self.due_date and self.issued_at and self.due_date < self.issued_at.date():
            errors["due_date"] = "L'echeance ne peut pas etre anterieure a la date d'emission."

        if errors:
            raise ValidationError(errors)

    def recompute_subtotal(self):
        if not self.pk:
            return normalize_decimal(self.subtotal_amount).quantize(AMOUNT_QUANTIZER)
        aggregated = self.items.aggregate(total=Sum("line_total"))
        return (aggregated["total"] or Decimal("0.00")).quantize(AMOUNT_QUANTIZER)

    def recompute_amount_paid(self):
        if not self.pk:
            return normalize_decimal(self.amount_paid).quantize(AMOUNT_QUANTIZER)
        aggregated = self.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount"))
        return (aggregated["total"] or Decimal("0.00")).quantize(AMOUNT_QUANTIZER)

    def recompute_totals(self):
        self.subtotal_amount = self.recompute_subtotal()
        self.discount_amount = normalize_decimal(self.discount_amount).quantize(AMOUNT_QUANTIZER)
        self.tax_amount = normalize_decimal(self.tax_amount).quantize(AMOUNT_QUANTIZER)
        gross_total = self.subtotal_amount - self.discount_amount + self.tax_amount
        self.total_amount = max(gross_total, Decimal("0.00")).quantize(AMOUNT_QUANTIZER)
        self.amount_paid = self.recompute_amount_paid()
        self.balance_due = max(self.total_amount - self.amount_paid, Decimal("0.00")).quantize(AMOUNT_QUANTIZER)

        if self.status != self.Status.CANCELLED:
            if self.amount_paid == Decimal("0.00") and self.status == self.Status.PAID:
                self.status = self.Status.ISSUED
            elif self.amount_paid >= self.total_amount and self.total_amount > Decimal("0.00"):
                self.status = self.Status.PAID
            elif self.amount_paid > Decimal("0.00"):
                self.status = self.Status.PARTIALLY_PAID

    def sync_consumption_billing_state(self):
        for item in self.items.select_related("consumption").filter(consumption_id__isnull=False):
            consumption = item.consumption
            if self.status == self.Status.CANCELLED:
                has_other_active_invoice = ClientInvoiceItem.objects.filter(
                    consumption=consumption,
                    invoice__status__in=[
                        ClientInvoice.Status.DRAFT,
                        ClientInvoice.Status.ISSUED,
                        ClientInvoice.Status.PARTIALLY_PAID,
                        ClientInvoice.Status.PAID,
                    ],
                ).exclude(invoice_id=self.id).exists()
                if not has_other_active_invoice:
                    if consumption.status == ClientConsumption.Status.BILLED and consumption.billing_reference == self.reference:
                        consumption.status = ClientConsumption.Status.POSTED
                        consumption.billing_reference = ""
                        consumption.billed_at = None
                        consumption.save(update_fields=["status", "billing_reference", "billed_at", "updated_at"])
                continue

            if consumption.status != ClientConsumption.Status.BILLED or consumption.billing_reference != self.reference:
                consumption.status = ClientConsumption.Status.BILLED
                consumption.billing_reference = self.reference
                if not consumption.billed_at:
                    consumption.billed_at = timezone.now()
                consumption.save(update_fields=["status", "billing_reference", "billed_at", "updated_at"])

    def refresh_financials(self, sync_consumptions=True):
        self.recompute_totals()
        super().save(update_fields=["subtotal_amount", "discount_amount", "tax_amount", "total_amount", "amount_paid", "balance_due", "status", "updated_at"])
        if sync_consumptions:
            self.sync_consumption_billing_state()

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if not self.reference:
            self.reference = self.generate_reference()
        self.recompute_totals()
        self.full_clean()
        super().save(*args, **kwargs)
        if self.pk:
            self.sync_consumption_billing_state()
        if is_new:
            log_history(
                action_type=HistoryEntry.ActionType.OTHER,
                module="billing",
                entity_type="ClientInvoice",
                entity_reference=self.reference,
                description=f"Facture client creee : {self.reference}.",
                metadata={
                    "invoice_id": self.id,
                    "client_id": self.client_id,
                    "stay_id": self.stay_id,
                    "reservation_id": self.reservation_id,
                    "status": self.status,
                },
            )

    def issue(self):
        if self.status != self.Status.DRAFT:
            raise ValidationError("Seule une facture en brouillon peut etre emise.")
        if not self.items.exists():
            raise ValidationError("Ajoute au moins une ligne avant d'emettre la facture.")
        self.status = self.Status.ISSUED
        self.issued_at = timezone.now()
        self.save(update_fields=["status", "issued_at", "updated_at"])

    def cancel(self, note=""):
        if self.status == self.Status.PAID:
            raise ValidationError("Une facture completement payee ne peut pas etre annulee directement.")
        self.status = self.Status.CANCELLED
        if note:
            self.notes = f"{self.notes}\n{note}".strip() if self.notes else note
        self.save(update_fields=["status", "notes", "updated_at"])

    @staticmethod
    def generate_reference():
        return generate_unique_reference(ClientInvoice, "INV")


class ClientInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        ClientInvoice,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Facture",
    )
    consumption = models.ForeignKey(
        ClientConsumption,
        on_delete=models.PROTECT,
        related_name="invoice_items",
        verbose_name="Consommation",
        blank=True,
        null=True,
    )
    service_department = models.ForeignKey(
        ServiceDepartment,
        on_delete=models.PROTECT,
        related_name="invoice_items",
        verbose_name="Service",
        blank=True,
        null=True,
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="invoice_items",
        verbose_name="Chambre",
        blank=True,
        null=True,
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
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Montant ligne",
    )
    service_date = models.DateTimeField(blank=True, null=True, verbose_name="Date de service")
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Ligne de facture client"
        verbose_name_plural = "Lignes de facture client"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="invoice_item_quantity_positive"),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0), name="invoice_item_unit_price_non_negative"),
            models.CheckConstraint(condition=models.Q(line_total__gte=0), name="invoice_item_total_non_negative"),
        ]

    def __str__(self):
        return f"{self.invoice.reference} - {self.label}"

    @property
    def consumed_at(self):
        return self.service_date

    @property
    def service(self):
        return self.service_department

    def clean(self):
        errors = {}

        if self.invoice_id and self.consumption_id and self.consumption:
            if self.consumption.client_id != self.invoice.client_id:
                errors["consumption"] = "La consommation doit appartenir au meme client que la facture."
            if self.invoice.stay_id and self.consumption.stay_id and self.consumption.stay_id != self.invoice.stay_id:
                errors["consumption"] = "La consommation ne correspond pas au sejour rattache a la facture."

            duplicate_query = ClientInvoiceItem.objects.filter(
                consumption=self.consumption,
                invoice__status__in=[
                    ClientInvoice.Status.DRAFT,
                    ClientInvoice.Status.ISSUED,
                    ClientInvoice.Status.PARTIALLY_PAID,
                    ClientInvoice.Status.PAID,
                ],
            )
            if self.pk:
                duplicate_query = duplicate_query.exclude(pk=self.pk)
            if duplicate_query.exists():
                errors["consumption"] = "Cette consommation est deja rattachee a une autre facture active."

        if self.invoice_id and self.invoice.status == ClientInvoice.Status.CANCELLED:
            errors["invoice"] = "Impossible d'ajouter une ligne sur une facture annulee."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.consumption_id and self.consumption:
            if not self.label:
                self.label = self.consumption.label
            if not self.description:
                self.description = self.consumption.description
            if not self.service_department_id:
                self.service_department = self.consumption.service_department
            if not self.room_id:
                self.room = self.consumption.room
            if not self.service_date:
                self.service_date = self.consumption.service_date
            if normalize_decimal(self.quantity) == Decimal("1.00") and normalize_decimal(self.unit_price) == Decimal("0.00"):
                self.quantity = self.consumption.quantity
                self.unit_price = self.consumption.unit_price

        self.line_total = (normalize_decimal(self.quantity) * normalize_decimal(self.unit_price)).quantize(AMOUNT_QUANTIZER)
        self.full_clean()
        with transaction.atomic():
            super().save(*args, **kwargs)
            self.invoice.refresh_financials()

    def delete(self, using=None, keep_parents=False):
        invoice = self.invoice
        result = super().delete(using=using, keep_parents=keep_parents)
        invoice.refresh_financials()
        return result


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        PAID = "paid", "Paye"
        CANCELLED = "cancelled", "Annule"
        REFUNDED = "refunded", "Rembourse"

    class PaymentType(models.TextChoices):
        ADVANCE = "advance", "Avance"
        PARTIAL = "partial", "Paiement partiel"
        FULL = "full", "Paiement complet"
        REFUND = "refund", "Remboursement"
        ADJUSTMENT = "adjustment", "Ajustement"

    class Method(models.TextChoices):
        CASH = "cash", "Especes"
        CARD = "card", "Carte"
        TRANSFER = "transfer", "Virement"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        CHEQUE = "cheque", "Cheque"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    client = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Client",
        blank=True,
        null=True,
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Reservation",
        blank=True,
        null=True,
    )
    stay = models.ForeignKey(
        Stay,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Sejour",
        blank=True,
        null=True,
    )
    day_use = models.ForeignKey(
        DayUse,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Day use",
        blank=True,
        null=True,
    )
    invoice = models.ForeignKey(
        ClientInvoice,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Facture",
        blank=True,
        null=True,
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="client_payments_recorded",
        verbose_name="Enregistre par",
        blank=True,
        null=True,
    )
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        default=PaymentType.PARTIAL,
        verbose_name="Type de paiement",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PAID,
        verbose_name="Statut",
    )
    method = models.CharField(
        max_length=20,
        choices=Method.choices,
        default=Method.CASH,
        verbose_name="Mode de paiement",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Montant",
    )
    paid_at = models.DateTimeField(default=timezone.now, verbose_name="Paye le")
    notes = models.TextField(blank=True, verbose_name="Notes")
    source = models.CharField(max_length=30, blank=True, verbose_name="Origine")
    external_reference = models.CharField(max_length=80, blank=True, verbose_name="Reference externe")
    currency = models.CharField(max_length=3, default="XOF", verbose_name="Devise")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-paid_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="payment_amount_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "paid_at"], name="payment_hotel_paid_idx"),
            models.Index(fields=["hotel", "status"], name="payment_hotel_status_idx"),
            models.Index(fields=["client", "paid_at"], name="payment_client_paid_idx"),
            models.Index(fields=["stay", "paid_at"], name="payment_stay_paid_idx"),
            models.Index(fields=["invoice", "paid_at"], name="payment_invoice_paid_idx"),
            models.Index(fields=["status", "paid_at"], name="payment_status_paid_idx"),
            models.Index(fields=["method", "paid_at"], name="payment_method_paid_idx"),
            models.Index(fields=["payment_type", "paid_at"], name="payment_type_paid_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.amount}"

    @property
    def payment_reference(self):
        return self.reference

    @property
    def payment_method(self):
        return self.method

    @property
    def reservation(self):
        return self.booking

    @property
    def reservation_id(self):
        return self.booking_id

    @property
    def cashier(self):
        return self.recorded_by

    def get_payment_type_display_label(self):
        return self.get_payment_type_display()

    def infer_payment_type(self):
        if self.status == self.Status.REFUNDED:
            return self.PaymentType.REFUND
        if self.invoice_id and self.invoice:
            balance_due = normalize_decimal(self.invoice.balance_due)
            if balance_due <= Decimal("0.00"):
                return self.PaymentType.ADJUSTMENT
            if normalize_decimal(self.amount) >= balance_due:
                return self.PaymentType.FULL
            return self.PaymentType.PARTIAL
        if self.booking_id and not self.stay_id:
            return self.PaymentType.ADVANCE
        return self.PaymentType.PARTIAL

    def clean(self):
        errors = {}

        if not self.booking and not self.stay and not self.day_use and not self.invoice:
            errors["booking"] = "Le paiement doit etre rattache a une reservation, un sejour, un day use ou une facture."

        if self.booking and self.stay:
            if self.stay.booking_id != self.booking_id:
                errors["stay"] = "Le sejour selectionne ne correspond pas a la reservation choisie."

        if self.day_use and (self.booking or self.stay or self.invoice):
            errors["day_use"] = "Un paiement day use ne doit pas etre rattache simultanement a une reservation, un sejour ou une facture."

        if self.stay and not self.booking and self.stay.booking_id:
            self.booking = self.stay.booking

        if self.invoice:
            if self.invoice.client_id and not self.client_id:
                self.client = self.invoice.client
            if self.invoice.stay_id and not self.stay_id:
                self.stay = self.invoice.stay
            if self.invoice.reservation_id and not self.booking_id:
                self.booking = self.invoice.reservation
            if self.invoice.hotel_id and not self.hotel_id:
                self.hotel = self.invoice.hotel

            if self.stay_id and self.invoice.stay_id and self.invoice.stay_id != self.stay_id:
                errors["invoice"] = "La facture selectionnee ne correspond pas au sejour choisi."

            if self.booking_id and self.invoice.reservation_id and self.invoice.reservation_id != self.booking_id:
                errors["invoice"] = "La facture selectionnee ne correspond pas a la reservation choisie."

            if self.day_use_id:
                errors["invoice"] = "Une facture client ne doit pas etre combinee avec un paiement day use."

        if self.stay and not self.client_id:
            self.client = self.stay.guest
        if self.stay and self.stay.hotel_id and not self.hotel_id:
            self.hotel = self.stay.hotel

        if self.booking and not self.client_id:
            self.client = self.booking.guest
        if self.booking and self.booking.hotel_id and not self.hotel_id:
            self.hotel = self.booking.hotel

        if self.day_use and not self.client_id:
            self.client = self.day_use.guest
        if self.day_use and self.day_use.hotel_id and not self.hotel_id:
            self.hotel = self.day_use.hotel

        if self.client_id and self.client and self.client.hotel_id and not self.hotel_id:
            self.hotel = self.client.hotel

        if not self.client_id:
            errors["client"] = "Le paiement doit etre rattache a un client."

        if self.client_id and self.stay and self.stay.guest_id != self.client_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme client."

        if self.client_id and self.booking and self.booking.guest_id != self.client_id:
            errors["booking"] = "La reservation selectionnee doit appartenir au meme client."

        if self.client_id and self.invoice and self.invoice.client_id != self.client_id:
            errors["invoice"] = "La facture selectionnee doit appartenir au meme client."

        if self.client_id and self.day_use and self.day_use.guest_id != self.client_id:
            errors["day_use"] = "Le day use selectionne doit appartenir au meme client."

        if self.hotel_id and self.client_id and self.client and self.client.hotel_id and self.client.hotel_id != self.hotel_id:
            errors["client"] = "Le client selectionne doit appartenir au meme hotel que le paiement."

        if self.hotel_id and self.booking and self.booking.hotel_id and self.booking.hotel_id != self.hotel_id:
            errors["booking"] = "La reservation selectionnee doit appartenir au meme hotel que le paiement."

        if self.hotel_id and self.stay and self.stay.hotel_id and self.stay.hotel_id != self.hotel_id:
            errors["stay"] = "Le sejour selectionne doit appartenir au meme hotel que le paiement."

        if self.hotel_id and self.day_use and self.day_use.hotel_id and self.day_use.hotel_id != self.hotel_id:
            errors["day_use"] = "Le day use selectionne doit appartenir au meme hotel que le paiement."

        if self.hotel_id and self.invoice and self.invoice.hotel_id and self.invoice.hotel_id != self.hotel_id:
            errors["invoice"] = "La facture selectionnee doit appartenir au meme hotel que le paiement."

        if self.status == self.Status.REFUNDED and self.payment_type != self.PaymentType.REFUND:
            self.payment_type = self.PaymentType.REFUND

        if not self.payment_type:
            self.payment_type = self.infer_payment_type()

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if not self.reference:
            self.reference = self.generate_reference()
        if not self.payment_type:
            self.payment_type = self.infer_payment_type()
        self.full_clean()
        super().save(*args, **kwargs)
        if is_new:
            log_history(
                action_type=HistoryEntry.ActionType.PAYMENT_RECORDED,
                module="billing",
                entity_type="Payment",
                entity_reference=self.reference,
                description=f"Paiement enregistre pour un montant de {self.amount}.",
                metadata={
                    "payment_id": self.id,
                    "client_id": self.client_id,
                    "booking_id": self.booking_id,
                    "stay_id": self.stay_id,
                    "day_use_id": self.day_use_id,
                    "invoice_id": self.invoice_id,
                    "status": self.status,
                    "method": self.method,
                    "payment_type": self.payment_type,
                },
            )

        if self.day_use_id:
            self.day_use.refresh_payment_status()
        if self.invoice_id:
            self.invoice.refresh_financials(sync_consumptions=False)

    @staticmethod
    def generate_reference():
        return generate_unique_reference(Payment, "PAY")
