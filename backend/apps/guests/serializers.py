from functools import lru_cache

from django.db import connection
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.billing.models import ClientInvoice, Payment
from apps.bookings.models import Booking, DayUse
from apps.consumptions.models import ClientConsumption
from apps.guests.models import Guest
from apps.history.services import build_client_timeline_payload
from apps.satisfaction.models import ClientSatisfaction
from apps.guests.validators import (
    build_duplicate_warnings,
    normalize_email_value,
    normalize_phone,
    normalize_text,
    normalize_upper_text,
    parse_date_value,
    validate_email_field,
    validate_guest_dates,
)
from apps.stays.models import Stay


def coerce_bool(value, default):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def valid_choice_values(choices):
    return {value for value, _label in choices}


@lru_cache(maxsize=1)
def consumptions_table_is_available():
    return "consumptions_clientconsumption" in connection.introspection.table_names()


@lru_cache(maxsize=1)
def invoices_table_is_available():
    return "billing_clientinvoice" in connection.introspection.table_names()


@lru_cache(maxsize=1)
def satisfactions_table_is_available():
    return "satisfaction_clientsatisfaction" in connection.introspection.table_names()


def get_consumption_count(instance):
    if not consumptions_table_is_available():
        return 0
    return instance.consumptions.count()


class ClientSerializer:
    @staticmethod
    def serialize(instance):
        return {
            "id": instance.id,
            "hotel_id": instance.hotel_id,
            "client_code": instance.client_code or "",
            "first_name": instance.first_name,
            "middle_name": "",
            "last_name": instance.last_name,
            "full_name": instance.full_name,
            "gender": instance.gender or "",
            "gender_label": instance.get_gender_display() if instance.gender else "-",
            "client_type": instance.client_type,
            "client_type_label": instance.get_client_type_display(),
            "client_status": instance.client_status,
            "marital_status": instance.marital_status or "",
            "marital_status_label": instance.get_marital_status_display() if instance.marital_status else "-",
            "date_of_birth": instance.date_of_birth.isoformat() if instance.date_of_birth else "",
            "place_of_birth": instance.place_of_birth or "-",
            "profession": instance.profession or "-",
            "phone": instance.phone or "-",
            "secondary_phone": instance.secondary_phone or "-",
            "email": instance.email or "-",
            "address": instance.address or "-",
            "city": instance.city or "-",
            "nationality": instance.display_nationality or "-",
            "identity_document_type": instance.identity_document_type,
            "identity_document_type_label": instance.get_identity_document_type_display()
            if instance.identity_document_type
            else "-",
            "document_type": instance.identity_document_type,
            "document_type_label": instance.get_identity_document_type_display() if instance.identity_document_type else "-",
            "identity_document_number": instance.identity_document_number or "-",
            "document_number": instance.identity_document_number or "-",
            "document_issue_date": instance.document_issue_date.isoformat() if instance.document_issue_date else "",
            "document_expiry_date": instance.document_expiry_date.isoformat() if instance.document_expiry_date else "",
            "document_issue_place": instance.document_issue_place or "-",
            "emergency_contact_name": instance.emergency_contact_name or "-",
            "emergency_contact_phone": instance.emergency_contact_phone or "-",
            "emergency_contact_relationship": instance.emergency_contact_relationship or "-",
            "notes": instance.notes or "",
            "is_blacklisted": instance.is_blacklisted,
            "is_active": instance.is_active,
            "booking_count": getattr(instance, "booking_count", instance.bookings.count()),
            "stay_count": getattr(instance, "stay_count", instance.stays.count()),
            "day_use_count": getattr(instance, "day_use_count", instance.day_uses.count()),
            "consumption_count": getattr(instance, "consumption_count", get_consumption_count(instance)),
            "satisfaction_count": getattr(
                instance,
                "satisfaction_count",
                instance.satisfactions.count() if satisfactions_table_is_available() else 0,
            ),
            "created_at": timezone.localtime(instance.created_at).isoformat(),
            "updated_at": timezone.localtime(instance.updated_at).isoformat(),
        }

    @staticmethod
    def validate(payload, instance=None):
        errors = {}
        hotel = payload.get("hotel") or getattr(instance, "hotel", None)

        first_name = normalize_text(payload.get("first_name"))
        last_name = normalize_text(payload.get("last_name"))
        gender = normalize_text(payload.get("gender"))
        client_type = normalize_text(payload.get("client_type")) or Guest.ClientType.INDIVIDUAL
        marital_status = normalize_text(payload.get("marital_status"))
        date_of_birth = parse_date_value(payload.get("date_of_birth"), "date_of_birth", errors)
        place_of_birth = normalize_text(payload.get("place_of_birth"))
        profession = normalize_text(payload.get("profession"))
        phone = normalize_phone(payload.get("phone"))
        secondary_phone = normalize_phone(payload.get("secondary_phone"))
        email = normalize_email_value(payload.get("email"))
        address = normalize_text(payload.get("address"))
        city = normalize_text(payload.get("city"))
        nationality = normalize_text(payload.get("nationality"))
        identity_document_type = normalize_text(payload.get("identity_document_type") or payload.get("document_type"))
        identity_document_number = normalize_upper_text(
            payload.get("identity_document_number") or payload.get("document_number")
        )
        document_issue_date = parse_date_value(payload.get("document_issue_date"), "document_issue_date", errors)
        document_expiry_date = parse_date_value(payload.get("document_expiry_date"), "document_expiry_date", errors)
        document_issue_place = normalize_text(payload.get("document_issue_place"))
        emergency_contact_name = normalize_text(payload.get("emergency_contact_name"))
        emergency_contact_phone = normalize_phone(payload.get("emergency_contact_phone"))
        emergency_contact_relationship = normalize_text(payload.get("emergency_contact_relationship"))
        notes = normalize_text(payload.get("notes"))
        is_active = coerce_bool(payload.get("is_active"), getattr(instance, "is_active", True))
        is_blacklisted = coerce_bool(payload.get("is_blacklisted"), getattr(instance, "is_blacklisted", False))

        if not first_name:
            errors["first_name"] = ["Le prenom est obligatoire."]
        if not last_name:
            errors["last_name"] = ["Le nom est obligatoire."]
        if gender and gender not in valid_choice_values(Guest.Gender.choices):
            errors["gender"] = ["Genre invalide."]
        if client_type and client_type not in valid_choice_values(Guest.ClientType.choices):
            errors["client_type"] = ["Type de client invalide."]
        if marital_status and marital_status not in valid_choice_values(Guest.MaritalStatus.choices):
            errors["marital_status"] = ["Situation matrimoniale invalide."]
        if identity_document_type and identity_document_type not in valid_choice_values(Guest.IdentityDocumentType.choices):
            errors["identity_document_type"] = ["Type de piece invalide."]

        if not any([phone, secondary_phone, email, identity_document_number]):
            errors["phone"] = [
                "Renseigne au moins un telephone, un email ou un numero de piece pour fiabiliser la fiche client."
            ]

        if secondary_phone and secondary_phone == phone:
            errors["secondary_phone"] = ["Le telephone secondaire doit etre different du telephone principal."]

        if identity_document_number and not identity_document_type:
            errors["identity_document_type"] = ["Le type de piece est obligatoire lorsque le numero est renseigne."]

        validate_email_field(email, errors)
        validate_guest_dates(
            date_of_birth=date_of_birth,
            document_issue_date=document_issue_date,
            document_expiry_date=document_expiry_date,
            errors=errors,
        )

        duplicate_queryset = Guest.objects.all()
        if hotel is not None:
            duplicate_queryset = duplicate_queryset.filter(hotel=hotel)
        if instance is not None:
            duplicate_queryset = duplicate_queryset.exclude(pk=instance.pk)

        if phone and duplicate_queryset.filter(Q(phone=phone) | Q(secondary_phone=phone)).exists():
            errors["phone"] = ["Un client existe deja avec ce telephone."]

        if secondary_phone and duplicate_queryset.filter(
            Q(phone=secondary_phone) | Q(secondary_phone=secondary_phone)
        ).exists():
            errors["secondary_phone"] = ["Ce telephone secondaire est deja utilise sur une autre fiche client."]

        if email and duplicate_queryset.filter(email__iexact=email).exists():
            errors["email"] = ["Un client existe deja avec cet email."]

        if identity_document_type and identity_document_number:
            if duplicate_queryset.filter(
                identity_document_type=identity_document_type,
                identity_document_number=identity_document_number,
            ).exists():
                errors["identity_document_number"] = ["Un client existe deja avec cette piece d'identite."]

        if errors:
            return {"errors": errors}

        duplicate_warnings = build_duplicate_warnings(
            instance=instance,
            hotel=hotel,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            secondary_phone=secondary_phone,
            email=email,
            document_number=identity_document_number,
            date_of_birth=date_of_birth,
        )

        return {
            "data": {
                "first_name": first_name,
                "last_name": last_name,
                "gender": gender,
                "client_type": client_type,
                "marital_status": marital_status,
                "date_of_birth": date_of_birth,
                "place_of_birth": place_of_birth,
                "profession": profession,
                "phone": phone,
                "secondary_phone": secondary_phone,
                "email": email,
                "address": address,
                "city": city,
                "nationality": nationality,
                "identity_document_type": identity_document_type,
                "identity_document_number": identity_document_number,
                "document_issue_date": document_issue_date,
                "document_expiry_date": document_expiry_date,
                "document_issue_place": document_issue_place,
                "emergency_contact_name": emergency_contact_name,
                "emergency_contact_phone": emergency_contact_phone,
                "emergency_contact_relationship": emergency_contact_relationship,
                "notes": notes,
                "is_active": is_active,
                "is_blacklisted": is_blacklisted,
                "hotel": hotel,
            },
            "warnings": duplicate_warnings,
        }

    @staticmethod
    def save(validated_data, instance=None):
        guest = instance or Guest()
        for field, value in validated_data.items():
            setattr(guest, field, value)
        guest.save()
        return guest


class ClientDetailSerializer:
    @staticmethod
    def _serialize_payment(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "payment_reference": item.reference,
            "status": item.get_status_display(),
            "status_code": item.status,
            "payment_type": item.get_payment_type_display(),
            "payment_type_code": item.payment_type,
            "method": item.get_method_display(),
            "method_code": item.method,
            "amount": f"{item.amount:.2f}",
            "paid_at": timezone.localtime(item.paid_at).isoformat() if item.paid_at else "",
            "stay_reference": item.stay.reference if item.stay_id else "",
            "invoice_reference": item.invoice.reference if item.invoice_id else "",
            "reservation_reference": item.booking.reference if item.booking_id else "",
            "external_reference": item.external_reference or "",
            "currency": item.currency,
            "notes": item.notes or "",
            "source": item.source or "",
        }

    @staticmethod
    def _serialize_consumption(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "label": item.label,
            "description": item.description or "",
            "service": item.service_department.name,
            "service_code": item.service_department.code,
            "status": item.get_status_display(),
            "status_code": item.status,
            "payment_status": item.get_payment_status_display(),
            "payment_status_code": item.payment_status,
            "quantity": f"{item.quantity:.2f}",
            "unit_price": f"{item.unit_price:.2f}",
            "total_amount": f"{item.total_amount:.2f}",
            "consumed_at": timezone.localtime(item.service_date).isoformat() if item.service_date else "",
            "stay_reference": item.stay.reference if item.stay_id else "",
            "reservation_reference": item.reservation.reference if getattr(item, "reservation_id", None) else "",
            "room": item.room.number if getattr(item, "room_id", None) else "",
            "source": item.get_source_display(),
            "notes": item.notes or "",
            "is_billed": item.is_billed,
            "is_paid": item.is_paid,
        }

    @staticmethod
    def _serialize_invoice(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "invoice_number": item.reference,
            "status": item.get_status_display(),
            "status_code": item.status,
            "issued_at": timezone.localtime(item.issued_at).isoformat() if item.issued_at else "",
            "due_date": item.due_date.isoformat() if item.due_date else "",
            "subtotal_amount": f"{item.subtotal_amount:.2f}",
            "discount_amount": f"{item.discount_amount:.2f}",
            "tax_amount": f"{item.tax_amount:.2f}",
            "total_amount": f"{item.total_amount:.2f}",
            "amount_paid": f"{item.amount_paid:.2f}",
            "balance_due": f"{item.balance_due:.2f}",
            "currency": item.currency,
            "stay_reference": item.stay.reference if item.stay_id else "",
            "reservation_reference": item.reservation.reference if item.reservation_id else "",
            "item_count": item.items.count(),
            "notes": item.notes or "",
            "detail_path": f"/api/billing/client-invoices/{item.id}/",
        }

    @staticmethod
    def _serialize_satisfaction(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "overall_rating": item.overall_rating,
            "satisfaction_level": item.get_satisfaction_level_display() if item.satisfaction_level else "-",
            "satisfaction_level_code": item.satisfaction_level or "",
            "recommendation_score": item.recommendation_score,
            "would_recommend": item.would_recommend,
            "reception_rating": item.reception_rating,
            "room_rating": item.room_rating,
            "cleanliness_rating": item.cleanliness_rating,
            "restaurant_rating": item.restaurant_rating,
            "bar_rating": item.bar_rating,
            "pool_rating": item.pool_rating,
            "spa_rating": item.spa_rating,
            "laundry_rating": item.laundry_rating,
            "positive_points": item.positive_points or "",
            "negative_points": item.negative_points or "",
            "suggestions": item.suggestions or "",
            "notes": item.notes or "",
            "submitted_at": timezone.localtime(item.submitted_at).isoformat() if item.submitted_at else "",
            "status": item.get_status_display(),
            "status_code": item.status,
            "source": item.get_source_display(),
            "source_code": item.source,
            "stay_reference": item.stay.reference if item.stay_id else "",
            "consumption_reference": item.consumption.reference if item.consumption_id else "",
        }

    @staticmethod
    def _serialize_booking(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "status": item.get_status_display(),
            "room_type": item.room_type.name,
            "room": item.room.number if item.room else "-",
            "check_in_date": item.check_in_date.isoformat(),
            "check_out_date": item.check_out_date.isoformat(),
            "estimated_amount": f"{item.estimated_amount:.2f}",
            "created_at": timezone.localtime(item.created_at).isoformat(),
        }

    @staticmethod
    def _serialize_stay(item):
        paid_total = item.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount"))["total"] or 0
        consumption_total = 0
        consumption_count = 0
        invoice_total = 0
        invoice_count = 0
        if consumptions_table_is_available():
            consumption_count = item.consumptions.exclude(status=ClientConsumption.Status.CANCELLED).count()
            consumption_total = (
                item.consumptions.exclude(status=ClientConsumption.Status.CANCELLED).aggregate(total=Sum("total_amount"))["total"]
                or 0
            )
        if invoices_table_is_available():
            invoice_count = item.invoices.exclude(status=ClientInvoice.Status.CANCELLED).count()
            invoice_total = (
                item.invoices.exclude(status=ClientInvoice.Status.CANCELLED).aggregate(total=Sum("total_amount"))["total"]
                or 0
            )
        return {
            "id": item.id,
            "reference": item.reference,
            "status": item.get_status_display(),
            "status_code": item.status,
            "source": item.get_source_display(),
            "room": item.room.number,
            "room_type": item.room.room_type.name,
            "booking_reference": item.booking.reference if item.booking_id else "",
            "planned_check_in": timezone.localtime(item.planned_check_in).isoformat() if item.planned_check_in else "",
            "check_in_at": timezone.localtime(item.check_in_at).isoformat(),
            "actual_check_in": timezone.localtime(item.actual_check_in).isoformat() if item.actual_check_in else "",
            "planned_check_out": timezone.localtime(item.planned_check_out).isoformat() if item.planned_check_out else "",
            "check_out_at": timezone.localtime(item.check_out_at).isoformat() if item.check_out_at else "",
            "actual_check_out": timezone.localtime(item.actual_check_out).isoformat() if item.actual_check_out else "",
            "expected_check_out_date": item.expected_check_out_date.isoformat() if item.expected_check_out_date else "",
            "number_of_guests": item.number_of_guests,
            "adults_count": item.adults_count,
            "children_count": item.children_count,
            "purpose_of_stay": item.purpose_of_stay or "",
            "special_requests": item.special_requests or "",
            "notes": item.notes or "",
            "payment_count": item.payments.count(),
            "payment_total": f"{paid_total:.2f}",
            "consumption_count": consumption_count,
            "consumption_total": f"{consumption_total:.2f}",
            "invoice_count": invoice_count,
            "invoice_total": f"{invoice_total:.2f}",
            "detail_path": f"/operations/stays/{item.id}",
        }

    @staticmethod
    def _serialize_day_use(item):
        return {
            "id": item.id,
            "reference": item.reference,
            "status": item.get_status_display(),
            "room": item.room.number,
            "planned_entry_at": timezone.localtime(item.planned_entry_at).isoformat(),
            "check_in_at": timezone.localtime(item.check_in_at).isoformat() if item.check_in_at else "",
            "check_out_at": timezone.localtime(item.check_out_at).isoformat() if item.check_out_at else "",
            "total_amount": f"{item.total_amount:.2f}",
        }

    @classmethod
    def serialize_profile(cls, instance, *, include_sensitive=True, include_financial=True, include_satisfaction=True):
        payload = ClientSerializer.serialize(instance)
        if not include_sensitive:
            payload.update(
                {
                    "email": "-",
                    "identity_document_number": "-",
                    "document_number": "-",
                    "notes": "",
                }
            )

        payment_queryset = Payment.objects.filter(client=instance)
        invoice_queryset = ClientInvoice.objects.none()
        consumption_queryset = ClientConsumption.objects.none()
        satisfaction_queryset = ClientSatisfaction.objects.none()

        if include_financial and invoices_table_is_available():
            invoice_queryset = instance.invoices.all()
        if include_financial and consumptions_table_is_available():
            consumption_queryset = instance.consumptions.all()
        if include_satisfaction and satisfactions_table_is_available():
            satisfaction_queryset = instance.satisfactions.all()

        payload.update(
            {
                "summary": [
                    {"label": "Reservations", "value": instance.bookings.count()},
                    {"label": "Sejours", "value": instance.stays.count()},
                    {"label": "Day use", "value": instance.day_uses.count()},
                    {
                        "label": "Paiements",
                        "value": payment_queryset.exclude(status=Payment.Status.CANCELLED).count()
                        if include_financial
                        else 0,
                    },
                    {
                        "label": "Consommations",
                        "value": consumption_queryset.exclude(status=ClientConsumption.Status.CANCELLED).count()
                        if include_financial and consumptions_table_is_available()
                        else 0,
                    },
                    {
                        "label": "Factures",
                        "value": invoice_queryset.exclude(status=ClientInvoice.Status.CANCELLED).count()
                        if include_financial and invoices_table_is_available()
                        else 0,
                    },
                    {
                        "label": "Avis satisfaction",
                        "value": satisfaction_queryset.count()
                        if include_satisfaction and satisfactions_table_is_available()
                        else 0,
                    },
                ],
                "permissions": {
                    "sensitive": include_sensitive,
                    "financial": include_financial,
                    "satisfaction": include_satisfaction,
                },
            }
        )
        return payload

    @classmethod
    def serialize(cls, instance, *, include_related=True, include_sensitive=True, include_financial=True, include_satisfaction=True):
        if not include_related:
            payload = cls.serialize_profile(
                instance,
                include_sensitive=include_sensitive,
                include_financial=include_financial,
                include_satisfaction=include_satisfaction,
            )
            payload.update(
                {
                    "stay_portfolio": {},
                    "consumption_portfolio": {},
                    "payment_portfolio": {},
                    "invoice_portfolio": {},
                    "satisfaction_portfolio": {},
                    "timeline_portfolio": {},
                    "booking_history": [],
                    "stay_history": [],
                    "day_use_history": [],
                    "timeline_history": [],
                    "payment_history": [],
                    "consumption_history": [],
                    "invoice_history": [],
                    "satisfaction_history": [],
                }
            )
            return payload

        bookings = instance.bookings.select_related("room", "room_type").order_by("-created_at")[:10]
        stays = instance.stays.select_related("room").order_by("-check_in_at")[:10]
        day_uses = instance.day_uses.select_related("room").order_by("-created_at")[:10]
        timeline_payload = build_client_timeline_payload(instance, page=1, page_size=20)
        payment_queryset = (
            Payment.objects.filter(client=instance)
            .select_related("stay", "booking", "invoice", "recorded_by")
            .order_by("-paid_at", "-id")
        )
        consumption_queryset = ClientConsumption.objects.none()
        invoice_queryset = ClientInvoice.objects.none()
        satisfaction_queryset = ClientSatisfaction.objects.none()
        if consumptions_table_is_available():
            consumption_queryset = (
                instance.consumptions.select_related("service_department", "stay", "reservation", "room")
                .order_by("-service_date", "-id")
            )
        if invoices_table_is_available():
            invoice_queryset = (
                instance.invoices.select_related("stay", "reservation", "issued_by")
                .prefetch_related("items", "payments")
                .order_by("-issued_at", "-id")
            )
        if satisfactions_table_is_available():
            satisfaction_queryset = (
                instance.satisfactions.select_related("stay", "consumption", "recorded_by")
                .order_by("-submitted_at", "-id")
            )

        payload = cls.serialize_profile(
            instance,
            include_sensitive=include_sensitive,
            include_financial=include_financial,
            include_satisfaction=include_satisfaction,
        )
        payload.update(
            {
                "stay_portfolio": {
                    "active_count": instance.stays.filter(status=Stay.Status.IN_PROGRESS).count(),
                    "completed_count": instance.stays.filter(status=Stay.Status.COMPLETED).count(),
                    "cancelled_count": instance.stays.filter(status=Stay.Status.CANCELLED).count(),
                    "total_count": instance.stays.count(),
                    "payments_total": f"{(Payment.objects.filter(stay__guest=instance, status=Payment.Status.PAID).aggregate(total=Sum('amount'))['total'] or 0):.2f}",
                    "consumptions_total": f"{(ClientConsumption.objects.filter(client=instance).exclude(status=ClientConsumption.Status.CANCELLED).aggregate(total=Sum('total_amount'))['total'] or 0):.2f}"
                    if consumptions_table_is_available()
                    else "0.00",
                },
                "consumption_portfolio": {
                    "total_count": consumption_queryset.exclude(status=ClientConsumption.Status.CANCELLED).count()
                    if consumptions_table_is_available()
                    else 0,
                    "draft_count": consumption_queryset.filter(status=ClientConsumption.Status.DRAFT).count()
                    if consumptions_table_is_available()
                    else 0,
                    "posted_count": consumption_queryset.filter(status=ClientConsumption.Status.POSTED).count()
                    if consumptions_table_is_available()
                    else 0,
                    "billed_count": consumption_queryset.filter(status=ClientConsumption.Status.BILLED).count()
                    if consumptions_table_is_available()
                    else 0,
                    "paid_count": consumption_queryset.filter(payment_status=ClientConsumption.PaymentStatus.PAID).count()
                    if consumptions_table_is_available()
                    else 0,
                    "total_amount": f"{(consumption_queryset.exclude(status=ClientConsumption.Status.CANCELLED).aggregate(total=Sum('total_amount'))['total'] or 0):.2f}"
                    if consumptions_table_is_available()
                    else "0.00",
                    "by_service": list(
                        consumption_queryset.exclude(status=ClientConsumption.Status.CANCELLED)
                        .values("service_department__name", "service_department__code")
                        .annotate(total_amount=Sum("total_amount"), count=Count("id"))
                        .order_by("service_department__name")
                    )
                    if consumptions_table_is_available()
                    else [],
                },
                "payment_portfolio": {
                    "total_count": payment_queryset.exclude(status=Payment.Status.CANCELLED).count(),
                    "pending_count": payment_queryset.filter(status=Payment.Status.PENDING).count(),
                    "confirmed_count": payment_queryset.filter(status=Payment.Status.PAID).count(),
                    "cancelled_count": payment_queryset.filter(status=Payment.Status.CANCELLED).count(),
                    "refunded_count": payment_queryset.filter(status=Payment.Status.REFUNDED).count(),
                    "confirmed_amount": f"{(payment_queryset.filter(status=Payment.Status.PAID).aggregate(total=Sum('amount'))['total'] or 0):.2f}",
                    "pending_amount": f"{(payment_queryset.filter(status=Payment.Status.PENDING).aggregate(total=Sum('amount'))['total'] or 0):.2f}",
                    "by_method": list(
                        payment_queryset.exclude(status=Payment.Status.CANCELLED)
                        .values("method")
                        .annotate(total_amount=Sum("amount"), count=Count("id"))
                        .order_by("method")
                    ),
                },
                "invoice_portfolio": {
                    "total_count": invoice_queryset.exclude(status=ClientInvoice.Status.CANCELLED).count()
                    if invoices_table_is_available()
                    else 0,
                    "draft_count": invoice_queryset.filter(status=ClientInvoice.Status.DRAFT).count()
                    if invoices_table_is_available()
                    else 0,
                    "issued_count": invoice_queryset.filter(status=ClientInvoice.Status.ISSUED).count()
                    if invoices_table_is_available()
                    else 0,
                    "partially_paid_count": invoice_queryset.filter(status=ClientInvoice.Status.PARTIALLY_PAID).count()
                    if invoices_table_is_available()
                    else 0,
                    "paid_count": invoice_queryset.filter(status=ClientInvoice.Status.PAID).count()
                    if invoices_table_is_available()
                    else 0,
                    "total_amount": f"{(invoice_queryset.exclude(status=ClientInvoice.Status.CANCELLED).aggregate(total=Sum('total_amount'))['total'] or 0):.2f}"
                    if invoices_table_is_available()
                    else "0.00",
                    "balance_due": f"{(invoice_queryset.exclude(status=ClientInvoice.Status.CANCELLED).aggregate(total=Sum('balance_due'))['total'] or 0):.2f}"
                    if invoices_table_is_available()
                    else "0.00",
                },
                "satisfaction_portfolio": {
                    "total_count": satisfaction_queryset.count() if satisfactions_table_is_available() else 0,
                    "average_overall_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("overall_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_recommendation_score": round(
                        satisfaction_queryset.aggregate(total=Avg("recommendation_score"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "would_recommend_count": satisfaction_queryset.filter(would_recommend=True).count()
                    if satisfactions_table_is_available()
                    else 0,
                    "dissatisfied_count": satisfaction_queryset.filter(
                        satisfaction_level__in=[
                            ClientSatisfaction.SatisfactionLevel.DISSATISFIED,
                            ClientSatisfaction.SatisfactionLevel.VERY_DISSATISFIED,
                        ]
                    ).count()
                    if satisfactions_table_is_available()
                    else 0,
                    "neutral_count": satisfaction_queryset.filter(
                        satisfaction_level=ClientSatisfaction.SatisfactionLevel.NEUTRAL
                    ).count()
                    if satisfactions_table_is_available()
                    else 0,
                    "satisfied_count": satisfaction_queryset.filter(
                        satisfaction_level__in=[
                            ClientSatisfaction.SatisfactionLevel.SATISFIED,
                            ClientSatisfaction.SatisfactionLevel.VERY_SATISFIED,
                        ]
                    ).count()
                    if satisfactions_table_is_available()
                    else 0,
                    "average_reception_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("reception_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_room_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("room_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_cleanliness_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("cleanliness_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_restaurant_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("restaurant_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_bar_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("bar_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_pool_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("pool_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_spa_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("spa_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "average_laundry_rating": round(
                        satisfaction_queryset.aggregate(total=Avg("laundry_rating"))["total"] or 0, 2
                    )
                    if satisfactions_table_is_available()
                    else 0,
                    "latest_feedback": cls._serialize_satisfaction(satisfaction_queryset.first())
                    if satisfactions_table_is_available() and satisfaction_queryset.exists()
                    else None,
                    "by_level": list(
                        satisfaction_queryset.values("satisfaction_level").annotate(count=Count("id")).order_by("satisfaction_level")
                    )
                    if satisfactions_table_is_available()
                    else [],
                },
                "timeline_portfolio": timeline_payload["summary"],
                "booking_history": [cls._serialize_booking(item) for item in bookings],
                "stay_history": [cls._serialize_stay(item) for item in stays],
                "day_use_history": [cls._serialize_day_use(item) for item in day_uses],
                "timeline_history": timeline_payload["results"],
                "payment_history": [cls._serialize_payment(item) for item in payment_queryset[:12]],
                "consumption_history": [cls._serialize_consumption(item) for item in consumption_queryset[:12]]
                if consumptions_table_is_available()
                else [],
                "invoice_history": [cls._serialize_invoice(item) for item in invoice_queryset[:12]]
                if invoices_table_is_available()
                else [],
                "satisfaction_history": [cls._serialize_satisfaction(item) for item in satisfaction_queryset[:12]]
                if satisfactions_table_is_available()
                else [],
            }
        )
        return payload


def search_clients(queryset, search):
    term = normalize_text(search)
    if not term:
        return queryset

    return queryset.filter(
        Q(client_code__icontains=term)
        | Q(first_name__icontains=term)
        | Q(last_name__icontains=term)
        | Q(phone__icontains=term)
        | Q(secondary_phone__icontains=term)
        | Q(email__icontains=term)
        | Q(identity_document_number__icontains=term)
        | Q(nationality__icontains=term)
    )
