import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def gen_ref(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


class Restaurant(models.Model):
    hotel = models.ForeignKey(
        "tenancy.Hotel",
        on_delete=models.CASCADE,
        related_name="restaurants",
        null=True,
        blank=True,
    )
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class UserPosAccess(models.Model):
    class PosRole(models.TextChoices):
        MANAGER = "manager_restaurant", "Manager restaurant"
        CAISSIER = "caissier", "Caissier"
        SERVEUR = "serveur", "Serveur"
        CUISINIER = "cuisinier", "Cuisinier"
        BARMAN = "barman", "Barman"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pos_accesses")
    organization = models.ForeignKey("tenancy.Organization", on_delete=models.CASCADE, related_name="pos_user_accesses")
    hotel = models.ForeignKey("tenancy.Hotel", on_delete=models.CASCADE, related_name="pos_user_accesses")
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="user_accesses", null=True, blank=True)
    pos_role = models.CharField(max_length=30, choices=PosRole.choices)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="pos_accesses_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["hotel__name", "restaurant__nom", "user__username"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "restaurant"],
                condition=Q(restaurant__isnull=False),
                name="uniq_pos_access_user_restaurant",
            ),
            models.UniqueConstraint(
                fields=["user", "hotel"],
                condition=Q(restaurant__isnull=True),
                name="uniq_pos_access_user_hotel",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "is_active"], name="pos_access_user_active_idx"),
            models.Index(fields=["hotel", "is_active"], name="pos_access_hotel_active_idx"),
            models.Index(fields=["restaurant", "is_active"], name="pos_access_rest_active_idx"),
        ]

    def clean(self):
        if self.hotel_id and self.organization_id and self.hotel.organization_id != self.organization_id:
            from django.core.exceptions import ValidationError

            raise ValidationError("L'hotel doit appartenir a l'organisation selectionnee.")
        if self.restaurant_id and self.hotel_id and self.restaurant.hotel_id != self.hotel_id:
            from django.core.exceptions import ValidationError

            raise ValidationError("Le restaurant doit appartenir a l'hotel selectionne.")

    def save(self, *args, **kwargs):
        if self.hotel_id and not self.organization_id:
            self.organization = self.hotel.organization
        if self.restaurant_id and not self.hotel_id:
            self.hotel = self.restaurant.hotel
            self.organization = self.restaurant.hotel.organization
        super().save(*args, **kwargs)

    def __str__(self):
        restaurant = self.restaurant.nom if self.restaurant else "Tous restaurants"
        return f"{self.user} - {self.hotel} - {restaurant} - {self.pos_role}"


class POSServer(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        SUSPENDED = "suspended", "Suspendu"
        INACTIVE = "inactive", "Inactif"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="pos_server_profiles",
        null=True,
        blank=True,
    )
    employee_id = models.CharField(max_length=80, blank=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="servers")
    code = models.CharField(max_length=40)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["restaurant__nom", "first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "code"], name="uniq_pos_server_restaurant_code"),
        ]
        indexes = [
            models.Index(fields=["restaurant", "status"], name="pos_server_rest_status_idx"),
            models.Index(fields=["user", "status"], name="pos_server_user_status_idx"),
        ]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.code

    @classmethod
    def resolve_for_user(cls, user, restaurant):
        if not user or not restaurant:
            return None
        return (
            cls.objects.filter(
                user=user,
                restaurant=restaurant,
                status=cls.Status.ACTIVE,
            )
            .order_by("first_name", "last_name")
            .first()
        )

    def __str__(self):
        return f"{self.full_name} - {self.restaurant.nom}"


class ServerShift(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Ouvert"
        CLOSED = "closed", "Cloture"
        CANCELLED = "cancelled", "Annule"

    server = models.ForeignKey(POSServer, on_delete=models.CASCADE, related_name="shifts")
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="server_shifts")
    shift_name = models.CharField(max_length=120)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_time"]
        indexes = [
            models.Index(fields=["server", "status"], name="pos_shift_server_status_idx"),
            models.Index(fields=["restaurant", "status"], name="pos_shift_rest_status_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.server_id and not self.restaurant_id:
            self.restaurant = self.server.restaurant
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.server.full_name} - {self.shift_name}"


class DiningArea(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="areas")
    nom = models.CharField(max_length=100)
    capacite = models.PositiveIntegerField(default=0)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["restaurant__nom", "nom"]

    def __str__(self):
        return f"{self.restaurant.nom} - {self.nom}"


class Table(models.Model):
    class Status(models.TextChoices):
        LIBRE = "libre", "Libre"
        OCCUPEE = "occupee", "Occupee"
        RESERVEE = "reservee", "Reservee"
        FERMEE = "fermee", "Fermee"

    area = models.ForeignKey(DiningArea, on_delete=models.CASCADE, related_name="tables")
    numero = models.CharField(max_length=20)
    capacite = models.PositiveIntegerField(default=4)
    statut = models.CharField(max_length=20, choices=Status.choices, default=Status.LIBRE)
    qr_code = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ("area", "numero")
        ordering = ["area__nom", "numero"]

    def __str__(self):
        return f"Table {self.numero} ({self.area.nom})"


class Menu(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="menus")
    nom = models.CharField(max_length=200)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["restaurant__nom", "nom"]

    def __str__(self):
        return self.nom


class MenuCategory(models.Model):
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="categories")
    nom = models.CharField(max_length=100)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class MenuItem(models.Model):
    category = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name="items")
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=12, decimal_places=2)
    disponible = models.BooleanField(default=True)
    temps_prep_min = models.PositiveIntegerField(default=15)
    image = models.ImageField(
        upload_to="pos/menu/",
        blank=True,
        null=True,
        help_text="Photo du plat ou de la boisson. Formats acceptes : JPG, PNG, WEBP. Recommande : 400x300px minimum.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__ordre", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.prix})"


class Discount(models.Model):
    class TypeRemise(models.TextChoices):
        PCT = "pct", "Pourcentage"
        FIXE = "fixe", "Montant fixe"

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="discounts")
    nom = models.CharField(max_length=100)
    type_remise = models.CharField(max_length=10, choices=TypeRemise.choices, default=TypeRemise.PCT)
    valeur = models.DecimalField(max_digits=8, decimal_places=2)
    permission_requise = models.BooleanField(default=True)
    actif = models.BooleanField(default=True)

    def __str__(self):
        return self.nom


class Tax(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="taxes")
    nom = models.CharField(max_length=100)
    taux_pct = models.DecimalField(max_digits=5, decimal_places=2)
    actif = models.BooleanField(default=True)

    def __str__(self):
        return self.nom


class VoidReason(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="void_reasons")
    libelle = models.CharField(max_length=200)
    actif = models.BooleanField(default=True)

    def __str__(self):
        return self.libelle


class Order(models.Model):
    class Status(models.TextChoices):
        OUVERTE = "ouverte", "Ouverte"
        EN_CUISINE = "en_cuisine", "En cuisine"
        SERVIE = "servie", "Servie"
        PAYEE = "payee", "Payee"
        ANNULEE = "annulee", "Annulee"

    reference = models.CharField(max_length=50, unique=True, editable=False)
    table = models.ForeignKey(Table, on_delete=models.PROTECT, related_name="orders")
    serveur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pos_orders")
    server = models.ForeignKey(POSServer, on_delete=models.PROTECT, related_name="orders", null=True, blank=True)
    statut = models.CharField(max_length=20, choices=Status.choices, default=Status.OUVERTE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = gen_ref("ORD")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference


class OrderItem(models.Model):
    class Status(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        EN_PREP = "en_prep", "En preparation"
        PRET = "pret", "Pret"
        SERVI = "servi", "Servi"
        ANNULE = "annule", "Annule"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantite = models.PositiveIntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=12, decimal_places=2)
    statut = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_ATTENTE)
    notes = models.TextField(blank=True)
    void_reason = models.ForeignKey(VoidReason, on_delete=models.SET_NULL, null=True, blank=True)

    @property
    def sous_total(self):
        return self.quantite * self.prix_unitaire

    def __str__(self):
        return f"{self.quantite} x {self.menu_item.nom}"


class KitchenTicket(models.Model):
    class Status(models.TextChoices):
        NOUVEAU = "nouveau", "Nouveau"
        EN_PREP = "en_prep", "En preparation"
        PRET = "pret", "Pret"
        LIVRE = "livre", "Livre"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="kitchen_tickets")
    statut = models.CharField(max_length=20, choices=Status.choices, default=Status.NOUVEAU)
    cuisinier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kitchen_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Ticket {self.pk} - {self.order.reference}"


class Bill(models.Model):
    class Status(models.TextChoices):
        OUVERTE = "ouverte", "Ouverte"
        PAYEE = "payee", "Payee"
        ANNULEE = "annulee", "Annulee"

    reference = models.CharField(max_length=50, unique=True, editable=False)
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="bill")
    sous_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    remise_montant = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    taxe_montant = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    statut = models.CharField(max_length=20, choices=Status.choices, default=Status.OUVERTE)
    discount = models.ForeignKey(Discount, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = gen_ref("BILL")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference


class Payment(models.Model):
    class Mode(models.TextChoices):
        ESPECES = "especes", "Especes"
        CARTE = "carte", "Carte bancaire"
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        CHAMBRE = "chambre", "Ajouter a la chambre"

    reference = models.CharField(max_length=50, unique=True, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name="payments")
    mode = models.CharField(max_length=20, choices=Mode.choices)
    montant = models.DecimalField(max_digits=14, decimal_places=2)
    reference_externe = models.CharField(max_length=200, blank=True)
    sejour = models.ForeignKey(
        "stays.Stay",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pos_payments",
    )
    caissier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pos_payments_processed",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = gen_ref("PAY")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference
