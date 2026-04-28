from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        RECEPTION = "reception", "Reception"
        CASHIER = "cashier", "Caissier"
        HOUSEKEEPING = "housekeeping", "Housekeeping"
        MANAGER = "manager", "Manager"
        RESTAURANT = "restaurant", "Restaurant"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.RECEPTION,
        verbose_name="Role",
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Telephone",
    )
    organization = models.ForeignKey(
        "tenancy.Organization",
        on_delete=models.SET_NULL,
        related_name="users",
        blank=True,
        null=True,
        verbose_name="Organisation",
    )
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.SET_NULL,
        related_name="users",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    is_platform_admin = models.BooleanField(default=False, verbose_name="Administrateur plateforme")

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def save(self, *args, **kwargs):
        if self.hotel_id and self.hotel and self.organization_id != self.hotel.organization_id:
            self.organization = self.hotel.organization
        if self.organization_id and self.hotel_id and self.hotel and self.hotel.organization_id != self.organization_id:
            raise ValidationError("L'hotel selectionne doit appartenir a la meme organisation que l'utilisateur.")
        if self.is_platform_admin:
            self.organization = None
            self.hotel = None
            self.is_staff = True
            self.is_superuser = True
        elif self.role == self.Role.ADMIN:
            self.is_staff = True
        super().save(*args, **kwargs)

    def __str__(self):
        full_name = self.get_full_name().strip()
        return full_name or self.username

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN

    @property
    def is_hotel_admin(self):
        return self.role == self.Role.ADMIN and not self.is_platform_admin


class UserModulePermission(models.Model):
    class ModuleCode(models.TextChoices):
        DASHBOARD = "dashboard", "Dashboard"
        CLIENTS = "clients", "Clients"
        ROOMS = "rooms", "Chambres"
        OPERATIONS = "operations", "Operations"
        BILLING = "billing", "Facturation"
        REPORTS = "reports", "Rapports"
        USERS = "users", "Utilisateurs"
        SATISFACTION = "satisfaction", "Satisfaction"
        PLATFORM_ORGANIZATIONS = "platform_organizations", "Plateforme organisations"
        PLATFORM_HOTELS = "platform_hotels", "Plateforme hotels"
        PLATFORM_SUBSCRIPTIONS = "platform_subscriptions", "Plateforme abonnements"
        PLATFORM_USERS = "platform_users", "Plateforme utilisateurs"
        PLATFORM_SECURITY = "platform_security", "Plateforme securite"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="module_permissions",
        verbose_name="Utilisateur",
    )
    module_code = models.CharField(max_length=30, choices=ModuleCode.choices, verbose_name="Module")
    can_view = models.BooleanField(default=True, verbose_name="Voir")
    can_create = models.BooleanField(default=False, verbose_name="Creer")
    can_update = models.BooleanField(default=False, verbose_name="Modifier")
    can_delete = models.BooleanField(default=False, verbose_name="Supprimer")
    can_manage = models.BooleanField(default=False, verbose_name="Administrer")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Permission module utilisateur"
        verbose_name_plural = "Permissions modules utilisateurs"
        constraints = [
            models.UniqueConstraint(fields=["user", "module_code"], name="uniq_user_module_permission"),
        ]
        indexes = [
            models.Index(fields=["user", "module_code"], name="user_module_perm_idx"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.module_code}"


class BlacklistedToken(models.Model):
    token = models.TextField(verbose_name="Token")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Token revoque"
        verbose_name_plural = "Tokens revoques"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Token revoque #{self.pk}"
