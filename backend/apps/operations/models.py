from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class RoomRelocation(models.Model):
    class RateImpactMode(models.TextChoices):
        KEEP_ORIGINAL = "keep_original", "Conserver le tarif"
        NONE = "none", "Aucun impact"
        APPLY_NEW_RATE = "apply_new_rate", "Appliquer le nouveau tarif"
        MANUAL_ADJUSTMENT = "manual_adjustment", "Ajustement manuel"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="room_relocations",
        verbose_name="Hotel",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.PROTECT,
        related_name="relocations",
        blank=True,
        null=True,
        verbose_name="Reservation",
    )
    stay = models.ForeignKey(
        "stays.Stay",
        on_delete=models.PROTECT,
        related_name="relocations",
        blank=True,
        null=True,
        verbose_name="Sejour",
    )
    guest = models.ForeignKey(
        "guests.Guest",
        on_delete=models.PROTECT,
        related_name="room_relocations",
        verbose_name="Client",
    )
    old_room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.PROTECT,
        related_name="relocations_from",
        verbose_name="Ancienne chambre",
    )
    new_room = models.ForeignKey(
        "rooms.Room",
        on_delete=models.PROTECT,
        related_name="relocations_to",
        verbose_name="Nouvelle chambre",
    )
    old_room_type = models.ForeignKey(
        "rooms.RoomType",
        on_delete=models.PROTECT,
        related_name="relocations_from",
        verbose_name="Ancien type de chambre",
    )
    new_room_type = models.ForeignKey(
        "rooms.RoomType",
        on_delete=models.PROTECT,
        related_name="relocations_to",
        verbose_name="Nouveau type de chambre",
    )
    reason = models.CharField(max_length=255, verbose_name="Motif")
    rate_impact_mode = models.CharField(
        max_length=30,
        choices=RateImpactMode.choices,
        default=RateImpactMode.KEEP_ORIGINAL,
        verbose_name="Impact tarifaire",
    )
    old_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Ancien montant")
    new_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Nouveau montant")
    notes = models.TextField(blank=True, verbose_name="Notes")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="room_relocations",
        blank=True,
        null=True,
        verbose_name="Agent",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Relogement"
        verbose_name_plural = "Relogements"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["hotel", "created_at"], name="reloc_hotel_created_idx"),
            models.Index(fields=["booking"], name="reloc_booking_idx"),
            models.Index(fields=["stay"], name="reloc_stay_idx"),
        ]

    def __str__(self):
        reference = self.stay.reference if self.stay_id else self.booking.reference if self.booking_id else self.id
        return f"Relogement {reference}: {self.old_room} -> {self.new_room}"

    def clean(self):
        errors = {}
        if not self.booking_id and not self.stay_id:
            errors["booking"] = "Le relogement doit concerner une reservation ou un sejour."
        if self.booking_id and self.stay_id:
            errors["stay"] = "Un relogement ne peut pas concerner une reservation et un sejour a la fois."
        if self.old_room_id and self.new_room_id and self.old_room_id == self.new_room_id:
            errors["new_room"] = "La nouvelle chambre doit etre differente de l'ancienne."
        if not (self.reason or "").strip():
            errors["reason"] = "Le motif du relogement est obligatoire."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
