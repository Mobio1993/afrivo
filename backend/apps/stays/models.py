from datetime import datetime, time
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.bookings.models import Booking
from apps.core.references import generate_unique_reference
from apps.guests.models import Guest
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.rooms.models import Room


class Stay(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "En cours"
        COMPLETED = "completed", "Termine"
        CANCELLED = "cancelled", "Annule"

    class Source(models.TextChoices):
        BOOKING = "booking", "Reservation"
        WALK_IN = "walk_in", "Walk-in"
        PHONE = "phone", "Telephone"
        WEBSITE = "website", "Site web"
        OTA = "ota", "OTA"
        MANUAL = "manual", "Saisie directe"
        OTHER = "other", "Autre"

    reference = models.CharField(max_length=20, unique=True, verbose_name="Reference")
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="stays",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="stay",
        verbose_name="Reservation",
        blank=True,
        null=True,
    )
    guest = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="stays",
        verbose_name="Client",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="stays",
        verbose_name="Chambre",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Origine",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
        verbose_name="Statut",
    )
    planned_check_in = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Check-in prevu",
    )
    check_in_at = models.DateTimeField(default=timezone.now, verbose_name="Check-in effectue le")
    actual_check_in = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Check-in reel",
    )
    check_out_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Check-out effectue le",
    )
    actual_check_out = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Check-out reel",
    )
    expected_check_out_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Date de depart prevue",
    )
    planned_check_out = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Check-out prevu",
    )
    number_of_guests = models.PositiveIntegerField(default=1, verbose_name="Nombre d'occupants")
    adults_count = models.PositiveIntegerField(default=1, verbose_name="Adultes")
    children_count = models.PositiveIntegerField(default=0, verbose_name="Enfants")
    purpose_of_stay = models.CharField(max_length=100, blank=True, verbose_name="Motif du sejour")
    notes = models.TextField(blank=True, verbose_name="Notes")
    special_requests = models.TextField(blank=True, verbose_name="Demandes speciales")
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="checked_in_stays",
        blank=True,
        null=True,
        verbose_name="Check-in par",
    )
    checked_out_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="checked_out_stays",
        blank=True,
        null=True,
        verbose_name="Check-out par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Sejour"
        verbose_name_plural = "Sejours"
        ordering = ["-check_in_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(adults_count__gte=1),
                name="stay_at_least_one_adult",
            ),
            models.CheckConstraint(
                condition=models.Q(number_of_guests__gte=1),
                name="stay_at_least_one_guest",
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "status"], name="stay_hotel_status_idx"),
            models.Index(fields=["hotel", "check_in_at"], name="stay_hotel_checkin_idx"),
            models.Index(fields=["status", "room"], name="stay_status_room_idx"),
            models.Index(fields=["status", "guest"], name="stay_status_guest_idx"),
            models.Index(fields=["planned_check_in"], name="stay_planned_check_in_idx"),
            models.Index(fields=["planned_check_out"], name="stay_planned_check_out_idx"),
        ]

    def __str__(self):
        return f"{self.reference} - {self.guest.full_name}"

    @staticmethod
    def _default_schedule_datetime(value, hour):
        if not value:
            return None
        aware_value = datetime.combine(value, time(hour=hour, minute=0))
        return timezone.make_aware(aware_value, timezone.get_current_timezone())

    def _sync_operational_fields(self):
        if self.actual_check_in and not self.check_in_at:
            self.check_in_at = self.actual_check_in
        if self.check_in_at and not self.actual_check_in:
            self.actual_check_in = self.check_in_at

        if self.actual_check_out and not self.check_out_at:
            self.check_out_at = self.actual_check_out
        if self.check_out_at and not self.actual_check_out:
            self.actual_check_out = self.check_out_at

        if self.planned_check_out and not self.expected_check_out_date:
            self.expected_check_out_date = self.planned_check_out.date()
        if self.expected_check_out_date and not self.planned_check_out:
            self.planned_check_out = self._default_schedule_datetime(self.expected_check_out_date, 12)

        if self.planned_check_in is None and self.booking_id and self.booking.check_in_date:
            self.planned_check_in = self._default_schedule_datetime(self.booking.check_in_date, 14)

        if self.adults_count < 1:
            self.adults_count = 1
        if self.children_count < 0:
            self.children_count = 0

        computed_guests = (self.adults_count or 0) + (self.children_count or 0)
        self.number_of_guests = computed_guests if computed_guests > 0 else max(self.number_of_guests or 0, 1)

    @property
    def room_type(self):
        return self.room.room_type

    @property
    def planned_check_in_date(self):
        return self.planned_check_in.date() if self.planned_check_in else None

    def clean(self):
        self._sync_operational_fields()
        errors = {}

        if self.room_id and self.room and self.room.hotel_id and not self.hotel_id:
            self.hotel = self.room.hotel
        if self.guest_id and self.guest and self.guest.hotel_id and not self.hotel_id:
            self.hotel = self.guest.hotel
        if self.booking_id and self.booking and self.booking.hotel_id and not self.hotel_id:
            self.hotel = self.booking.hotel

        if self.booking:
            if self.booking.guest_id != self.guest_id:
                errors["guest"] = "Le client du sejour doit correspondre au client de la reservation."
            if self.booking.room_id and self.booking.room_id != self.room_id:
                errors["room"] = "La chambre du sejour doit correspondre a la chambre reservee."
            if self.hotel_id and self.booking.hotel_id and self.booking.hotel_id != self.hotel_id:
                errors["booking"] = "La reservation selectionnee doit appartenir au meme hotel que le sejour."
            if self.booking.room_type_id != self.room.room_type_id:
                errors["room"] = "La chambre choisie ne correspond pas au type de chambre reserve."
            if self.booking.status != Booking.Status.CONFIRMED and self._state.adding:
                errors["booking"] = "Seule une reservation confirmee peut etre transformee en sejour."
            if not self.planned_check_in and self.booking.check_in_date:
                self.planned_check_in = self._default_schedule_datetime(self.booking.check_in_date, 14)
            if not self.planned_check_out and self.booking.check_out_date:
                self.planned_check_out = self._default_schedule_datetime(self.booking.check_out_date, 12)
            if not self.expected_check_out_date:
                self.expected_check_out_date = self.booking.check_out_date

        if not self.room.is_active:
            errors["room"] = "La chambre selectionnee est inactive."

        if self.hotel_id and self.guest_id and self.guest and self.guest.hotel_id and self.guest.hotel_id != self.hotel_id:
            errors["guest"] = "Le client selectionne doit appartenir au meme hotel que le sejour."

        if self.hotel_id and self.room_id and self.room and self.room.hotel_id and self.room.hotel_id != self.hotel_id:
            errors["room"] = "La chambre selectionnee doit appartenir au meme hotel que le sejour."

        if self._state.adding:
            room_is_reserved_for_booking = (
                self.room.status == Room.Status.RESERVED
                and self.booking_id
                and self.booking
                and self.booking.room_id == self.room_id
            )
            if self.room.status != Room.Status.AVAILABLE and not room_is_reserved_for_booking:
                errors["room"] = "La chambre doit etre disponible pour effectuer un check-in."

        if self.planned_check_in and self.planned_check_out and self.planned_check_out < self.planned_check_in:
            errors["planned_check_out"] = "Le depart prevu ne peut pas etre anterieur a l'arrivee prevue."

        if self.actual_check_out and self.actual_check_in and self.actual_check_out < self.actual_check_in:
            errors["actual_check_out"] = "Le check-out ne peut pas etre anterieur au check-in."

        if self.number_of_guests != (self.adults_count + self.children_count):
            errors["number_of_guests"] = "Le nombre total d'occupants doit correspondre aux adultes et enfants."

        if self.number_of_guests > self.room.room_type.capacity:
            errors["number_of_guests"] = "Le nombre total de personnes depasse la capacite de la chambre."

        room_conflict = (
            Stay.objects.filter(room=self.room, status=self.Status.IN_PROGRESS)
            .exclude(pk=self.pk)
            .exists()
        )
        if room_conflict:
            errors["room"] = "Un autre sejour actif occupe deja cette chambre."

        guest_conflict = (
            Stay.objects.filter(guest=self.guest, status=self.Status.IN_PROGRESS)
            .exclude(pk=self.pk)
            .exists()
        )
        if guest_conflict:
            errors["guest"] = "Ce client a deja un autre sejour actif."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self.generate_reference()

        self._sync_operational_fields()
        self.full_clean()

        with transaction.atomic():
            super().save(*args, **kwargs)

            if self.status == self.Status.IN_PROGRESS:
                room = Room.objects.select_for_update().get(pk=self.room_id)
                if room.status != Room.Status.OCCUPIED:
                    room.status = Room.Status.OCCUPIED
                    room.save(update_fields=["status", "updated_at"])

                if self.booking_id:
                    booking = Booking.objects.select_for_update().get(pk=self.booking_id)
                    if booking.status != Booking.Status.CHECKED_IN or booking.room_id != self.room_id:
                        booking.status = Booking.Status.CHECKED_IN
                        booking.room = self.room
                        booking.save(update_fields=["status", "room", "updated_at"])

            from apps.rooms.services import sync_room_operational_status

            sync_room_operational_status(self.room)

    @staticmethod
    def generate_reference():
        return generate_unique_reference(Stay, "STY")

    def get_checkout_payment_policy(self):
        from apps.tenancy.models import HotelSettings

        if not self.hotel_id:
            return HotelSettings.CheckoutPaymentPolicy.BLOCKING
        settings, _ = HotelSettings.objects.get_or_create(hotel=self.hotel)
        return settings.checkout_payment_policy

    def get_financial_totals(self):
        from django.db.models import Q, Sum

        from apps.billing.models import ClientInvoice, Payment
        from apps.consumptions.models import ClientConsumption

        invoice_totals = (
            ClientInvoice.objects.filter(stay=self)
            .exclude(status=ClientInvoice.Status.CANCELLED)
            .aggregate(total=Sum("total_amount"), balance_due=Sum("balance_due"))
        )
        invoice_total = invoice_totals["total"] or Decimal("0.00")
        invoice_balance_due = invoice_totals["balance_due"] or Decimal("0.00")

        if invoice_total > Decimal("0.00"):
            total_amount = invoice_total
        else:
            booking_estimate = self.booking.estimated_amount if self.booking_id else Decimal("0.00")
            consumptions_total = (
                ClientConsumption.objects.filter(stay=self)
                .exclude(status=ClientConsumption.Status.CANCELLED)
                .aggregate(total=Sum("total_amount"))["total"]
                or Decimal("0.00")
            )
            total_amount = booking_estimate + consumptions_total

        payment_filter = Q(stay=self)
        if self.booking_id:
            payment_filter |= Q(booking=self.booking)
        paid_total = (
            Payment.objects.filter(payment_filter, status=Payment.Status.PAID)
            .distinct()
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        unpaid_balance = max(total_amount - paid_total, Decimal("0.00"))
        if invoice_balance_due > unpaid_balance:
            unpaid_balance = invoice_balance_due

        return {
            "total_amount": total_amount,
            "total_paid": paid_total,
            "unpaid_balance": unpaid_balance,
        }

    def validate_checkout_payment_policy(self):
        from apps.tenancy.models import HotelSettings

        policy = self.get_checkout_payment_policy()
        if policy != HotelSettings.CheckoutPaymentPolicy.BLOCKING:
            return

        totals = self.get_financial_totals()
        if totals["total_paid"] < totals["total_amount"]:
            raise ValidationError("Check-out impossible : le séjour n’est pas entièrement payé.")

    def complete_checkout(self, actor=None):
        if self.status == self.Status.COMPLETED:
            raise ValidationError("Ce sejour est deja termine.")

        self.validate_checkout_payment_policy()

        with transaction.atomic():
            self.status = self.Status.COMPLETED
            self.actual_check_out = timezone.now()
            self.check_out_at = self.actual_check_out
            if actor is not None:
                self.checked_out_by = actor
            self.save(update_fields=["status", "actual_check_out", "check_out_at", "checked_out_by", "updated_at"])

            room = Room.objects.select_for_update().get(pk=self.room_id)
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
                    notes=f"Rotation automatique apres check-out du sejour {self.reference}.",
                )

        log_history(
            action_type=HistoryEntry.ActionType.CHECK_OUT,
            module="stays",
            entity_type="Stay",
            entity_reference=self.reference,
            description=f"Check-out effectue pour le sejour {self.reference}.",
            metadata={
                "stay_id": self.id,
                "room_id": self.room_id,
                "booking_id": self.booking_id,
                "check_out_at": self.actual_check_out.isoformat() if self.actual_check_out else None,
            },
        )

    @classmethod
    def create_from_booking(cls, booking, room=None, notes="", actor=None):
        if booking.status != Booking.Status.CONFIRMED:
            raise ValidationError("La reservation doit etre confirmee avant le check-in.")
        if booking.check_in_date > timezone.localdate():
            raise ValidationError("Le check-in ne peut pas etre effectue avant la date d'arrivee prevue.")

        selected_room = room or booking.room
        if not selected_room:
            raise ValidationError("Une chambre doit etre affectee avant de creer le sejour.")

        stay = cls(
            booking=booking,
            guest=booking.guest,
            room=selected_room,
            source=booking.source,
            planned_check_in=cls._default_schedule_datetime(booking.check_in_date, 14),
            actual_check_in=timezone.now(),
            expected_check_out_date=booking.check_out_date,
            planned_check_out=cls._default_schedule_datetime(booking.check_out_date, 12),
            number_of_guests=booking.adults + booking.children,
            adults_count=booking.adults,
            children_count=booking.children,
            notes=notes or booking.notes,
            checked_in_by=actor,
        )
        stay.save()
        log_history(
            action_type=HistoryEntry.ActionType.CHECK_IN,
            module="stays",
            entity_type="Stay",
            entity_reference=stay.reference,
            description=f"Check-in effectue pour la reservation {booking.reference}.",
            metadata={
                "stay_id": stay.id,
                "booking_id": booking.id,
                "room_id": selected_room.id,
                "guest_id": booking.guest_id,
            },
        )
        return stay

    @classmethod
    def create_walk_in(
        cls,
        *,
        guest,
        room,
        planned_check_in=None,
        actual_check_in=None,
        planned_check_out=None,
        adults_count=1,
        children_count=0,
        source=Source.WALK_IN,
        purpose_of_stay="",
        notes="",
        special_requests="",
        actor=None,
    ):
        actual_entry = actual_check_in or timezone.now()
        stay = cls(
            guest=guest,
            room=room,
            source=source or cls.Source.WALK_IN,
            status=cls.Status.IN_PROGRESS,
            planned_check_in=planned_check_in or actual_entry,
            actual_check_in=actual_entry,
            planned_check_out=planned_check_out,
            expected_check_out_date=planned_check_out.date() if planned_check_out else None,
            adults_count=adults_count,
            children_count=children_count,
            number_of_guests=adults_count + children_count,
            purpose_of_stay=purpose_of_stay,
            notes=notes,
            special_requests=special_requests,
            checked_in_by=actor,
        )
        stay.save()
        log_history(
            action_type=HistoryEntry.ActionType.CHECK_IN,
            module="stays",
            entity_type="Stay",
            entity_reference=stay.reference,
            description=f"Sejour direct cree pour {guest.full_name}.",
            metadata={
                "stay_id": stay.id,
                "room_id": room.id,
                "guest_id": guest.id,
                "source": stay.source,
            },
        )
        return stay
