import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        RECEPTION = "reception", "Reception"
        CASHIER = "cashier", "Caissier"
        HOUSEKEEPING = "housekeeping", "Housekeeping"
        MANAGER = "manager", "Manager"
        RESTAURANT = "restaurant", "Restaurant"

    class PlatformRole(models.TextChoices):
        NONE = "none", "Aucun"
        SUPER_ADMIN = "super_admin_platform", "Super Admin Plateforme"
        PLATFORM_ADMIN = "platform_admin", "Admin Plateforme"

    class IamRole(models.TextChoices):
        SUPER_ROOT = "SUPER_ROOT", "Super Root"
        SUPER_ADMIN_PLATFORM = "SUPER_ADMIN_PLATFORM", "Super Admin Plateforme"
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Admin Plateforme"
        ORGANIZATION_OWNER = "ORGANIZATION_OWNER", "Proprietaire Organisation"
        ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN", "Admin Organisation"
        HOTEL_ADMIN = "HOTEL_ADMIN", "Admin Hotel"
        HOTEL_MANAGER = "HOTEL_MANAGER", "Manager Hotel"
        RECEPTIONIST = "RECEPTIONIST", "Receptionniste"
        ACCOUNTANT = "ACCOUNTANT", "Comptable"
        STAFF = "STAFF", "Personnel"
        HOUSEKEEPING = "HOUSEKEEPING", "Housekeeping"
        CLIENT = "CLIENT", "Client"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
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
    platform_role = models.CharField(
        max_length=30,
        choices=PlatformRole.choices,
        default=PlatformRole.NONE,
        verbose_name="Role plateforme",
    )
    email_verified = models.BooleanField(default=False, verbose_name="Email verifie")
    phone_verified = models.BooleanField(default=False, verbose_name="Telephone verifie")
    two_factor_enabled = models.BooleanField(default=False, verbose_name="2FA active")
    two_factor_enabled_at = models.DateTimeField(blank=True, null=True, verbose_name="2FA activee le")
    failed_login_attempts = models.PositiveSmallIntegerField(default=0, verbose_name="Tentatives echouees")
    locked_until = models.DateTimeField(blank=True, null=True, verbose_name="Verrouille jusqu'au")

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="uniq_user_email_ci_nonblank",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.hotel_id and self.hotel and self.organization_id != self.hotel.organization_id:
            self.organization = self.hotel.organization
        if self.organization_id and self.hotel_id and self.hotel and self.hotel.organization_id != self.organization_id:
            raise ValidationError("L'hotel selectionne doit appartenir a la meme organisation que l'utilisateur.")
        if self.is_platform_admin:
            self.organization = None
            self.hotel = None
            self.is_staff = True
            if self.platform_role == self.PlatformRole.NONE:
                self.platform_role = self.PlatformRole.SUPER_ADMIN
            self.role = self.Role.ADMIN
        else:
            self.platform_role = self.PlatformRole.NONE
        if not self.is_platform_admin and self.role == self.Role.ADMIN:
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

    @property
    def is_organization_admin(self):
        return self.role == self.Role.ADMIN and self.organization_id and not self.hotel_id and not self.is_platform_admin

    @property
    def is_super_admin_platform(self):
        return self.is_platform_admin and self.platform_role == self.PlatformRole.SUPER_ADMIN

    @property
    def is_platform_admin_role(self):
        return self.is_platform_admin and self.platform_role == self.PlatformRole.PLATFORM_ADMIN

    @property
    def is_super_root(self):
        return self.is_superuser and not self.is_platform_admin

    @property
    def requires_two_factor(self):
        enforce_sensitive_2fa = getattr(settings, "AUTH_ENFORCE_SENSITIVE_2FA", False)
        return bool(self.two_factor_enabled or (enforce_sensitive_2fa and (self.is_platform_admin or self.is_super_root)))

    @property
    def is_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

    def lock_for(self, seconds):
        self.locked_until = timezone.now() + timezone.timedelta(seconds=seconds)
        self.save(update_fields=["locked_until"])

    def register_failed_login(self, *, lock_threshold=5, lock_seconds=900):
        self.failed_login_attempts = min((self.failed_login_attempts or 0) + 1, 255)
        update_fields = ["failed_login_attempts"]
        if self.failed_login_attempts >= lock_threshold:
            self.locked_until = timezone.now() + timezone.timedelta(seconds=lock_seconds)
            update_fields.append("locked_until")
        self.save(update_fields=update_fields)

    def clear_login_failures(self):
        if self.failed_login_attempts or self.locked_until:
            self.failed_login_attempts = 0
            self.locked_until = None
            self.save(update_fields=["failed_login_attempts", "locked_until"])


class UserModulePermission(models.Model):
    class ModuleCode(models.TextChoices):
        DASHBOARD = "dashboard", "Dashboard"
        CLIENTS = "clients", "Clients"
        ROOMS = "rooms", "Chambres"
        OPERATIONS = "operations", "Operations"
        BILLING = "billing", "Facturation"
        PAYMENTS = "payments", "Paiements"
        REPORTS = "reports", "Rapports"
        HISTORY = "history", "Journal d'activite"
        USERS = "users", "Utilisateurs"
        SETTINGS = "settings", "Parametres"
        SATISFACTION = "satisfaction", "Satisfaction"
        PLATFORM_ORGANIZATIONS = "platform_organizations", "Plateforme organisations"
        PLATFORM_HOTELS = "platform_hotels", "Plateforme hotels"
        PLATFORM_MODULES = "platform_modules", "Plateforme modules"
        PLATFORM_LICENSES = "platform_licenses", "Plateforme licences"
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


class IAMRole(models.Model):
    code = models.CharField(max_length=80, unique=True, verbose_name="Code")
    name = models.CharField(max_length=120, verbose_name="Nom")
    description = models.TextField(blank=True, verbose_name="Description")
    is_system = models.BooleanField(default=True, verbose_name="Role systeme")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Role IAM"
        verbose_name_plural = "Roles IAM"
        ordering = ["code"]

    def __str__(self):
        return self.code


class IAMPermission(models.Model):
    code = models.CharField(max_length=120, unique=True, verbose_name="Code")
    module_code = models.CharField(max_length=80, blank=True, verbose_name="Module")
    action = models.CharField(max_length=40, blank=True, verbose_name="Action")
    description = models.TextField(blank=True, verbose_name="Description")
    is_active = models.BooleanField(default=True, verbose_name="Active")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creee le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mise a jour le")

    class Meta:
        verbose_name = "Permission IAM"
        verbose_name_plural = "Permissions IAM"
        ordering = ["code"]

    def __str__(self):
        return self.code


class IAMRolePermission(models.Model):
    role = models.ForeignKey(IAMRole, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(IAMPermission, on_delete=models.CASCADE, related_name="role_permissions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Permission de role IAM"
        verbose_name_plural = "Permissions de roles IAM"
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="uniq_iam_role_permission"),
        ]

    def __str__(self):
        return f"{self.role.code} - {self.permission.code}"


class UserPermissionOverride(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="iam_permission_overrides")
    permission = models.ForeignKey(IAMPermission, on_delete=models.CASCADE, related_name="user_overrides")
    is_allowed = models.BooleanField(default=True, verbose_name="Autorise")
    reason = models.CharField(max_length=255, blank=True, verbose_name="Motif")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Override permission utilisateur"
        verbose_name_plural = "Overrides permissions utilisateurs"
        constraints = [
            models.UniqueConstraint(fields=["user", "permission"], name="uniq_user_permission_override"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.permission.code}"


class UserOrganizationRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="organization_roles")
    organization = models.ForeignKey("tenancy.Organization", on_delete=models.CASCADE, related_name="user_roles")
    role_code = models.CharField(max_length=40, choices=User.IamRole.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Role utilisateur organisation"
        verbose_name_plural = "Roles utilisateurs organisations"
        constraints = [
            models.UniqueConstraint(fields=["user", "organization", "role_code"], name="uniq_user_org_role"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.organization_id} - {self.role_code}"


class UserHotelRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hotel_roles")
    hotel = models.ForeignKey("tenancy.Hotel", on_delete=models.CASCADE, related_name="user_roles")
    role_code = models.CharField(max_length=40, choices=User.IamRole.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Role utilisateur hotel"
        verbose_name_plural = "Roles utilisateurs hotels"
        constraints = [
            models.UniqueConstraint(fields=["user", "hotel", "role_code"], name="uniq_user_hotel_role"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.hotel_id} - {self.role_code}"


class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    refresh_token_jti = models.CharField(max_length=80, unique=True, verbose_name="JTI refresh")
    device_name = models.CharField(max_length=120, blank=True, verbose_name="Appareil")
    browser = models.CharField(max_length=120, blank=True, verbose_name="Navigateur")
    os = models.CharField(max_length=120, blank=True, verbose_name="Systeme")
    ip_address = models.GenericIPAddressField(blank=True, null=True, verbose_name="Adresse IP")
    user_agent = models.TextField(blank=True, verbose_name="User-Agent")
    last_activity = models.DateTimeField(default=timezone.now, verbose_name="Derniere activite")
    is_active = models.BooleanField(default=True, verbose_name="Active")
    revoked_at = models.DateTimeField(blank=True, null=True, verbose_name="Revoquee le")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creee le")

    class Meta:
        verbose_name = "Session utilisateur"
        verbose_name_plural = "Sessions utilisateurs"
        ordering = ["-last_activity", "-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"], name="user_session_active_idx"),
            models.Index(fields=["refresh_token_jti"], name="user_session_jti_idx"),
        ]

    def revoke(self):
        if self.is_active:
            self.is_active = False
            self.revoked_at = timezone.now()
            self.save(update_fields=["is_active", "revoked_at"])

    def __str__(self):
        return f"{self.user.username} - {self.refresh_token_jti}"


class BlacklistedToken(models.Model):
    token = models.TextField(blank=True, default="", verbose_name="Token legacy")
    token_hash = models.CharField(max_length=64, blank=True, verbose_name="Hash token")
    token_jti = models.CharField(max_length=80, blank=True, verbose_name="JTI token")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Token revoque"
        verbose_name_plural = "Tokens revoques"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token_hash"], name="black_token_hash_idx"),
            models.Index(fields=["token_jti"], name="black_token_jti_idx"),
        ]

    def __str__(self):
        return f"Token revoque #{self.pk}"
