from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.billing.models import ClientInvoice, ClientInvoiceItem, Payment
from apps.billing.validators import (
    validate_invoice_can_receive_payment,
    validate_payment_can_be_cancelled,
    validate_payment_can_be_confirmed,
)
from apps.bookings.models import DayUse
from apps.consumptions.models import ClientConsumption
from apps.stays.models import Stay


ACTIVE_INVOICE_STATUSES = [
    ClientInvoice.Status.DRAFT,
    ClientInvoice.Status.ISSUED,
    ClientInvoice.Status.PARTIALLY_PAID,
    ClientInvoice.Status.PAID,
]


def _format_queue_amount(value):
    return f"{value or 0:.2f}"


def get_billing_work_queue(hotel, limit=6):
    if not hotel:
        return {
            "total_count": 0,
            "stays_without_invoice_count": 0,
            "unbilled_consumptions_count": 0,
            "day_uses_to_invoice_count": 0,
            "unpaid_invoices_count": 0,
            "items": [],
        }

    stays_queryset = (
        Stay.objects.select_related("guest", "room")
        .filter(hotel=hotel, status=Stay.Status.COMPLETED)
        .exclude(invoices__status__in=ACTIVE_INVOICE_STATUSES)
        .distinct()
        .order_by("-actual_check_out", "-check_out_at", "-id")
    )
    consumptions_queryset = (
        ClientConsumption.objects.select_related("client", "stay", "service_department", "room")
        .filter(hotel=hotel, status=ClientConsumption.Status.POSTED)
        .order_by("-service_date", "-id")
    )
    day_uses_queryset = (
        DayUse.objects.select_related("guest", "room")
        .filter(hotel=hotel, status=DayUse.Status.COMPLETED, total_amount__gt=0)
        .exclude(invoices__status__in=ACTIVE_INVOICE_STATUSES)
        .distinct()
        .order_by("-check_out_at", "-id")
    )
    unpaid_invoices_queryset = (
        ClientInvoice.objects.select_related("client", "stay__room", "reservation__room", "day_use__room")
        .filter(
            hotel=hotel,
            status__in=[ClientInvoice.Status.ISSUED, ClientInvoice.Status.PARTIALLY_PAID],
            balance_due__gt=0,
        )
        .order_by("due_date", "-issued_at", "-id")
    )

    items = []
    for stay in stays_queryset[:limit]:
        totals = stay.get_financial_totals()
        items.append(
            {
                "id": f"stay-{stay.id}",
                "source_id": stay.id,
                "type": "stay",
                "label": "Sejour termine",
                "reference": stay.reference,
                "client": stay.guest.full_name,
                "room": stay.room.number,
                "amount": _format_queue_amount(totals["total_amount"]),
                "reason": "Aucune facture active rattachee",
                "action_label": "Voir le sejour",
                "action_path": f"/operations/stays/{stay.id}",
                "created_at": (stay.actual_check_out or stay.check_out_at or stay.updated_at).isoformat(),
            }
        )

    remaining_slots = max(limit - len(items), 0)
    for consumption in consumptions_queryset[:remaining_slots]:
        action_path = f"/operations/stays/{consumption.stay_id}" if consumption.stay_id else ""
        items.append(
            {
                "id": f"consumption-{consumption.id}",
                "source_id": consumption.id,
                "type": "consumption",
                "label": "Consommation non facturee",
                "reference": consumption.reference,
                "client": consumption.client.full_name,
                "room": consumption.room.number if consumption.room_id else "-",
                "amount": _format_queue_amount(consumption.total_amount),
                "reason": consumption.service_department.name,
                "action_label": "Voir le sejour" if action_path else "A rattacher",
                "action_path": action_path,
                "created_at": consumption.service_date.isoformat(),
            }
        )

    remaining_slots = max(limit - len(items), 0)
    for day_use in day_uses_queryset[:remaining_slots]:
        items.append(
            {
                "id": f"day-use-{day_use.id}",
                "source_id": day_use.id,
                "type": "day_use",
                "label": "Day use termine",
                "reference": day_use.reference,
                "client": day_use.guest.full_name,
                "room": day_use.room.number,
                "amount": _format_queue_amount(day_use.total_amount),
                "reason": "A regulariser en facturation",
                "action_label": "Voir le day use",
                "action_path": f"/operations/day-uses/{day_use.id}",
                "created_at": (day_use.check_out_at or day_use.updated_at).isoformat(),
            }
        )

    remaining_slots = max(limit - len(items), 0)
    for invoice in unpaid_invoices_queryset[:remaining_slots]:
        room = None
        if invoice.stay_id and invoice.stay.room_id:
            room = invoice.stay.room.number
        elif invoice.reservation_id and invoice.reservation.room_id:
            room = invoice.reservation.room.number
        elif invoice.day_use_id and invoice.day_use.room_id:
            room = invoice.day_use.room.number
        items.append(
            {
                "id": f"invoice-{invoice.id}",
                "source_id": invoice.id,
                "type": "invoice_payment",
                "label": "Facture a encaisser",
                "reference": invoice.reference,
                "client": invoice.client.full_name,
                "room": room or "-",
                "amount": _format_queue_amount(invoice.balance_due),
                "reason": "Solde restant a payer",
                "action_label": "Encaisser",
                "action_path": "",
                "created_at": invoice.issued_at.isoformat(),
            }
        )

    return {
        "total_count": stays_queryset.count()
        + consumptions_queryset.count()
        + day_uses_queryset.count()
        + unpaid_invoices_queryset.count(),
        "stays_without_invoice_count": stays_queryset.count(),
        "unbilled_consumptions_count": consumptions_queryset.count(),
        "day_uses_to_invoice_count": day_uses_queryset.count(),
        "unpaid_invoices_count": unpaid_invoices_queryset.count(),
        "items": items,
    }


def _invoice_has_active_duplicate(*, stay=None, day_use=None):
    queryset = ClientInvoice.objects.filter(status__in=ACTIVE_INVOICE_STATUSES)
    if stay is not None:
        return queryset.filter(stay=stay).exists()
    if day_use is not None:
        return queryset.filter(day_use=day_use).exists()
    return False


def _apply_advances_to_final_invoice(invoice, booking=None, stay=None):
    if not booking and not stay:
        return invoice

    invoice_filters = Q()
    if booking:
        invoice_filters |= Q(reservation=booking, items__label__icontains="Avance reservation")
    if stay:
        invoice_filters |= Q(payments__stay=stay, items__label__icontains="Avance sejour")

    advance_invoices = (
        ClientInvoice.objects.filter(
            hotel=invoice.hotel,
            client=invoice.client,
            status__in=[
                ClientInvoice.Status.ISSUED,
                ClientInvoice.Status.PARTIALLY_PAID,
                ClientInvoice.Status.PAID,
            ],
        )
        .filter(invoice_filters)
        .exclude(pk=invoice.pk)
        .distinct()
    )
    advance_total = sum((advance.amount_paid for advance in advance_invoices), Decimal("0.00")).quantize(Decimal("0.01"))
    if advance_total <= 0:
        return invoice

    applied_amount = min(advance_total, invoice.subtotal_amount).quantize(Decimal("0.01"))
    if applied_amount <= 0:
        return invoice

    references = ", ".join(advance.reference for advance in advance_invoices)
    imputation_note = f"Avance imputee automatiquement sur la facture finale : {applied_amount} {invoice.currency}"
    if references:
        imputation_note = f"{imputation_note} ({references})"
    imputation_note = f"{imputation_note}."

    invoice.discount_amount = applied_amount
    invoice.notes = f"{invoice.notes}\n{imputation_note}".strip() if invoice.notes else imputation_note
    invoice.save()
    return invoice


def create_invoice_from_stay(stay, user=None):
    if stay.status != Stay.Status.COMPLETED:
        raise ValidationError("Seul un sejour termine peut etre facture automatiquement.")
    if _invoice_has_active_duplicate(stay=stay):
        raise ValidationError("Ce sejour possede deja une facture active.")

    consumptions = list(
        ClientConsumption.objects.filter(
            hotel=stay.hotel,
            stay=stay,
            status=ClientConsumption.Status.POSTED,
        ).select_related("service_department", "room")
    )
    booking_amount = stay.booking.estimated_amount if stay.booking_id else Decimal("0.00")
    if booking_amount <= 0 and not consumptions:
        raise ValidationError("Aucun montant facturable n'a ete trouve pour ce sejour.")

    with transaction.atomic():
        invoice = ClientInvoice.objects.create(
            hotel=stay.hotel,
            client=stay.guest,
            stay=stay,
            reservation=stay.booking if stay.booking_id else None,
            issued_by=user if getattr(user, "is_authenticated", False) else None,
            source=ClientInvoice.Source.STAY_FOLIO,
            notes=f"Facture generee automatiquement depuis le sejour {stay.reference}.",
        )
        if booking_amount > 0:
            ClientInvoiceItem.objects.create(
                invoice=invoice,
                label=f"Hebergement sejour {stay.reference}",
                description=f"Chambre {stay.room.number}",
                quantity=Decimal("1.00"),
                unit_price=booking_amount,
                room=stay.room,
            )
        for consumption in consumptions:
            ClientInvoiceItem.objects.create(
                invoice=invoice,
                consumption=consumption,
                label=consumption.label,
                quantity=consumption.quantity,
                unit_price=consumption.unit_price,
                service_department=consumption.service_department,
                room=consumption.room,
                service_date=consumption.service_date,
            )
        _apply_advances_to_final_invoice(invoice, booking=stay.booking if stay.booking_id else None, stay=stay)
        invoice.refresh_from_db()
    return invoice


def create_invoice_from_day_use(day_use, user=None):
    if day_use.status != DayUse.Status.COMPLETED:
        raise ValidationError("Seul un day use termine peut etre facture automatiquement.")
    if _invoice_has_active_duplicate(day_use=day_use):
        raise ValidationError("Ce day use possede deja une facture active.")
    if day_use.total_amount <= 0:
        raise ValidationError("Ce day use ne contient aucun montant facturable.")

    with transaction.atomic():
        invoice = ClientInvoice.objects.create(
            hotel=day_use.hotel,
            client=day_use.guest,
            day_use=day_use,
            issued_by=user if getattr(user, "is_authenticated", False) else None,
            source=ClientInvoice.Source.OTHER,
            notes=f"Facture generee automatiquement depuis le day use {day_use.reference}.",
        )
        ClientInvoiceItem.objects.create(
            invoice=invoice,
            label=f"Day use {day_use.reference}",
            description=f"Chambre {day_use.room.number}",
            quantity=Decimal("1.00"),
            unit_price=day_use.total_amount,
            room=day_use.room,
            service_date=day_use.check_out_at or day_use.updated_at,
        )
        invoice.refresh_from_db()
    return invoice


def create_booking_advance_invoice_payment(
    booking,
    *,
    amount,
    method=Payment.Method.CASH,
    paid_at=None,
    user=None,
    notes="",
    external_reference="",
):
    amount = Decimal(str(amount or 0)).quantize(Decimal("0.01"))
    if amount <= 0:
        raise ValidationError({"advance_amount": "Le montant de l'avance doit etre strictement positif."})

    with transaction.atomic():
        invoice = ClientInvoice.objects.create(
            hotel=booking.hotel,
            client=booking.guest,
            reservation=booking,
            issued_by=user if getattr(user, "is_authenticated", False) else None,
            status=ClientInvoice.Status.DRAFT,
            source=ClientInvoice.Source.OTHER,
            notes=f"Facture d'avance generee automatiquement pour la reservation {booking.reference}.",
        )
        ClientInvoiceItem.objects.create(
            invoice=invoice,
            label=f"Avance reservation {booking.reference}",
            description=f"Acompte avant confirmation de la reservation {booking.reference}.",
            quantity=Decimal("1.00"),
            unit_price=amount,
            room=booking.room,
        )
        invoice.issue()
        payment = Payment.objects.create(
            hotel=booking.hotel,
            client=booking.guest,
            booking=booking,
            invoice=invoice,
            amount=amount,
            method=method or Payment.Method.CASH,
            payment_type=Payment.PaymentType.FULL,
            status=Payment.Status.PAID,
            paid_at=paid_at or timezone.now(),
            notes=notes or f"Avance reservation {booking.reference}.",
            external_reference=external_reference or "",
            currency=invoice.currency,
            recorded_by=user if getattr(user, "is_authenticated", False) else None,
        )
        invoice.refresh_from_db()
    return invoice, payment


def get_billing_dashboard(hotel, period="today"):
    now = timezone.now()
    if period == "week":
        date_from = now - timedelta(days=7)
    elif period == "month":
        date_from = now - timedelta(days=30)
    else:
        date_from = now.replace(hour=0, minute=0, second=0, microsecond=0)

    invoices_qs = ClientInvoice.objects.filter(hotel=hotel)
    payments_qs = Payment.objects.filter(hotel=hotel)

    active_invoices = invoices_qs.exclude(status=ClientInvoice.Status.CANCELLED)
    period_invoices = invoices_qs.filter(issued_at__gte=date_from).exclude(
        status=ClientInvoice.Status.CANCELLED
    )
    period_payments = payments_qs.filter(
        paid_at__gte=date_from, status=Payment.Status.PAID
    )

    totals = active_invoices.aggregate(
        invoice_count=Count("id"),
        total_invoiced=Sum("total_amount"),
        total_paid=Sum("amount_paid"),
        total_balance=Sum("balance_due"),
    )

    by_status = list(
        invoices_qs.values("status").annotate(
            count=Count("id"),
            total_amount=Sum("total_amount"),
        )
    )

    period_stats = period_invoices.aggregate(
        period_count=Count("id"),
        period_invoiced=Sum("total_amount"),
        period_paid=Sum("amount_paid"),
    )

    by_method = list(
        period_payments.values("method").annotate(
            count=Count("id"),
            total_amount=Sum("amount"),
        )
    )

    recent_invoices = list(
        invoices_qs.exclude(status=ClientInvoice.Status.CANCELLED)
        .order_by("-issued_at")
        .values(
            "id",
            "reference",
            "status",
            "total_amount",
            "amount_paid",
            "balance_due",
            "issued_at",
            "client__first_name",
            "client__last_name",
        )[:5]
    )

    unpaid_qs = invoices_qs.filter(
        status__in=[ClientInvoice.Status.ISSUED, ClientInvoice.Status.PARTIALLY_PAID]
    )
    unpaid_stats = unpaid_qs.aggregate(
        count=Count("id"),
        total_balance=Sum("balance_due"),
    )

    return {
        "totals": totals,
        "by_status": by_status,
        "period_stats": period_stats,
        "by_method": by_method,
        "recent_invoices": recent_invoices,
        "unpaid_stats": unpaid_stats,
        "work_queue": get_billing_work_queue(hotel),
        "period": period,
    }


def get_client_balance(client, hotel):
    invoices = ClientInvoice.objects.filter(
        client=client, hotel=hotel
    ).exclude(status=ClientInvoice.Status.CANCELLED)

    totals = invoices.aggregate(
        total_invoiced=Sum("total_amount"),
        total_paid=Sum("amount_paid"),
        total_balance=Sum("balance_due"),
        invoice_count=Count("id"),
    )

    unpaid_invoices = list(
        invoices.filter(
            status__in=[
                ClientInvoice.Status.ISSUED,
                ClientInvoice.Status.PARTIALLY_PAID,
            ]
        )
        .order_by("-issued_at")
        .values(
            "id",
            "reference",
            "status",
            "total_amount",
            "amount_paid",
            "balance_due",
            "issued_at",
            "due_date",
        )[:20]
    )

    return {
        "client_id": client.id,
        "client_name": client.full_name,
        "totals": totals,
        "unpaid_invoices": unpaid_invoices,
    }


def build_invoice_pdf_payload(invoice):
    items = list(
        invoice.items.select_related("service_department", "room").all()
    )
    payments = list(
        invoice.payments.filter(status=Payment.Status.PAID)
        .select_related("recorded_by")
        .all()
    )
    hotel = invoice.hotel
    client = invoice.client

    return {
        "type": "invoice",
        "invoice": {
            "reference": invoice.reference,
            "status": invoice.status,
            "status_label": invoice.get_status_display(),
            "issued_at": invoice.issued_at.isoformat() if invoice.issued_at else None,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "currency": invoice.currency,
            "subtotal_amount": str(invoice.subtotal_amount),
            "discount_amount": str(invoice.discount_amount),
            "tax_amount": str(invoice.tax_amount),
            "total_amount": str(invoice.total_amount),
            "amount_paid": str(invoice.amount_paid),
            "balance_due": str(invoice.balance_due),
            "notes": invoice.notes,
            "source": invoice.source,
            "stay_reference": invoice.stay.reference if invoice.stay_id else None,
            "reservation_reference": (
                invoice.reservation.reference if invoice.reservation_id else None
            ),
        },
        "hotel": {
            "id": hotel.id,
            "name": hotel.name,
            "code": hotel.code,
            "currency": hotel.currency,
        }
        if hotel
        else {},
        "client": {
            "id": client.id,
            "name": client.full_name,
            "email": getattr(client, "email", ""),
            "phone": getattr(client, "phone", ""),
        }
        if client
        else {},
        "items": [
            {
                "label": item.label,
                "description": item.description,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
                "service_name": (
                    item.service_department.name if item.service_department_id else ""
                ),
                "room_number": item.room.number if item.room_id else "",
                "service_date": (
                    item.service_date.isoformat() if item.service_date else None
                ),
                "notes": item.notes,
            }
            for item in items
        ],
        "payments": [
            {
                "reference": p.reference,
                "amount": str(p.amount),
                "method": p.method,
                "method_label": p.get_method_display(),
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "recorded_by": (
                    p.recorded_by.get_full_name().strip() or p.recorded_by.username
                )
                if p.recorded_by
                else "",
                "notes": p.notes,
                "external_reference": p.external_reference,
            }
            for p in payments
        ],
        "generated_at": timezone.now().isoformat(),
    }


def duplicate_invoice(source, user):
    with transaction.atomic():
        duplicate = ClientInvoice.objects.create(
            hotel=source.hotel,
            client=source.client,
            stay=source.stay,
            reservation=source.reservation,
            issued_by=user,
            status=ClientInvoice.Status.DRAFT,
            currency=source.currency,
            notes=f"Copie de {source.reference}. {source.notes}".strip(),
            source=source.source,
            discount_amount=source.discount_amount,
            tax_amount=source.tax_amount,
        )
        for item in source.items.all():
            ClientInvoiceItem.objects.create(
                invoice=duplicate,
                service_department=item.service_department,
                room=item.room,
                label=item.label,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                service_date=item.service_date,
                notes=item.notes,
            )
        duplicate.refresh_financials()
        duplicate.refresh_from_db()
    return duplicate


def build_invoice_payment_data(invoice, payload):
    method = payload.get("method") or payload.get("payment_method", Payment.Method.CASH)
    if method == "bank_transfer":
        method = Payment.Method.TRANSFER

    amount = payload.get("amount")
    try:
        amount_value = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        amount_value = None

    payment_type = payload.get("payment_type")
    if not payment_type and amount_value is not None:
        payment_type = Payment.PaymentType.FULL if amount_value >= invoice.balance_due else Payment.PaymentType.PARTIAL

    payment_data = {
        "invoice": invoice.id,
        "client": invoice.client_id,
        "stay": invoice.stay_id,
        "booking": invoice.reservation_id,
        "amount": amount,
        "method": method,
        "payment_type": payment_type or Payment.PaymentType.INVOICE_PAYMENT,
        "status": Payment.Status.PAID,
        "notes": (payload.get("notes") or "").strip(),
        "external_reference": (payload.get("external_reference") or "").strip(),
        "currency": invoice.currency,
    }
    paid_at = payload.get("paid_at")
    if paid_at:
        payment_data["paid_at"] = paid_at
    return payment_data


def recalculate_invoice_payment_status(invoice):
    invoice.refresh_financials(sync_consumptions=False)
    invoice.refresh_from_db()
    return invoice


def apply_payment_to_invoice(payment):
    if not payment.invoice_id:
        return None
    return recalculate_invoice_payment_status(payment.invoice)


def validate_payment(payment):
    payment.full_clean()
    return payment


def create_payment(**payment_data):
    with transaction.atomic():
        payment = Payment.objects.create(**payment_data)
        apply_payment_to_invoice(payment)
    return payment


def create_invoice_payment(invoice, payload, serializer_class, serializer_context, user):
    validate_invoice_can_receive_payment(invoice)
    if not payload.get("amount"):
        raise ValueError("Le montant est obligatoire.")

    try:
        amount = Decimal(str(payload.get("amount")))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Le montant du paiement est invalide.")

    if amount <= 0:
        raise ValueError("Le montant doit etre strictement positif.")
    if amount > invoice.balance_due:
        raise ValueError("Le montant du paiement ne peut pas depasser le solde restant de la facture.")

    serializer = serializer_class(data=build_invoice_payment_data(invoice, payload), context=serializer_context)
    serializer.is_valid(raise_exception=True)
    return serializer.save(recorded_by=user)


def create_advance_payment(client, amount, hotel=None, notes="", external_reference="", **extra):
    return create_payment(
        client=client,
        hotel=hotel or getattr(client, "hotel", None),
        amount=amount,
        payment_type=Payment.PaymentType.ADVANCE,
        notes=notes,
        external_reference=external_reference,
        **extra,
    )


def attach_advance_to_invoice(payment, invoice):
    if payment.invoice_id:
        raise ValueError("Ce paiement est deja rattache a une facture.")
    if payment.payment_type not in Payment.CONTROLLED_STANDALONE_TYPES:
        raise ValueError("Seuls les paiements autonomes controles peuvent etre rattaches ensuite a une facture.")
    payment.invoice = invoice
    payment.client = invoice.client
    payment.stay = invoice.stay
    payment.booking = invoice.reservation
    payment.hotel = invoice.hotel
    payment.payment_type = Payment.PaymentType.INVOICE_PAYMENT
    payment.save(update_fields=["invoice", "client", "stay", "booking", "hotel", "payment_type", "updated_at"])
    return payment


def confirm_payment(payment):
    validate_payment_can_be_confirmed(payment)
    payment.status = Payment.Status.PAID
    if not payment.payment_type or payment.payment_type == Payment.PaymentType.ADJUSTMENT:
        payment.payment_type = payment.infer_payment_type()
    payment.save(update_fields=["status", "payment_type", "updated_at"])
    return payment


def cancel_payment(payment):
    validate_payment_can_be_cancelled(payment)
    payment.status = Payment.Status.CANCELLED
    payment.save(update_fields=["status", "updated_at"])
    return payment
