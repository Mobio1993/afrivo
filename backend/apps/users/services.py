from django.core.exceptions import ValidationError
from django.db import transaction

from apps.tenancy.models import Hotel, Organization
from apps.tenancy.services import get_or_create_default_tenancy
from apps.users.models import User


def resolve_admin_tenancy(*, organization_id=None, organization_slug="", hotel_id=None, hotel_code="", use_default_tenancy=False):
    if use_default_tenancy:
        return get_or_create_default_tenancy()

    organization = None
    hotel = None

    if organization_id:
        organization = Organization.objects.filter(pk=organization_id).first()
        if organization is None:
            raise ValidationError({"organization": "Organisation introuvable."})
    elif organization_slug:
        organization = Organization.objects.filter(slug=organization_slug).first()
        if organization is None:
            raise ValidationError({"organization": "Organisation introuvable pour ce slug."})

    if hotel_id:
        hotel = Hotel.objects.select_related("organization").filter(pk=hotel_id).first()
        if hotel is None:
            raise ValidationError({"hotel": "Hotel introuvable."})
    elif hotel_code:
        hotel = Hotel.objects.select_related("organization").filter(code=hotel_code).first()
        if hotel is None:
            raise ValidationError({"hotel": "Hotel introuvable pour ce code."})

    if organization is None or hotel is None:
        raise ValidationError(
            {
                "tenancy": (
                    "Le rattachement tenancy est obligatoire. Fournissez organization et hotel, "
                    "ou utilisez explicitement use_default_tenancy."
                )
            }
        )

    if hotel.organization_id != organization.id:
        raise ValidationError({"hotel": "L'hotel selectionne doit appartenir a l'organisation fournie."})

    return organization, hotel


@transaction.atomic
def create_hotel_admin_user(
    *,
    username,
    password,
    organization_id=None,
    organization_slug="",
    hotel_id=None,
    hotel_code="",
    use_default_tenancy=False,
    first_name="",
    last_name="",
    email="",
    phone="",
    is_superuser=False,
):
    if not username:
        raise ValidationError({"username": "Le nom d'utilisateur est obligatoire."})
    if not password:
        raise ValidationError({"password": "Le mot de passe est obligatoire."})
    if User.objects.filter(username=username).exists():
        raise ValidationError({"username": "Ce nom d'utilisateur existe deja."})

    organization, hotel = resolve_admin_tenancy(
        organization_id=organization_id,
        organization_slug=organization_slug,
        hotel_id=hotel_id,
        hotel_code=hotel_code,
        use_default_tenancy=use_default_tenancy,
    )

    user = User(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        role=User.Role.ADMIN,
        is_active=True,
        is_superuser=is_superuser,
        organization=organization,
        hotel=hotel,
    )
    user.set_password(password)
    user.save()
    return user
