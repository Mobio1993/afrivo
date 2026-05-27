from getpass import getpass

from django.core.management.base import BaseCommand, CommandError

from apps.users.services import create_hotel_admin_user


class Command(BaseCommand):
    help = "Cree un administrateur metier AFRIVO rattache a une organisation et a un hotel."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Nom d'utilisateur du compte admin.")
        parser.add_argument("--password", help="Mot de passe initial. Si absent, une saisie interactive sera demandee.")
        parser.add_argument("--first-name", default="", help="Prenom du compte admin.")
        parser.add_argument("--last-name", default="", help="Nom du compte admin.")
        parser.add_argument("--email", default="", help="Email du compte admin.")
        parser.add_argument("--phone", default="", help="Telephone du compte admin.")
        parser.add_argument("--organization-id", type=int, help="Identifiant de l'organisation.")
        parser.add_argument("--organization-slug", default="", help="Slug de l'organisation.")
        parser.add_argument("--hotel-id", type=int, help="Identifiant de l'hotel.")
        parser.add_argument("--hotel-code", default="", help="Code de l'hotel.")
        parser.add_argument(
            "--use-default-tenancy",
            action="store_true",
            help="Utilise ou cree l'organisation et l'hotel par defaut. Reserve au bootstrap local/dev.",
        )
        parser.add_argument(
            "--django-superuser",
            dest="django_superuser",
            action="store_true",
            help=(
                "Active aussi is_superuser pour un usage technique Django. "
                "Ne cree pas un administrateur plateforme React."
            ),
        )
        parser.add_argument(
            "--platform-superuser",
            dest="platform_superuser",
            action="store_true",
            help=(
                "Alias historique de --django-superuser. "
                "Deprecated: utilisez create_platform_admin pour la console plateforme."
            ),
        )

    def handle(self, *args, **options):
        password = options["password"] or self._prompt_password()

        try:
            user = create_hotel_admin_user(
                username=options["username"],
                password=password,
                organization_id=options.get("organization_id"),
                organization_slug=options.get("organization_slug", "").strip(),
                hotel_id=options.get("hotel_id"),
                hotel_code=options.get("hotel_code", "").strip(),
                use_default_tenancy=bool(options.get("use_default_tenancy")),
                first_name=options.get("first_name", "").strip(),
                last_name=options.get("last_name", "").strip(),
                email=options.get("email", "").strip(),
                phone=options.get("phone", "").strip(),
                is_superuser=bool(options.get("django_superuser") or options.get("platform_superuser")),
            )
        except Exception as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"Admin AFRIVO cree avec succes: {user.username} "
                    f"(organisation={user.organization.name}, hotel={user.hotel.name}, "
                    f"role={user.role}, superuser={user.is_superuser})"
                )
            )
        )

    def _prompt_password(self):
        password = getpass("Mot de passe: ")
        password_confirm = getpass("Confirmation du mot de passe: ")
        if not password:
            raise CommandError("Le mot de passe est obligatoire.")
        if password != password_confirm:
            raise CommandError("Les mots de passe ne correspondent pas.")
        return password
