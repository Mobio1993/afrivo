from django.core.management.base import BaseCommand

from apps.platform_admin.services import process_subscription_lifecycle


class Command(BaseCommand):
    help = "Traite les echeances d'abonnements plateforme: suspension automatique et expiration des essais."

    def handle(self, *args, **options):
        result = process_subscription_lifecycle()
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Cycle plateforme execute: "
                    f"{result['suspended_count']} abonnement(s) suspendu(s), "
                    f"{result['expired_count']} essai(s) expire(s)."
                )
            )
        )
