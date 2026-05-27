import hashlib
import json

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


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        CREATE = "CREATE", "Creation"
        UPDATE = "UPDATE", "Modification"
        DELETE = "DELETE", "Suppression"
        VIEW = "VIEW", "Consultation"
        CONFIRM = "CONFIRM", "Confirmation"
        CANCEL = "CANCEL", "Annulation"
        CHECKIN = "CHECKIN", "Check-in"
        CHECKOUT = "CHECKOUT", "Check-out"
        PAYMENT = "PAYMENT", "Paiement"
        REFUND = "REFUND", "Remboursement"
        ROOM_STATUS_CHANGE = "ROOM_STATUS_CHANGE", "Changement statut chambre"
        PRICE_CHANGE = "PRICE_CHANGE", "Changement tarif"
        PASSWORD_CHANGE = "PASSWORD_CHANGE", "Changement mot de passe"
        PERMISSION_CHANGE = "PERMISSION_CHANGE", "Changement permission"
        EXPORT = "EXPORT", "Export"
        OTHER = "OTHER", "Autre"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        SUCCESS = "success", "Succes"
        WARNING = "warning", "Avertissement"
        DANGER = "danger", "Danger"
        CRITICAL = "critical", "Critique"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.SET_NULL,
        related_name="activity_logs",
        verbose_name="Hotel",
        blank=True,
        null=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="activity_logs",
        verbose_name="Utilisateur",
        blank=True,
        null=True,
    )
    user_role = models.CharField(max_length=40, blank=True, verbose_name="Role utilisateur")
    action = models.CharField(max_length=30, choices=Action.choices, verbose_name="Action")
    module = models.CharField(max_length=60, db_index=True, verbose_name="Module")
    object_type = models.CharField(max_length=80, blank=True, verbose_name="Type objet")
    object_id = models.CharField(max_length=80, blank=True, verbose_name="ID objet")
    object_reference = models.CharField(max_length=120, blank=True, verbose_name="Reference objet")
    description = models.TextField(verbose_name="Description")
    old_values = models.JSONField(default=dict, blank=True, verbose_name="Anciennes valeurs")
    new_values = models.JSONField(default=dict, blank=True, verbose_name="Nouvelles valeurs")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadonnees")
    ip_address = models.GenericIPAddressField(blank=True, null=True, verbose_name="Adresse IP")
    user_agent = models.TextField(blank=True, verbose_name="Navigateur")
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.INFO, verbose_name="Gravite")
    session_key = models.CharField(max_length=80, blank=True, verbose_name="Session")
    previous_integrity_hash = models.CharField(max_length=64, blank=True, verbose_name="Hash precedent")
    integrity_hash = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="Hash integrite")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Journal d'activite"
        verbose_name_plural = "Journal d'activite"
        ordering = ["-created_at", "-id"]
        permissions = [
            ("view_sensitive_activitylog", "Can view sensitive activity logs"),
            ("export_activitylog", "Can export activity logs"),
        ]
        indexes = [
            models.Index(fields=["hotel", "created_at"], name="activity_hotel_created_idx"),
            models.Index(fields=["hotel", "module"], name="activity_hotel_module_idx"),
            models.Index(fields=["action", "severity"], name="activity_action_severity_idx"),
            models.Index(fields=["user", "created_at"], name="activity_user_created_idx"),
        ]

    def __str__(self):
        actor = self.user.username if self.user_id else "system"
        return f"{self.created_at:%Y-%m-%d %H:%M} - {actor} - {self.action}"

    def _integrity_payload(self):
        return {
            "id": self.pk,
            "hotel_id": self.hotel_id,
            "user_id": self.user_id,
            "user_role": self.user_role,
            "action": self.action,
            "module": self.module,
            "object_type": self.object_type,
            "object_id": self.object_id,
            "object_reference": self.object_reference,
            "description": self.description,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "metadata": self.metadata,
            "ip_address": str(self.ip_address or ""),
            "user_agent": self.user_agent,
            "severity": self.severity,
            "session_key": self.session_key,
            "previous_integrity_hash": self.previous_integrity_hash,
            "created_at": self.created_at.isoformat() if self.created_at else "",
        }

    def calculate_integrity_hash(self):
        payload = json.dumps(self._integrity_payload(), sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @property
    def is_integrity_sealed(self):
        return bool(self.integrity_hash)

    def verify_integrity(self):
        if not self.integrity_hash:
            return False
        return self.integrity_hash == self.calculate_integrity_hash()

    def save(self, *args, **kwargs):
        is_create = self._state.adding
        if is_create and not self.previous_integrity_hash:
            previous = ActivityLog.objects.exclude(integrity_hash="").order_by("-created_at", "-id").first()
            self.previous_integrity_hash = previous.integrity_hash if previous else ""
        super().save(*args, **kwargs)
        if is_create and not self.integrity_hash:
            self.integrity_hash = self.calculate_integrity_hash()
            ActivityLog.objects.filter(pk=self.pk).update(integrity_hash=self.integrity_hash)
