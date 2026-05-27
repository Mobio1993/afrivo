from datetime import timedelta

from django.core.exceptions import ValidationError
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateRangeField, DateTimeRangeField, RangeOperators
from django.db import models, transaction
from django.db.models import Func
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal

from apps.core.references import generate_unique_reference
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.rooms.models import Room, RoomType


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        CONFIRMED = "confirmed", "Confirmee"
        CANCELLED = "cancelled", "Annulee"
        NO_SHOW = "no_show", "No-show"
        CHECKED_IN = "checked_in", "Convertie en check-in"

    class BookingSource(models.TextChoices):
        WALK_IN = "walk_in", "Walk-in"
        PHONE = "phone", "Telephone"
        WEBSITE = "website", "Site web"
        OTA = "ota", "OTA"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="bookings",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    guest = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="bookings",
        verbose_name="Client",
    )
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="bookings",
        verbose_name="Type de chambre",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="bookings",
        verbose_name="Chambre",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Statut",
    )
    source = models.CharField(
        max_length=20,
        choices=BookingSource.choices,
        default=BookingSource.WALK_IN,
        verbose_name="Source",
    )
    check_in_date = models.DateField(verbose_name="Date d'arrivee")
    check_out_date = models.DateField(verbose_name="Date de depart")
    adults = models.PositiveIntegerField(default=1, verbose_name="Adultes")
    children = models.PositiveIntegerField(default=0, verbose_name="Enfants")
    estimated_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Montant estime",
    )
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Reservation"
        verbose_name_plural = "Reservations"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(check_out_date__gt=models.F("check_in_date")),
                name="booking_checkout_after_checkin",
            ),
            models.CheckConstraint(
                condition=models.Q(adults__gte=1),
                name="booking_at_least_one_adult",
            ),
            ExclusionConstraint(
                name="booking_no_active_room_overlap",
                expressions=[
                    (
                        Func(
                            "check_in_date",
                            "check_out_date",
                            function="DATERANGE",
                            output_field=DateRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                    ("room", RangeOperators.EQUAL),
                ],
                condition=models.Q(
                    room__isnull=False,
                    status__in=["pending", "confirmed", "checked_in"],
                ),
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "check_in_date"], name="booking_hotel_checkin_idx"),
            models.Index(fields=["hotel", "status"], name="booking_hotel_status_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.guest.full_name}"

    def clean(self):
        errors = {}

        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel
        if self.guest_id and self.guest and self.guest.hotel_id and not self.hotel_id:
            self.hotel = self.guest.hotel
        if self.room_type_id and self.room_type and self.room_type.hotel_id and not self.hotel_id:
            self.hotel = self.room_type.hotel

        if self.room and self.room.room_type_id != self.room_type_id:
            errors["room"] = "La chambre selectionnee ne correspond pas au type de chambre choisi."

        if self.hotel_id and self.guest_id and self.guest and self.guest.hotel_id and self.guest.hotel_id != self.hotel_id:
            errors["guest"] = "Le client selectionne doit appartenir au meme hotel que la reservation."

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre selectionnee doit appartenir au meme hotel que la reservation."

        if self.hotel_id and self.room_type_id and self.room_type and self.room_type.hotel_id and self.room_type.hotel_id != self.hotel_id:
            errors["room_type"] = "Le type de chambre doit appartenir au meme hotel que la reservation."

        total_guests = self.adults + self.children
        if self.room_type_id and total_guests > self.room_type.capacity:
            errors["children"] = "Le nombre total de personnes depasse la capacite du type de chambre."

        if self.room and not self.room.is_active:
            errors["room"] = "La chambre selectionnee est inactive."

        if (
            self.room
            and self.room.status == Room.Status.OUT_OF_SERVICE
            and self.status not in {self.Status.CANCELLED, self.Status.NO_SHOW}
        ):
            errors["room"] = "La chambre selectionnee est hors service."

        if errors:
            raise ValidationError(errors)

        if self.room_id and self.check_in_date and self.check_out_date:
            validate_room_not_overlapping(
                room=self.room,
                check_in_date=self.check_in_date,
                check_out_date=self.check_out_date,
                exclude_booking=self,
            )

    @property
    def blocks_room_availability(self):
        return self.room_id and self.status in ACTIVE_ROOM_OVERLAP_STATUSES

    def _save_with_room_lock(self, *args, **kwargs):
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=self.room_id)
            self.room = room
            self.full_clean()
            super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if not self.reference:
            self.reference = self.generate_reference()
        if self.blocks_room_availability:
            self._save_with_room_lock(*args, **kwargs)
        else:
            self.full_clean()
            super().save(*args, **kwargs)
        if self.room_id:
            from apps.rooms.services import sync_room_operational_status

            sync_room_operational_status(self.room)
        if is_new:
            log_history(
                action_type=HistoryEntry.ActionType.BOOKING_CREATED,
                module="bookings",
                entity_type="Booking",
                entity_reference=self.reference,
                description=f"Reservation creee pour {self.guest.full_name}.",
                metadata={
                    "guest_id": self.guest_id,
                    "room_type_id": self.room_type_id,
                    "room_id": self.room_id,
                    "status": self.status,
                },
            )

    def confirm(self, *, actor=None):
        if self.status != self.Status.PENDING:
            raise ValidationError("Seule une reservation en attente peut etre confirmee.")
        required_deposit = self.get_required_deposit_amount()
        paid_deposit = self.get_paid_deposit_amount()
        if required_deposit > 0 and paid_deposit < required_deposit:
            raise ValidationError(
                f"Une avance de {required_deposit} est obligatoire avant de confirmer cette reservation."
            )

        self.status = self.Status.CONFIRMED
        self.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=self.reference,
            description=f"Reservation {self.reference} confirmee.",
            actor=actor,
            metadata={"booking_id": self.id, "status": self.status},
        )

    def cancel(self, *, actor=None):
        if hasattr(self, "stay"):
            raise ValidationError("Une reservation convertie en sejour ne peut plus etre annulee.")
        if self.status not in {self.Status.PENDING, self.Status.CONFIRMED}:
            raise ValidationError("Cette reservation ne peut pas etre annulee dans son etat actuel.")

        self.status = self.Status.CANCELLED
        self.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=self.reference,
            description=f"Reservation {self.reference} annulee.",
            actor=actor,
            metadata={"booking_id": self.id, "status": self.status},
        )

    def mark_no_show(self, *, actor=None):
        if hasattr(self, "stay"):
            raise ValidationError("Une reservation convertie en sejour ne peut pas etre marquee no-show.")
        if self.status != self.Status.CONFIRMED:
            raise ValidationError("Seule une reservation confirmee peut etre marquee no-show.")

        self.status = self.Status.NO_SHOW
        self.save(update_fields=["status", "updated_at"])
        log_history(
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            module="bookings",
            entity_type="Booking",
            entity_reference=self.reference,
            description=f"Reservation {self.reference} marquee no-show.",
            actor=actor,
            metadata={"booking_id": self.id, "status": self.status},
        )

    @staticmethod
    def generate_reference():
        return generate_unique_reference(Booking, "RES")

    def get_required_deposit_amount(self):
        try:
            settings = self.hotel.settings if self.hotel_id else None
        except Exception:
            settings = None
        if not settings or not settings.deposit_required:
            return Decimal("0.00")
        percentage = Decimal(str(settings.deposit_percentage or 0))
        if percentage <= 0 or self.estimated_amount <= 0:
            return Decimal("0.00")
        return (self.estimated_amount * percentage / Decimal("100")).quantize(Decimal("0.01"))

    def get_paid_deposit_amount(self):
        from apps.billing.models import Payment

        return (
            self.payments.filter(status=Payment.Status.PAID)
            .exclude(payment_type=Payment.PaymentType.REFUND)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )


ACTIVE_ROOM_OVERLAP_STATUSES = [
    Booking.Status.PENDING,
    Booking.Status.CONFIRMED,
    Booking.Status.CHECKED_IN,
]


def get_overlapping_room_booking_queryset(*, room, check_in_date, check_out_date, exclude_booking=None):
    queryset = Booking.objects.filter(
        room=room,
        status__in=ACTIVE_ROOM_OVERLAP_STATUSES,
        check_in_date__lt=check_out_date,
        check_out_date__gt=check_in_date,
    )
    if room.hotel_id:
        queryset = queryset.filter(hotel=room.hotel)
    if exclude_booking and exclude_booking.pk:
        queryset = queryset.exclude(pk=exclude_booking.pk)
    return queryset


def validate_room_not_overlapping(
    *,
    room,
    check_in_date,
    check_out_date,
    exclude_booking=None,
    message="Cette chambre est déjà réservée sur cette période.",
):
    if not room or not check_in_date or not check_out_date:
        return
    if get_overlapping_room_booking_queryset(
        room=room,
        check_in_date=check_in_date,
        check_out_date=check_out_date,
        exclude_booking=exclude_booking,
    ).exists():
        raise ValidationError({"room": message})


class DayUse(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PENDING_PAYMENT = "pending_payment", "Paiement en attente"
        READY = "ready", "Pret a entrer"
        IN_PROGRESS = "in_progress", "En cours"
        OVERTIME = "overtime", "Temps depasse"
        COMPLETED = "completed", "Termine"
        CANCELLED = "cancelled", "Annule"
        NO_SHOW = "no_show", "No-show"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Non paye"
        PARTIAL = "partial", "Paiement partiel"
        PAID = "paid", "Paye"
        REFUNDED = "refunded", "Rembourse"
        CANCELLED = "cancelled", "Annule"

    class OvertimeChoice(models.IntegerChoices):
        NONE = 0, "Aucun depassement"
        PLUS_2H = 2, "+ 2 heures"
        PLUS_4H = 4, "+ 4 heures"
        PLUS_6H = 6, "+ 6 heures"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="day_uses",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    guest = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="day_uses",
        verbose_name="Client",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="day_uses",
        verbose_name="Chambre",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_PAYMENT,
        verbose_name="Statut",
    )
    package_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Formule fixe",
    )
    overtime_choice = models.PositiveSmallIntegerField(
        choices=OvertimeChoice.choices,
        default=OvertimeChoice.NONE,
        verbose_name="Depassement",
    )
    overtime_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Frais de depassement",
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Montant total",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        verbose_name="Statut paiement",
    )
    start_datetime = models.DateTimeField(blank=True, null=True, verbose_name="Debut day use")
    end_datetime = models.DateTimeField(blank=True, null=True, verbose_name="Fin prevue day use")
    expected_duration_hours = models.PositiveSmallIntegerField(default=3, verbose_name="Duree prevue (h)")
    actual_duration_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        verbose_name="Duree reelle (h)",
    )
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Tarif horaire")
    subtotal_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Sous-total")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Remise")
    overtime_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Depassement")
    extension_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Prolongations")
    final_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Montant final")
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Montant paye")
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Reste a payer")
    planned_entry_at = models.DateTimeField(default=timezone.now, verbose_name="Entree prevue")
    check_in_at = models.DateTimeField(blank=True, null=True, verbose_name="Entree effectuee le")
    check_out_at = models.DateTimeField(blank=True, null=True, verbose_name="Sortie effectuee le")
    checked_in_at = models.DateTimeField(blank=True, null=True, verbose_name="Check-in effectue le")
    checked_out_at = models.DateTimeField(blank=True, null=True, verbose_name="Check-out effectue le")
    extension_count = models.PositiveSmallIntegerField(default=0, verbose_name="Nombre de prolongations")
    converted_to_night = models.BooleanField(default=False, verbose_name="Converti en nuit")
    converted_reservation = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.SET_NULL,
        related_name="converted_day_uses",
        blank=True,
        null=True,
        verbose_name="Reservation creee",
    )
    cancellation_reason = models.TextField(blank=True, verbose_name="Raison d'annulation")
    no_show_reason = models.TextField(blank=True, verbose_name="Raison no-show")
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="created_day_uses",
        blank=True,
        null=True,
        verbose_name="Cree par",
    )
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="updated_day_uses",
        blank=True,
        null=True,
        verbose_name="Modifie par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Day use"
        verbose_name_plural = "Day use"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(package_price__gt=0),
                name="day_use_package_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(overtime_fee__gte=0),
                name="day_use_overtime_fee_non_negative",
            ),
            ExclusionConstraint(
                name="dayuse_no_active_room_overlap",
                expressions=[
                    (
                        Func(
                            "start_datetime",
                            "end_datetime",
                            function="TSTZRANGE",
                            output_field=DateTimeRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                    ("room", RangeOperators.EQUAL),
                ],
                condition=models.Q(
                    room__isnull=False,
                    start_datetime__isnull=False,
                    end_datetime__isnull=False,
                    status__in=[
                        "pending_payment",
                        "ready",
                        "in_progress",
                        "overtime",
                    ],
                ),
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "planned_entry_at"], name="dayuse_hotel_entry_idx"),
            models.Index(fields=["hotel", "status"], name="dayuse_hotel_status_idx"),
            models.Index(fields=["room", "start_datetime"], name="dayuse_room_start_idx"),
            models.Index(fields=["guest", "created_at"], name="dayuse_guest_created_idx"),
            models.Index(fields=["payment_status"], name="dayuse_payment_status_idx"),
            models.Index(fields=["end_datetime"], name="dayuse_end_idx"),
            models.Index(fields=["check_in_at"], name="dayuse_checkin_idx"),
            models.Index(fields=["check_out_at"], name="dayuse_checkout_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.guest.full_name}"

    @property
    def paid_amount(self):
        return self.payments.filter(status="paid").aggregate(total=Sum("amount"))["total"] or 0

    @property
    def balance_amount(self):
        balance = self.total_amount - self.paid_amount
        return balance if balance > 0 else 0

    @property
    def is_fully_paid(self):
        return self.paid_amount >= self.total_amount

    def clean(self):
        errors = {}

        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel
        if self.guest_id and self.guest and self.guest.hotel_id and not self.hotel_id:
            self.hotel = self.guest.hotel

        if self.hotel_id and self.guest_id and self.guest and self.guest.hotel_id and self.guest.hotel_id != self.hotel_id:
            errors["guest"] = "Le client selectionne doit appartenir au meme hotel que le day use."

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre selectionnee doit appartenir au meme hotel que le day use."

        if self.room_id and self.room and not self.room.is_active:
            errors["room"] = "La chambre selectionnee est inactive."

        if self.room_id and self.room and self.room.status == Room.Status.OUT_OF_SERVICE:
            errors["room"] = "La chambre selectionnee est hors service."

        if self.check_in_at and self.check_out_at and self.check_out_at < self.check_in_at:
            errors["check_out_at"] = "La sortie ne peut pas etre anterieure a l'entree."

        if self.expected_duration_hours and not 1 <= int(self.expected_duration_hours) <= 10:
            errors["expected_duration_hours"] = "La duree day use doit etre comprise entre 1h et 10h."

        if self.start_datetime and self.end_datetime and self.end_datetime <= self.start_datetime:
            errors["end_datetime"] = "La fin prevue doit etre posterieure au debut."

        if errors:
            raise ValidationError(errors)

    def refresh_financials(self, *, save=False):
        from apps.billing.models import Payment

        paid = (
            self.payments.filter(status=Payment.Status.PAID)
            .exclude(payment_type=Payment.PaymentType.REFUND)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        final_amount = self.final_amount or self.total_amount or self.package_price
        self.amount_paid = paid
        self.remaining_amount = max(final_amount - paid, Decimal("0.00"))
        if paid <= 0:
            self.payment_status = self.PaymentStatus.UNPAID
        elif self.remaining_amount > 0:
            self.payment_status = self.PaymentStatus.PARTIAL
        else:
            self.payment_status = self.PaymentStatus.PAID
        if self.status in {self.Status.PENDING_PAYMENT, self.Status.READY}:
            self.status = self.Status.READY if self.payment_status == self.PaymentStatus.PAID else self.Status.PENDING_PAYMENT
        if save:
            self.save(
                update_fields=[
                    "amount_paid",
                    "remaining_amount",
                    "payment_status",
                    "status",
                    "updated_at",
                ]
            )

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if not self.reference:
            self.reference = self.generate_reference()
        if not self.start_datetime:
            self.start_datetime = self.planned_entry_at
        if self.start_datetime and not self.end_datetime:
            self.end_datetime = self.start_datetime + timedelta(hours=self.expected_duration_hours or 3)
        if not self.hourly_rate and self.room_id:
            self.hourly_rate = self.room.effective_price_day_use
        if not self.subtotal_amount:
            self.subtotal_amount = (self.hourly_rate or Decimal("0")) * Decimal(self.expected_duration_hours or 0)
        computed_final = self.subtotal_amount - self.discount_amount + self.overtime_amount + self.extension_amount
        if computed_final > 0:
            self.final_amount = computed_final
            self.package_price = self.package_price or self.final_amount
        elif self.package_price:
            self.final_amount = self.package_price + self.overtime_fee
        self.total_amount = self.final_amount or (self.package_price + self.overtime_fee)
        self.remaining_amount = max((self.total_amount or Decimal("0")) - (self.amount_paid or Decimal("0")), Decimal("0"))
        self.full_clean()
        super().save(*args, **kwargs)
        if self.room_id:
            from apps.rooms.services import sync_room_operational_status

            sync_room_operational_status(self.room)
        if is_new:
            log_history(
                action_type=HistoryEntry.ActionType.DAY_USE_CREATED,
                module="bookings",
                entity_type="DayUse",
                entity_reference=self.reference,
                description=f"Day use cree pour {self.guest.full_name}.",
                metadata={
                    "guest_id": self.guest_id,
                    "room_id": self.room_id,
                    "status": self.status,
                    "total_amount": str(self.total_amount),
                },
            )

    def refresh_payment_status(self):
        target_status = self.Status.READY if self.is_fully_paid else self.Status.PENDING_PAYMENT
        if self.status in {self.Status.PENDING_PAYMENT, self.Status.READY} and self.status != target_status:
            self.status = target_status
            self.save(update_fields=["status", "updated_at"])

    def perform_check_in(self):
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=self.room_id)

            if not self.is_fully_paid:
                raise ValidationError("Le paiement complet est requis avant l'entree du day use.")
            if self.status not in {self.Status.READY, self.Status.PENDING_PAYMENT}:
                raise ValidationError("Ce day use ne peut pas etre passe en entree dans son etat actuel.")
            if room.status != Room.Status.AVAILABLE:
                raise ValidationError("La chambre doit etre disponible pour l'entree day use.")

            self.status = self.Status.IN_PROGRESS
            self.check_in_at = timezone.now()
            self.save(update_fields=["status", "check_in_at", "updated_at"])

            room.status = Room.Status.OCCUPIED
            room.save(update_fields=["status", "updated_at"])

        log_history(
            action_type=HistoryEntry.ActionType.DAY_USE_CHECK_IN,
            module="bookings",
            entity_type="DayUse",
            entity_reference=self.reference,
            description=f"Entree day use effectuee pour {self.reference}.",
            metadata={
                "day_use_id": self.id,
                "room_id": self.room_id,
                "guest_id": self.guest_id,
            },
        )

    def perform_check_out(self):
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=self.room_id)

            if self.status not in {self.Status.IN_PROGRESS, self.Status.OVERTIME}:
                raise ValidationError("Seul un day use en cours ou en depassement peut etre cloture.")

            self.status = self.Status.COMPLETED
            self.check_out_at = timezone.now()
            self.save(update_fields=["status", "check_out_at", "updated_at"])

            room.status = Room.Status.CLEANING
            room.save(update_fields=["status", "updated_at"])

            from apps.rooms.models import RoomHousekeepingTask

            if not RoomHousekeepingTask.objects.filter(
                hotel=self.hotel,
                room=room,
                status__in=[
                    RoomHousekeepingTask.Status.PENDING,
                    RoomHousekeepingTask.Status.IN_PROGRESS,
                ],
            ).exists():
                RoomHousekeepingTask.objects.create(
                    hotel=self.hotel,
                    room=room,
                    task_type=RoomHousekeepingTask.TaskType.TURNOVER,
                    status=RoomHousekeepingTask.Status.PENDING,
                    priority=RoomHousekeepingTask.Priority.HIGH,
                    notes=f"Rotation automatique apres sortie day use {self.reference}.",
                )

        log_history(
            action_type=HistoryEntry.ActionType.DAY_USE_CHECK_OUT,
            module="bookings",
            entity_type="DayUse",
            entity_reference=self.reference,
            description=f"Sortie day use effectuee pour {self.reference}.",
            metadata={
                "day_use_id": self.id,
                "room_id": self.room_id,
                "guest_id": self.guest_id,
            },
        )

    @staticmethod
    def generate_reference():
        return generate_unique_reference(DayUse, "DAY")
