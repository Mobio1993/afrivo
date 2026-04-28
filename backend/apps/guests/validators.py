from datetime import date

from django.core.validators import validate_email
from django.db.models import Q

from apps.guests.models import Guest


def normalize_phone(value):
    raw = (value or "").strip()
    if not raw:
        return ""

    has_plus = raw.startswith("+")
    digits = "".join(character for character in raw if character.isdigit())
    if not digits:
        return ""
    return f"+{digits}" if has_plus else digits


def normalize_text(value):
    return (value or "").strip()


def normalize_upper_text(value):
    return normalize_text(value).upper()


def normalize_email_value(value):
    return normalize_text(value).lower()


def parse_date_value(value, field_name, errors):
    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        errors[field_name] = ["Date invalide."]
        return None


def validate_guest_dates(*, date_of_birth, document_issue_date, document_expiry_date, errors):
    today = date.today()

    if date_of_birth and date_of_birth > today:
        errors.setdefault("date_of_birth", []).append("La date de naissance ne peut pas etre dans le futur.")

    if document_issue_date and document_issue_date > today:
        errors.setdefault("document_issue_date", []).append(
            "La date d'emission du document ne peut pas etre dans le futur."
        )

    if document_issue_date and document_expiry_date and document_expiry_date <= document_issue_date:
        errors.setdefault("document_expiry_date", []).append(
            "La date d'expiration doit etre posterieure a la date d'emission."
        )


def validate_email_field(email, errors):
    if not email:
        return

    try:
        validate_email(email)
    except Exception:
        errors.setdefault("email", []).append("Adresse email invalide.")


def build_duplicate_warnings(*, instance, first_name, last_name, phone, secondary_phone, email, document_number, date_of_birth):
    duplicate_queryset = Guest.objects.all()
    if instance is not None:
        duplicate_queryset = duplicate_queryset.exclude(pk=instance.pk)

    duplicate_filter = Q()
    if phone:
        duplicate_filter |= Q(phone=phone)
    if secondary_phone:
        duplicate_filter |= Q(phone=secondary_phone) | Q(secondary_phone=secondary_phone) | Q(secondary_phone=phone)
    if email:
        duplicate_filter |= Q(email__iexact=email)
    if document_number:
        duplicate_filter |= Q(identity_document_number__iexact=document_number)
    if first_name and last_name:
        duplicate_filter |= Q(first_name__iexact=first_name, last_name__iexact=last_name)
        if date_of_birth:
            duplicate_filter |= Q(
                first_name__iexact=first_name,
                last_name__iexact=last_name,
                date_of_birth=date_of_birth,
            )

    if duplicate_filter == Q():
        return []

    candidates = list(
        duplicate_queryset.filter(duplicate_filter)
        .order_by("last_name", "first_name", "-id")
        .distinct()[:5]
    )

    warnings = []
    for candidate in candidates:
        reasons = []
        if phone and candidate.phone == phone:
            reasons.append("telephone principal identique")
        if secondary_phone and {candidate.phone, getattr(candidate, "secondary_phone", "")} & {phone, secondary_phone}:
            reasons.append("numero de telephone deja present")
        if email and candidate.email.lower() == email:
            reasons.append("email identique")
        if document_number and candidate.identity_document_number.upper() == document_number:
            reasons.append("numero de piece identique")
        if (
            first_name
            and last_name
            and candidate.first_name.lower() == first_name.lower()
            and candidate.last_name.lower() == last_name.lower()
        ):
            reasons.append("nom et prenom similaires")
        if date_of_birth and candidate.date_of_birth == date_of_birth:
            reasons.append("date de naissance identique")

        warnings.append(
            {
                "id": candidate.id,
                "full_name": candidate.full_name,
                "phone": candidate.phone or "-",
                "email": candidate.email or "-",
                "identity_document_number": candidate.identity_document_number or "-",
                "reasons": reasons or ["profil proche d'une fiche existante"],
            }
        )

    return warnings
