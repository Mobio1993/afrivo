from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit_logs.services import PlatformAuditService
from apps.platform_admin.models import PlatformAuditEvent, PlatformLicense, PlatformModule
from apps.tenancy.models import Hotel, Organization


def _create_audit_event(*, event_type, actor=None, target=None, metadata=None):
    return PlatformAuditService.log(
        actor=actor,
        event_type=event_type,
        target=target,
        metadata=metadata or {},
    )


class ModuleLicenseService:
    """Business facade for module licenses and runtime module access."""

    @staticmethod
    def module_queryset():
        return PlatformModule.objects.all()

    @staticmethod
    def active_module_queryset():
        return ModuleLicenseService.module_queryset().filter(is_active=True)

    @staticmethod
    def license_queryset():
        return PlatformLicense.objects.select_related("module", "organization", "hotel")

    @staticmethod
    def list_modules(*, search="", is_active=None):
        queryset = ModuleLicenseService.module_queryset()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)
        return queryset.order_by("name", "code")

    @staticmethod
    def list_licenses(*, module_id=None, organization_id=None, hotel_id=None, status="", search=""):
        queryset = ModuleLicenseService.license_queryset()
        if module_id:
            queryset = queryset.filter(module_id=module_id)
        if organization_id:
            queryset = queryset.filter(organization_id=organization_id)
        if hotel_id:
            queryset = queryset.filter(hotel_id=hotel_id)
        if status:
            queryset = queryset.filter(status=status)
        if search:
            queryset = queryset.filter(
                Q(module__name__icontains=search)
                | Q(module__code__icontains=search)
                | Q(organization__name__icontains=search)
                | Q(hotel__name__icontains=search)
            )
        return queryset.order_by("-updated_at", "-id")

    @staticmethod
    def get_module_by_code(code):
        value = (code or "").strip()
        if not value:
            return None
        return PlatformModule.objects.filter(code__iexact=value).first()

    @staticmethod
    def license_is_active(license_obj, *, now=None):
        if license_obj is None:
            return False
        reference_time = now or timezone.now()
        if license_obj.status != PlatformLicense.Status.ACTIVE:
            return False
        if not getattr(license_obj.module, "is_active", True):
            return False
        if license_obj.starts_at and license_obj.starts_at > reference_time:
            return False
        if license_obj.ends_at and license_obj.ends_at < reference_time:
            return False
        return True

    @staticmethod
    def access_allowed(*, module_code, organization_id=None, hotel_id=None, now=None):
        reference_time = now or timezone.now()
        queryset = (
            ModuleLicenseService.license_queryset()
            .filter(
                module__code=module_code,
                module__is_active=True,
                status=PlatformLicense.Status.ACTIVE,
                starts_at__lte=reference_time,
            )
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=reference_time))
        )

        if hotel_id:
            hotel = Hotel.objects.select_related("organization").filter(pk=hotel_id).first()
            if hotel is None or not hotel.is_active:
                return False
            return queryset.filter(
                Q(hotel_id=hotel_id)
                | Q(organization_id=hotel.organization_id, hotel__isnull=True)
            ).exists()

        if organization_id:
            organization = Organization.objects.filter(pk=organization_id, is_active=True).first()
            if organization is None:
                return False
            return queryset.filter(organization_id=organization_id, hotel__isnull=True).exists()

        return False

    @staticmethod
    @transaction.atomic
    def renew(*, license_obj, ends_at, actor=None, note=""):
        license_obj.ends_at = ends_at
        license_obj.status = PlatformLicense.Status.ACTIVE
        if note:
            license_obj.notes = f"{license_obj.notes}\n{note}".strip()
        license_obj.save(update_fields=["ends_at", "status", "notes", "updated_at"])
        _create_audit_event(
            actor=actor,
            event_type=PlatformAuditEvent.EventType.LICENSE_RENEWED,
            target=license_obj,
            metadata={"module_id": license_obj.module_id, "ends_at": ends_at.isoformat()},
        )
        return license_obj

    @staticmethod
    @transaction.atomic
    def suspend(*, license_obj, actor=None, note=""):
        license_obj.status = PlatformLicense.Status.SUSPENDED
        if note:
            license_obj.notes = f"{license_obj.notes}\n{note}".strip()
        license_obj.save(update_fields=["status", "notes", "updated_at"])
        _create_audit_event(
            actor=actor,
            event_type=PlatformAuditEvent.EventType.LICENSE_SUSPENDED,
            target=license_obj,
            metadata={"module_id": license_obj.module_id},
        )
        return license_obj


module_access_allowed = ModuleLicenseService.access_allowed
platform_module_access_allowed = ModuleLicenseService.access_allowed
renew_platform_license = ModuleLicenseService.renew
suspend_platform_license = ModuleLicenseService.suspend
