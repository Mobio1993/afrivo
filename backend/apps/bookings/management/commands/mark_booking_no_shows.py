from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.bookings.services import mark_overdue_confirmed_bookings_no_show


class Command(BaseCommand):
    help = "Marque automatiquement no-show les reservations confirmees dont la date d'arrivee est depassee."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            dest="reference_date",
            help="Date de reference YYYY-MM-DD. Par defaut: date locale du jour.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Liste les reservations concernees sans les modifier.",
        )

    def handle(self, *args, **options):
        reference_date = None
        if options.get("reference_date"):
            try:
                reference_date = date.fromisoformat(options["reference_date"])
            except ValueError as exc:
                raise CommandError("La date doit etre au format YYYY-MM-DD.") from exc

        result = mark_overdue_confirmed_bookings_no_show(
            reference_date=reference_date,
            dry_run=options["dry_run"],
        )
        mode = "Simulation" if options["dry_run"] else "Rattrapage"
        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"{mode} no-show execute(e): "
                    f"{result['processed_count']} reservation(s) traitee(s), "
                    f"{result['skipped_count']} ignoree(s)."
                )
            )
        )
        if result["references"]:
            self.stdout.write(", ".join(result["references"]))
