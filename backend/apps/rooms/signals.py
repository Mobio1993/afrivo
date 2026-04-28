from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from apps.rooms.models import Room, RoomHousekeepingTask, RoomMaintenanceIncident, RoomRateRule, RoomType
from apps.users.models import User


@receiver(post_migrate)
def sync_room_permissions(sender, **kwargs):
    if sender.name != "apps.rooms":
        return

    admin_group, _ = Group.objects.get_or_create(name=User.Role.ADMIN)
    manager_group, _ = Group.objects.get_or_create(name=User.Role.MANAGER)
    reception_group, _ = Group.objects.get_or_create(name=User.Role.RECEPTION)
    housekeeping_group, _ = Group.objects.get_or_create(name=User.Role.HOUSEKEEPING)

    content_types = [
        ContentType.objects.get_for_model(RoomType),
        ContentType.objects.get_for_model(Room),
        ContentType.objects.get_for_model(RoomRateRule),
        ContentType.objects.get_for_model(RoomHousekeepingTask),
        ContentType.objects.get_for_model(RoomMaintenanceIncident),
    ]

    permissions = Permission.objects.filter(content_type__in=content_types)
    housekeeping_permissions = Permission.objects.filter(
        content_type__in=[
            ContentType.objects.get_for_model(RoomHousekeepingTask),
            ContentType.objects.get_for_model(RoomMaintenanceIncident),
        ]
    )

    admin_group.permissions.add(*permissions)
    manager_group.permissions.add(*permissions)
    reception_group.permissions.remove(*permissions)
    housekeeping_group.permissions.remove(*permissions)
    housekeeping_group.permissions.add(*housekeeping_permissions)
