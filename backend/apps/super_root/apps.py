from django.apps import AppConfig


class SuperRootConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.super_root"
    verbose_name = "Super Root"

    def ready(self):
        from apps.super_root import signals  # noqa: F401
