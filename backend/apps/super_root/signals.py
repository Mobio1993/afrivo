from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.audit_logs.services import AuditService
from apps.users.models import User
from apps.super_root.services.super_root_guard import is_super_root_mutation_allowed


def _would_be_active_super_root(user):
    return bool(
        getattr(user, "is_superuser", False)
        and not getattr(user, "is_platform_admin", False)
        and getattr(user, "is_active", True)
    )


@receiver(pre_save, sender=User)
def prevent_unvalidated_multiple_super_roots(sender, instance, **kwargs):
    if not _would_be_active_super_root(instance):
        return

    existing = sender.objects.filter(
        is_superuser=True,
        is_platform_admin=False,
        is_active=True,
    )
    if instance.pk:
        existing = existing.exclude(pk=instance.pk)
    if not existing.exists():
        return

    if is_super_root_mutation_allowed():
        return

    if bool(getattr(settings, "ALLOW_SUPER_ROOT_BOOTSTRAP", False)):
        return

    AuditService.log(
        actor=None,
        action="super_root.multiple_creation_blocked",
        target=instance,
        module="super_root_security",
        severity="critical",
        description="Creation ou elevation Super Root bloquee: un Super Root actif existe deja.",
        metadata={
            "target_username": getattr(instance, "username", ""),
            "existing_super_roots": existing.count(),
            "bootstrap_allowed": False,
        },
    )
    raise ValidationError(
        "Un Super Root actif existe deja. Activez temporairement ALLOW_SUPER_ROOT_BOOTSTRAP "
        "et utilisez le flux valide avec MFA et confirmation critique."
    )
