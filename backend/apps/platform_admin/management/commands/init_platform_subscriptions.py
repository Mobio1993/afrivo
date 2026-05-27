from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.audit_logs.services import PlatformAuditService
from apps.platform_admin.models import HotelSubscription, PlatformAuditEvent, SubscriptionPlan
from apps.tenancy.models import Hotel


class Command(BaseCommand):
    help = "Initialise les plans et abonnements plateforme manquants pour les hotels existants."

    def add_arguments(self, parser):
        parser.add_argument("--plan-code", default="starter", help="Code du plan par defaut.")
        parser.add_argument("--plan-name", default="Starter", help="Nom du plan par defaut.")
        parser.add_argument("--monthly-price", default="0.00", help="Prix mensuel du plan par defaut.")
        parser.add_argument("--yearly-price", default="0.00", help="Prix annuel du plan par defaut.")
        parser.add_argument("--max-hotels", type=int, default=1, help="Quota hotels du plan par defaut.")
        parser.add_argument("--max-users", type=int, default=5, help="Quota utilisateurs du plan par defaut.")
        parser.add_argument(
            "--status",
            choices=[HotelSubscription.Status.ACTIVE, HotelSubscription.Status.TRIAL, HotelSubscription.Status.DRAFT],
            default=HotelSubscription.Status.ACTIVE,
            help="Statut applique aux abonnements crees.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        plan, plan_created = SubscriptionPlan.objects.get_or_create(
            code=options["plan_code"],
            defaults={
                "name": options["plan_name"],
                "monthly_price": options["monthly_price"],
                "yearly_price": options["yearly_price"],
                "max_hotels": options["max_hotels"],
                "max_users": options["max_users"],
                "is_active": True,
            },
        )

        hotels_without_subscription = Hotel.objects.select_related("organization").filter(subscription__isnull=True)
        created_count = 0
        reference_time = timezone.now()

        for hotel in hotels_without_subscription:
            subscription = HotelSubscription.objects.create(
                organization=hotel.organization,
                hotel=hotel,
                plan=plan,
                status=options["status"],
                starts_at=hotel.created_at or reference_time,
                billing_cycle=HotelSubscription.BillingCycle.MONTHLY,
                notes="Initialisation automatique des abonnements plateforme.",
            )
            PlatformAuditService.log(
                actor=None,
                event_type=PlatformAuditEvent.EventType.SUBSCRIPTION_CREATED,
                target=subscription,
                metadata={
                    "source": "init_platform_subscriptions",
                    "hotel_id": hotel.id,
                    "plan_id": plan.id,
                    "status": subscription.status,
                },
            )
            created_count += 1

        plan_message = "Plan par defaut cree" if plan_created else "Plan par defaut existant"
        self.stdout.write(
            self.style.SUCCESS(
                f"{plan_message}: {plan.code}. {created_count} abonnement(s) cree(s)."
            )
        )
