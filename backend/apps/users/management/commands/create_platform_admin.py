from getpass import getpass

from django.core.management.base import BaseCommand, CommandError

from apps.users.services import create_platform_admin_user


class Command(BaseCommand):
    help = "Cree un administrateur plateforme AFRIVO sans rattachement hotel."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Nom d'utilisateur du compte plateforme.")
        parser.add_argument("--password", help="Mot de passe initial. Si absent, une saisie interactive sera demandee.")
        parser.add_argument("--first-name", default="", help="Prenom du compte plateforme.")
        parser.add_argument("--last-name", default="", help="Nom du compte plateforme.")
        parser.add_argument("--email", default="", help="Email du compte plateforme.")
        parser.add_argument("--phone", default="", help="Telephone du compte plateforme.")

    def handle(self, *args, **options):
        password = options["password"] or self._prompt_password()

        try:
            user = create_platform_admin_user(
                username=options["username"].strip(),
                password=password,
                first_name=options.get("first_name", "").strip(),
                last_name=options.get("last_name", "").strip(),
                email=options.get("email", "").strip(),
                phone=options.get("phone", "").strip(),
            )
        except Exception as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                (
                    f"Admin plateforme AFRIVO cree avec succes: {user.username} "
                    f"(platform_admin={user.is_platform_admin}, staff={user.is_staff}, "
                    f"superuser={user.is_superuser})"
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
