from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_add_settings_module_permission"),
    ]

    operations = [
        migrations.AlterField(
            model_name="usermodulepermission",
            name="module_code",
            field=models.CharField(
                choices=[
                    ("dashboard", "Dashboard"),
                    ("clients", "Clients"),
                    ("rooms", "Chambres"),
                    ("operations", "Operations"),
                    ("billing", "Facturation"),
                    ("payments", "Paiements"),
                    ("reports", "Rapports"),
                    ("history", "Journal d'activite"),
                    ("users", "Utilisateurs"),
                    ("settings", "Parametres"),
                    ("satisfaction", "Satisfaction"),
                    ("platform_organizations", "Plateforme organisations"),
                    ("platform_hotels", "Plateforme hotels"),
                    ("platform_subscriptions", "Plateforme abonnements"),
                    ("platform_users", "Plateforme utilisateurs"),
                    ("platform_security", "Plateforme securite"),
                ],
                max_length=30,
                verbose_name="Module",
            ),
        ),
    ]
