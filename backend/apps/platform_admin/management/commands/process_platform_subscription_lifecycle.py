from django.core.management.base import BaseCommand

from apps.licensing.services.subscription_service import SubscriptionService


class Command(BaseCommand):
    help = "Traite les echeances d'abonnements plateforme: suspension automatique et expiration des essais."

    def handle(self, *args, **options):
        result = SubscriptionService.process_lifecycle()
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Cycle plateforme execute: "
                    f"{result['suspended_count']} abonnement(s) suspendu(s), "
                    f"{result['expired_count']} essai(s) expire(s)."
                )
            )
        )
