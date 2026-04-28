from django.db import models
from django.utils import timezone


class Guest(models.Model):
    CLIENT_CODE_PREFIX = "AFR-CL"
    CLIENT_CODE_SEQUENCE_WIDTH = 6

    class Gender(models.TextChoices):
        MALE = "male", "Homme"
        FEMALE = "female", "Femme"
        OTHER = "other", "Autre"

    class ClientType(models.TextChoices):
        INDIVIDUAL = "individual", "Individuel"
        COMPANY = "company", "Entreprise"
        VIP = "vip", "VIP"
        CORPORATE = "corporate", "Corporate"

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "Celibataire"
        MARRIED = "married", "Marie(e)"
        DIVORCED = "divorced", "Divorce(e)"
        WIDOWED = "widowed", "Veuf(ve)"
        OTHER = "other", "Autre"

    class IdentityDocumentType(models.TextChoices):
        NATIONAL_ID = "national_id", "Carte nationale d'identite"
        PASSPORT = "passport", "Passeport"
        RESIDENCE_PERMIT = "residence_permit", "Titre de sejour"
        DRIVER_LICENSE = "driver_license", "Permis de conduire"
        OTHER = "other", "Autre"

    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.PROTECT,
        related_name="guests",
        blank=True,
        null=True,
        verbose_name="Hotel",
    )
    client_code = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        editable=False,
        verbose_name="Code client",
    )
    first_name = models.CharField(max_length=100, verbose_name="Prenom")
    middle_name = models.CharField(max_length=100, blank=True, verbose_name="Autres prenoms")
    last_name = models.CharField(max_length=100, verbose_name="Nom")
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        blank=True,
        verbose_name="Sexe",
    )
    client_type = models.CharField(
        max_length=20,
        choices=ClientType.choices,
        default=ClientType.INDIVIDUAL,
        verbose_name="Type de client",
    )
    marital_status = models.CharField(
        max_length=20,
        choices=MaritalStatus.choices,
        blank=True,
        verbose_name="Situation matrimoniale",
    )
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        verbose_name="Date de naissance",
    )
    place_of_birth = models.CharField(max_length=150, blank=True, verbose_name="Lieu de naissance")
    profession = models.CharField(max_length=150, blank=True, verbose_name="Profession")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Telephone")
    secondary_phone = models.CharField(max_length=20, blank=True, verbose_name="Telephone secondaire")
    email = models.EmailField(blank=True, verbose_name="Email")
    address = models.CharField(max_length=255, blank=True, verbose_name="Adresse")
    city = models.CharField(max_length=100, blank=True, verbose_name="Ville")
    country = models.CharField(max_length=100, blank=True, verbose_name="Pays")
    nationality = models.CharField(max_length=100, blank=True, verbose_name="Nationalite")
    identity_document_type = models.CharField(
        max_length=30,
        choices=IdentityDocumentType.choices,
        blank=True,
        verbose_name="Type de piece",
    )
    identity_document_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Numero de piece",
    )
    document_issue_date = models.DateField(blank=True, null=True, verbose_name="Date d'emission")
    document_expiry_date = models.DateField(blank=True, null=True, verbose_name="Date d'expiration")
    document_issue_place = models.CharField(max_length=150, blank=True, verbose_name="Lieu d'emission")
    emergency_contact_name = models.CharField(max_length=150, blank=True, verbose_name="Contact d'urgence")
    emergency_contact_phone = models.CharField(max_length=20, blank=True, verbose_name="Telephone d'urgence")
    emergency_contact_relationship = models.CharField(max_length=100, blank=True, verbose_name="Lien avec le client")
    notes = models.TextField(blank=True, verbose_name="Notes")
    is_blacklisted = models.BooleanField(default=False, verbose_name="Blacklist")
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Client"
        verbose_name_plural = "Clients"
        ordering = ["last_name", "first_name", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=~models.Q(phone=""),
                name="unique_guest_phone",
            ),
            models.UniqueConstraint(
                fields=["identity_document_type", "identity_document_number"],
                condition=~models.Q(identity_document_type="") & ~models.Q(identity_document_number=""),
                name="unique_guest_identity_document",
            ),
        ]
        indexes = [
            models.Index(fields=["hotel", "last_name", "first_name"], name="guest_hotel_name_idx"),
            models.Index(fields=["hotel", "phone"], name="guest_hotel_phone_idx"),
            models.Index(fields=["last_name", "first_name"], name="guest_name_idx"),
            models.Index(fields=["phone"], name="guest_phone_idx"),
            models.Index(fields=["identity_document_number"], name="guest_identity_idx"),
            models.Index(fields=["email"], name="guest_email_idx"),
            models.Index(fields=["client_type"], name="guest_type_idx"),
        ]

    def __str__(self):
        return self.full_name

    @classmethod
    def build_client_code(cls, client_id, year):
        return f"{cls.CLIENT_CODE_PREFIX}-{year}-{int(client_id):0{cls.CLIENT_CODE_SEQUENCE_WIDTH}d}"

    def generate_client_code(self):
        if not self.pk:
            raise ValueError("Le code client ne peut etre genere qu'apres la creation du client.")
        reference_date = self.created_at or timezone.now()
        return self.build_client_code(self.pk, reference_date.year)

    @property
    def full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(part for part in parts if part).strip()

    @property
    def display_nationality(self):
        return self.nationality or self.country

    @property
    def client_status(self):
        if self.is_blacklisted:
            return "blacklist"
        if self.client_type == self.ClientType.VIP:
            return "vip"
        if self.client_type in {self.ClientType.COMPANY, self.ClientType.CORPORATE}:
            return "company"
        return "standard"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if not self.client_code:
            client_code = self.generate_client_code()
            updated = type(self).objects.filter(pk=self.pk, client_code__isnull=True).update(client_code=client_code)
            if updated:
                self.client_code = client_code
