from django.conf import settings
from django.db import models


class HistoryEntry(models.Model):
    class ActionType(models.TextChoices):
        BOOKING_CREATED = "booking_created", "Reservation creee"
        CHECK_IN = "check_in", "Check-in"
        CHECK_OUT = "check_out", "Check-out"
        DAY_USE_CREATED = "day_use_created", "Day use cree"
        DAY_USE_CHECK_IN = "day_use_check_in", "Day use entree"
        DAY_USE_CHECK_OUT = "day_use_check_out", "Day use sortie"
        CLEANING_COMPLETED = "cleaning_completed", "Nettoyage termine"
        PAYMENT_RECORDED = "payment_recorded", "Paiement enregistre"
        SATISFACTION_RECORDED = "satisfaction_recorded", "Satisfaction enregistree"
        STATUS_UPDATED = "status_updated", "Statut mis a jour"
        OTHER = "other", "Autre"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="history_entries",
        verbose_name="Auteur",
        blank=True,
        null=True,
    )
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.SET_NULL,
        related_name="history_entries",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    action_type = models.CharField(
        max_length=40,
        choices=ActionType.choices,
        verbose_name="Type d'action",
    )
    module = models.CharField(max_length=50, verbose_name="Module")
    entity_type = models.CharField(max_length=50, verbose_name="Type d'entite")
    entity_reference = models.CharField(max_length=100, verbose_name="Reference entite")
    description = models.TextField(verbose_name="Description")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadonnees")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Historique"
        verbose_name_plural = "Historique"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["hotel", "created_at"], name="history_hotel_created_idx"),
            models.Index(fields=["hotel", "module"], name="history_hotel_module_idx"),
        ]

    def __str__(self):
        return f"{self.action_type} - {self.entity_reference}"
