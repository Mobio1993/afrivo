from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from apps.users.models import User


@receiver(post_migrate)
def create_default_groups(sender, **kwargs):
    if sender.name != "apps.users":
        return

    Group.objects.get_or_create(name=User.Role.ADMIN)
    Group.objects.get_or_create(name=User.Role.RECEPTION)


@receiver(post_save, sender=User)
def sync_user_group(sender, instance, **kwargs):
    group, _ = Group.objects.get_or_create(name=instance.role)
    instance.groups.set([group])
