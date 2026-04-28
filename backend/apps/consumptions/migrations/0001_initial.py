import decimal

import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("guests", "0003_guest_phone_constraint_and_indexes"),
        ("stays", "0002_stay_check_out_at"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceDepartment",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("code", models.SlugField(max_length=50, unique=True, verbose_name="Code")),
                ("name", models.CharField(max_length=100, unique=True, verbose_name="Nom")),
                (
                    "department_type",
                    models.CharField(
                        choices=[
                            ("room", "Chambre"),
                            ("restaurant", "Restaurant"),
                            ("bar", "Bar"),
                            ("pool", "Piscine"),
                            ("nightclub", "Night-club"),
                            ("spa", "Spa"),
                            ("laundry", "Blanchisserie"),
                            ("events", "Evenements"),
                            ("other", "Autres services"),
                        ],
                        default="other",
                        max_length=20,
                        verbose_name="Type de service",
                    ),
                ),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                ("is_active", models.BooleanField(default=True, verbose_name="Actif")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
            ],
            options={
                "verbose_name": "Departement de service",
                "verbose_name_plural": "Departements de service",
                "ordering": ["name", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ClientConsumption",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("reference", models.CharField(max_length=30, unique=True, verbose_name="Reference")),
                ("label", models.CharField(max_length=150, verbose_name="Libelle")),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                (
                    "quantity",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("1.00"),
                        max_digits=10,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.01"))],
                        verbose_name="Quantite",
                    ),
                ),
                (
                    "unit_price",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.00"))],
                        verbose_name="Prix unitaire",
                    ),
                ),
                (
                    "total_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.00"))],
                        verbose_name="Montant total",
                    ),
                ),
                ("service_date", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Date de service")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Brouillon"),
                            ("posted", "Validee"),
                            ("billed", "Facturee"),
                            ("cancelled", "Annulee"),
                        ],
                        default="draft",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "payment_status",
                    models.CharField(
                        choices=[
                            ("unpaid", "Non payee"),
                            ("partial", "Partiellement payee"),
                            ("paid", "Payee"),
                            ("refunded", "Remboursee"),
                        ],
                        default="unpaid",
                        max_length=20,
                        verbose_name="Statut de paiement",
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("manual", "Saisie manuelle"),
                            ("room", "Chambre"),
                            ("restaurant", "Restaurant"),
                            ("bar", "Bar"),
                            ("pool", "Piscine"),
                            ("nightclub", "Night-club"),
                            ("spa", "Spa"),
                            ("laundry", "Blanchisserie"),
                            ("events", "Evenements"),
                            ("other", "Autre"),
                        ],
                        default="manual",
                        max_length=20,
                        verbose_name="Source",
                    ),
                ),
                (
                    "billing_reference",
                    models.CharField(
                        blank=True,
                        help_text="Reference externe de facture/folio pour eviter une double facturation.",
                        max_length=50,
                        verbose_name="Reference de facturation",
                    ),
                ),
                ("billed_at", models.DateTimeField(blank=True, null=True, verbose_name="Facturee le")),
                (
                    "tenant_code",
                    models.CharField(
                        blank=True,
                        help_text="Champ de preparation SaaS en attendant un vrai modele Hotel/Tenant.",
                        max_length=50,
                        verbose_name="Code hotel/tenant",
                    ),
                ),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "client",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="consumptions",
                        to="guests.guest",
                        verbose_name="Client",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="client_consumptions_created",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Cree par",
                    ),
                ),
                (
                    "service_department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="consumptions",
                        to="consumptions.servicedepartment",
                        verbose_name="Departement de service",
                    ),
                ),
                (
                    "stay",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="consumptions",
                        to="stays.stay",
                        verbose_name="Sejour",
                    ),
                ),
            ],
            options={
                "verbose_name": "Consommation client",
                "verbose_name_plural": "Consommations clients",
                "ordering": ["-service_date", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ClientConsumptionItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("label", models.CharField(max_length=150, verbose_name="Libelle")),
                ("description", models.TextField(blank=True, verbose_name="Description")),
                (
                    "quantity",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("1.00"),
                        max_digits=10,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.01"))],
                        verbose_name="Quantite",
                    ),
                ),
                (
                    "unit_price",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.00"))],
                        verbose_name="Prix unitaire",
                    ),
                ),
                (
                    "total_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.00"))],
                        verbose_name="Montant total",
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Ordre")),
                ("notes", models.TextField(blank=True, verbose_name="Notes")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Cree le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")),
                (
                    "consumption",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="consumptions.clientconsumption",
                        verbose_name="Consommation",
                    ),
                ),
            ],
            options={
                "verbose_name": "Ligne de consommation client",
                "verbose_name_plural": "Lignes de consommation client",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="clientconsumption",
            constraint=models.CheckConstraint(
                condition=models.Q(("total_amount__gte", 0)),
                name="client_consumption_total_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="clientconsumption",
            constraint=models.CheckConstraint(
                condition=models.Q(("unit_price__gte", 0)),
                name="client_consumption_unit_price_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="clientconsumption",
            constraint=models.CheckConstraint(
                condition=models.Q(("quantity__gt", 0)),
                name="client_consumption_quantity_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="clientconsumptionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("total_amount__gte", 0)),
                name="client_consumption_item_total_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="clientconsumptionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("unit_price__gte", 0)),
                name="client_consumption_item_unit_price_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="clientconsumptionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("quantity__gt", 0)),
                name="client_consumption_item_quantity_positive",
            ),
        ),
        migrations.AddIndex(
            model_name="servicedepartment",
            index=models.Index(fields=["department_type"], name="svc_dept_type_idx"),
        ),
        migrations.AddIndex(
            model_name="servicedepartment",
            index=models.Index(fields=["is_active"], name="svc_dept_active_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["client", "service_date"], name="cons_client_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["stay", "service_date"], name="cons_stay_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["service_department", "service_date"], name="cons_dept_date_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["status"], name="cons_status_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["payment_status"], name="cons_payment_status_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["source"], name="cons_source_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["billing_reference"], name="cons_billing_ref_idx"),
        ),
        migrations.AddIndex(
            model_name="clientconsumption",
            index=models.Index(fields=["tenant_code"], name="cons_tenant_code_idx"),
        ),
    ]
