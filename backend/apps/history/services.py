from apps.history.models import ActivityLog, HistoryEntry


HISTORY_TO_ACTIVITY_ACTION = {
    HistoryEntry.ActionType.BOOKING_CREATED: ActivityLog.Action.CREATE,
    HistoryEntry.ActionType.CHECK_IN: ActivityLog.Action.CHECKIN,
    HistoryEntry.ActionType.CHECK_OUT: ActivityLog.Action.CHECKOUT,
    HistoryEntry.ActionType.DAY_USE_CREATED: ActivityLog.Action.CREATE,
    HistoryEntry.ActionType.DAY_USE_CHECK_IN: ActivityLog.Action.CHECKIN,
    HistoryEntry.ActionType.DAY_USE_CHECK_OUT: ActivityLog.Action.CHECKOUT,
    HistoryEntry.ActionType.CLEANING_COMPLETED: ActivityLog.Action.ROOM_STATUS_CHANGE,
    HistoryEntry.ActionType.PAYMENT_RECORDED: ActivityLog.Action.PAYMENT,
    HistoryEntry.ActionType.SATISFACTION_RECORDED: ActivityLog.Action.CREATE,
    HistoryEntry.ActionType.STATUS_UPDATED: ActivityLog.Action.UPDATE,
    HistoryEntry.ActionType.OTHER: ActivityLog.Action.OTHER,
}


def _get_client_ip(request):
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def _get_user_agent(request):
    if request is None:
        return ""
    return request.META.get("HTTP_USER_AGENT", "")[:1000]


def _get_session_key(request):
    if request is None:
        return ""
    session = getattr(request, "session", None)
    return getattr(session, "session_key", "") or ""


def _resolve_hotel(request=None, user=None, hotel=None):
    if hotel is not None:
        return hotel
    request_hotel = getattr(request, "hotel", None) if request is not None else None
    if request_hotel is not None:
        return request_hotel
    return getattr(user, "hotel", None)


def _normalize_payload(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    return {"value": value}


def log_activity(
    *,
    request=None,
    action=ActivityLog.Action.OTHER,
    module,
    object_type="",
    object_id="",
    object_reference="",
    description,
    old_values=None,
    new_values=None,
    severity=ActivityLog.Severity.INFO,
    user=None,
    hotel=None,
    metadata=None,
):
    resolved_user = user or getattr(request, "user", None)
    if not getattr(resolved_user, "is_authenticated", False):
        resolved_user = None
    resolved_hotel = _resolve_hotel(request=request, user=resolved_user, hotel=hotel)

    return ActivityLog.objects.create(
        hotel=resolved_hotel,
        user=resolved_user,
        user_role=getattr(resolved_user, "role", "") if resolved_user else "",
        action=action,
        module=module,
        object_type=object_type or "",
        object_id=str(object_id or ""),
        object_reference=str(object_reference or ""),
        description=description,
        old_values=_normalize_payload(old_values),
        new_values=_normalize_payload(new_values),
        metadata=metadata or {},
        ip_address=_get_client_ip(request),
        user_agent=_get_user_agent(request),
        severity=severity,
        session_key=_get_session_key(request),
    )


def log_history(*, action_type, module, entity_type, entity_reference, description, actor=None, metadata=None, hotel=None, request=None):
    resolved_hotel = hotel or getattr(actor, "hotel", None)
    entry = HistoryEntry.objects.create(
        actor=actor,
        hotel=resolved_hotel,
        action_type=action_type,
        module=module,
        entity_type=entity_type,
        entity_reference=entity_reference,
        description=description,
        metadata=metadata or {},
    )
    payload = metadata or {}
    log_activity(
        request=request,
        user=actor,
        hotel=resolved_hotel,
        action=payload.get("activity_action") or HISTORY_TO_ACTIVITY_ACTION.get(action_type, ActivityLog.Action.OTHER),
        module=module,
        object_type=entity_type,
        object_id=payload.get("object_id") or payload.get("booking_id") or payload.get("stay_id") or payload.get("payment_id") or payload.get("room_id") or payload.get("guest_id") or "",
        object_reference=entity_reference,
        description=description,
        old_values=payload.get("old_values"),
        new_values=payload.get("new_values") or payload,
        severity=payload.get("severity") or ActivityLog.Severity.INFO,
        metadata={**payload, "history_entry_id": entry.id},
    )
    return entry


def _timeline_event(
    *,
    event_type,
    title,
    description,
    event_date,
    related_object_type,
    related_object_id,
    amount="",
    status="",
    status_code="",
    reference="",
    source_module="",
    importance_level="normal",
):
    return {
        "event_type": event_type,
        "title": title,
        "description": description,
        "event_date": event_date,
        "related_object_type": related_object_type,
        "related_object_id": related_object_id,
        "reference": reference,
        "amount": amount,
        "status": status,
        "status_code": status_code,
        "source_module": source_module,
        "importance_level": importance_level,
    }


def build_client_timeline(client, *, event_types=None, date_from=None, date_to=None):
    from django.db.models import Q
    from django.utils import timezone

    from apps.billing.models import ClientInvoice, Payment
    from apps.consumptions.models import ClientConsumption
    from apps.satisfaction.models import ClientSatisfaction

    normalized_types = set(event_types or [])
    stay_ids = list(client.stays.values_list("id", flat=True))
    booking_ids = list(client.bookings.values_list("id", flat=True))
    invoice_ids = list(ClientInvoice.objects.filter(client=client).values_list("id", flat=True))
    payment_ids = list(Payment.objects.filter(client=client).values_list("id", flat=True))

    events = [
        _timeline_event(
            event_type="client_created",
            title="Client cree",
            description=f"Fiche client creee pour {client.full_name}.",
            event_date=client.created_at,
            related_object_type="client",
            related_object_id=client.id,
            reference=client.full_name,
            source_module="guests",
            importance_level="high",
        )
    ]

    for stay in client.stays.select_related("room", "booking").order_by("-created_at"):
        events.append(
            _timeline_event(
                event_type="stay_created",
                title="Sejour cree",
                description=f"Sejour {stay.reference} ouvert pour la chambre {stay.room.number}.",
                event_date=stay.created_at,
                related_object_type="stay",
                related_object_id=stay.id,
                reference=stay.reference,
                status=stay.get_status_display(),
                status_code=stay.status,
                source_module="stays",
            )
        )
        check_in_date = stay.actual_check_in or stay.check_in_at
        if check_in_date:
            events.append(
                _timeline_event(
                    event_type="check_in",
                    title="Check-in",
                    description=f"Arrivee effective sur le sejour {stay.reference}.",
                    event_date=check_in_date,
                    related_object_type="stay",
                    related_object_id=stay.id,
                    reference=stay.reference,
                    status=stay.get_status_display(),
                    status_code=stay.status,
                    source_module="stays",
                    importance_level="high",
                )
            )
        check_out_date = stay.actual_check_out or stay.check_out_at
        if check_out_date:
            events.append(
                _timeline_event(
                    event_type="check_out",
                    title="Check-out",
                    description=f"Sortie du client sur le sejour {stay.reference}.",
                    event_date=check_out_date,
                    related_object_type="stay",
                    related_object_id=stay.id,
                    reference=stay.reference,
                    status=stay.get_status_display(),
                    status_code=stay.status,
                    source_module="stays",
                    importance_level="high",
                )
            )

    for consumption in client.consumptions.select_related("service_department", "stay").order_by("-service_date", "-id"):
        event_date = consumption.service_date or consumption.created_at
        events.append(
            _timeline_event(
                event_type="consumption_recorded",
                title="Consommation enregistree",
                description=f"{consumption.label} - {consumption.service_department.name}.",
                event_date=event_date,
                related_object_type="consumption",
                related_object_id=consumption.id,
                reference=consumption.reference,
                amount=f"{consumption.total_amount:.2f}",
                status=consumption.get_status_display(),
                status_code=consumption.status,
                source_module="consumptions",
            )
        )

    for invoice in ClientInvoice.objects.filter(client=client).select_related("stay", "reservation").order_by("-issued_at", "-id"):
        invoice_date = invoice.issued_at or invoice.created_at
        events.append(
            _timeline_event(
                event_type="invoice_created",
                title="Facture creee",
                description=f"Facture {invoice.reference} generee pour le client.",
                event_date=invoice_date,
                related_object_type="invoice",
                related_object_id=invoice.id,
                reference=invoice.reference,
                amount=f"{invoice.total_amount:.2f}",
                status=invoice.get_status_display(),
                status_code=invoice.status,
                source_module="billing",
            )
        )
        if invoice.status == ClientInvoice.Status.PAID:
            events.append(
                _timeline_event(
                    event_type="invoice_paid",
                    title="Facture soldee",
                    description=f"Facture {invoice.reference} integralement reglee.",
                    event_date=invoice.updated_at,
                    related_object_type="invoice",
                    related_object_id=invoice.id,
                    reference=invoice.reference,
                    amount=f"{invoice.amount_paid:.2f}",
                    status=invoice.get_status_display(),
                    status_code=invoice.status,
                    source_module="billing",
                    importance_level="high",
                )
            )

    for payment in Payment.objects.filter(client=client).select_related("invoice", "stay", "booking").order_by("-paid_at", "-id"):
        event_type = "payment_recorded"
        title = "Paiement enregistre"
        event_date = payment.paid_at or payment.created_at
        if payment.status == Payment.Status.CANCELLED:
            event_type = "payment_cancelled"
            title = "Paiement annule"
            event_date = payment.updated_at
        elif payment.status == Payment.Status.REFUNDED:
            event_type = "payment_refunded"
            title = "Paiement rembourse"
            event_date = payment.updated_at

        events.append(
            _timeline_event(
                event_type=event_type,
                title=title,
                description=f"Paiement {payment.reference} via {payment.get_method_display().lower()}.",
                event_date=event_date,
                related_object_type="payment",
                related_object_id=payment.id,
                reference=payment.reference,
                amount=f"{payment.amount:.2f}",
                status=payment.get_status_display(),
                status_code=payment.status,
                source_module="billing",
                importance_level="high" if payment.status == Payment.Status.PAID else "normal",
            )
        )

    for satisfaction in ClientSatisfaction.objects.filter(client=client).select_related("stay", "consumption").order_by(
        "-submitted_at", "-id"
    ):
        events.append(
            _timeline_event(
                event_type="satisfaction_recorded",
                title="Avis de satisfaction",
                description=(
                    f"Avis {satisfaction.reference} note {satisfaction.overall_rating}/5."
                    if satisfaction.overall_rating
                    else f"Avis {satisfaction.reference} enregistre."
                ),
                event_date=satisfaction.submitted_at or satisfaction.created_at,
                related_object_type="satisfaction",
                related_object_id=satisfaction.id,
                reference=satisfaction.reference,
                amount="",
                status=satisfaction.get_satisfaction_level_display() if satisfaction.satisfaction_level else "",
                status_code=satisfaction.satisfaction_level,
                source_module="satisfaction",
                importance_level="high"
                if satisfaction.satisfaction_level in {
                    ClientSatisfaction.SatisfactionLevel.DISSATISFIED,
                    ClientSatisfaction.SatisfactionLevel.VERY_DISSATISFIED,
                }
                else "normal",
            )
        )

    history_filters = Q(metadata__guest_id=client.id) | Q(metadata__client_id=client.id)
    if stay_ids:
        history_filters |= Q(metadata__stay_id__in=stay_ids)
    if booking_ids:
        history_filters |= Q(metadata__booking_id__in=booking_ids)
    if invoice_ids:
        history_filters |= Q(metadata__invoice_id__in=invoice_ids)
    if payment_ids:
        history_filters |= Q(metadata__payment_id__in=payment_ids)
    satisfaction_ids = list(ClientSatisfaction.objects.filter(client=client).values_list("id", flat=True))
    if satisfaction_ids:
        history_filters |= Q(metadata__satisfaction_id__in=satisfaction_ids)

    history_queryset = HistoryEntry.objects.filter(history_filters).select_related("actor").order_by("-created_at", "-id")
    if getattr(client, "hotel_id", None):
        history_queryset = history_queryset.filter(hotel_id=client.hotel_id)

    for entry in history_queryset[:100]:
        event_type = "status_changed" if entry.action_type == HistoryEntry.ActionType.STATUS_UPDATED else "event_logged"
        events.append(
            _timeline_event(
                event_type=event_type,
                title=entry.get_action_type_display(),
                description=entry.description,
                event_date=entry.created_at,
                related_object_type=entry.entity_type.lower(),
                related_object_id=entry.metadata.get("guest_id")
                or entry.metadata.get("stay_id")
                or entry.metadata.get("booking_id")
                or entry.metadata.get("invoice_id")
                or entry.metadata.get("payment_id")
                or client.id,
                reference=entry.entity_reference,
                status="",
                status_code=entry.action_type,
                source_module=entry.module,
            )
        )

    filtered_events = []
    seen = set()
    for event in events:
        if not event["event_date"]:
            continue
        event_date = event["event_date"]
        if timezone.is_naive(event_date):
            event_date = timezone.make_aware(event_date, timezone.get_current_timezone())
        event["event_date"] = event_date

        if normalized_types and event["event_type"] not in normalized_types:
            continue
        if date_from and event_date.date() < date_from:
            continue
        if date_to and event_date.date() > date_to:
            continue

        dedupe_key = (
            event["event_type"],
            event["related_object_type"],
            event["related_object_id"],
            event_date.isoformat(),
            event["reference"],
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        filtered_events.append(event)

    filtered_events.sort(key=lambda item: (item["event_date"], item["related_object_id"] or 0), reverse=True)
    return filtered_events


def build_client_timeline_payload(client, *, event_types=None, date_from=None, date_to=None, page=1, page_size=20):
    events = build_client_timeline(client, event_types=event_types, date_from=date_from, date_to=date_to)
    page = max(int(page or 1), 1)
    page_size = max(min(int(page_size or 20), 100), 1)
    start = (page - 1) * page_size
    end = start + page_size
    sliced_events = events[start:end]
    total_count = len(events)
    total_pages = (total_count + page_size - 1) // page_size if total_count else 1

    serialized_events = [
        {
            **event,
            "event_date": event["event_date"].isoformat(),
        }
        for event in sliced_events
    ]

    by_type = {}
    for event in events:
        by_type[event["event_type"]] = by_type.get(event["event_type"], 0) + 1

    return {
        "count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "results": serialized_events,
        "summary": {
            "last_event_at": events[0]["event_date"].isoformat() if events else "",
            "event_types": by_type,
        },
    }
