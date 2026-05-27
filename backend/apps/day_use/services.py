from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.billing.models import Payment
from apps.bookings.models import Booking, DayUse
from apps.history.models import HistoryEntry
from apps.audit_logs.services import HotelAuditService

log_history = HotelAuditService.log_history
from apps.rooms.models import Room, RoomHousekeepingTask
from apps.rooms.services import sync_room_operational_status


DAY_USE_ACTIVE_STATUSES = {
    DayUse.Status.PENDING_PAYMENT,
    DayUse.Status.READY,
    DayUse.Status.IN_PROGRESS,
    DayUse.Status.OVERTIME,
}


def as_decimal(value, default="0.00"):
    try:
        return Decimal(str(value if value not in {None, ""} else default)).quantize(Decimal("0.01"))
    except Exception as exc:
        raise ValidationError("Montant invalide.") from exc


def normalize_datetime(value, field_name):
    if not value:
        return None
    if hasattr(value, "utcoffset"):
        parsed = value
    else:
        try:
            parsed = timezone.datetime.fromisoformat(str(value))
        except (TypeError, ValueError) as exc:
            raise ValidationError({field_name: "Date et heure invalides."}) from exc
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


class DayUsePricingService:
    MIN_DURATION_HOURS = 1
    MAX_DURATION_HOURS = 10

    @classmethod
    def validate_duration(cls, hours):
        try:
            duration = int(hours)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"expected_duration_hours": "La duree doit etre un nombre d'heures."}) from exc
        if duration < cls.MIN_DURATION_HOURS or duration > cls.MAX_DURATION_HOURS:
            raise ValidationError(
                {"expected_duration_hours": "La duree day use doit etre comprise entre 1h et 10h."}
            )
        return duration

    @classmethod
    def calculate(cls, *, room, duration_hours, discount_amount=0, hourly_rate=None):
        duration = cls.validate_duration(duration_hours)
        base_rate = as_decimal(hourly_rate if hourly_rate not in {None, ""} else room.effective_price_day_use)
        discount = as_decimal(discount_amount)
        if base_rate <= 0:
            raise ValidationError({"hourly_rate": "Le tarif horaire doit etre positif."})
        if discount < 0:
            raise ValidationError({"discount_amount": "La remise ne peut pas etre negative."})
        subtotal = (base_rate * Decimal(duration)).quantize(Decimal("0.01"))
        if discount > subtotal:
            raise ValidationError({"discount_amount": "La remise ne peut pas depasser le sous-total."})
        final = max(subtotal - discount, Decimal("0.00"))
        return {
            "expected_duration_hours": duration,
            "hourly_rate": base_rate,
            "subtotal_amount": subtotal,
            "discount_amount": discount,
            "final_amount": final,
        }


class DayUseConflictService:
    @staticmethod
    def get_overlapping_day_uses(*, room, start_datetime, end_datetime, exclude_day_use=None):
        queryset = DayUse.objects.filter(
            room=room,
            status__in=DAY_USE_ACTIVE_STATUSES,
        ).filter(
            Q(end_datetime__isnull=False, start_datetime__lt=end_datetime, end_datetime__gt=start_datetime)
            | Q(end_datetime__isnull=True, planned_entry_at__lt=end_datetime)
        )
        if room.hotel_id:
            queryset = queryset.filter(hotel=room.hotel)
        if exclude_day_use and exclude_day_use.pk:
            queryset = queryset.exclude(pk=exclude_day_use.pk)
        return queryset

    @staticmethod
    def get_overlapping_bookings(*, room, start_datetime, end_datetime):
        return Booking.objects.filter(
            room=room,
            status__in=[
                Booking.Status.PENDING,
                Booking.Status.CONFIRMED,
                Booking.Status.CHECKED_IN,
            ],
            check_in_date__lt=end_datetime.date(),
            check_out_date__gt=start_datetime.date(),
        )

    @classmethod
    def validate_no_conflict(cls, *, room, start_datetime, end_datetime, exclude_day_use=None):
        if cls.get_overlapping_day_uses(
            room=room,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            exclude_day_use=exclude_day_use,
        ).exists():
            raise ValidationError({"room": "Conflit horaire avec un autre day use sur cette chambre."})

        if cls.get_overlapping_bookings(room=room, start_datetime=start_datetime, end_datetime=end_datetime).exists():
            raise ValidationError({"room": "Conflit avec une reservation ou nuitée sur cette chambre."})


class DayUseAvailabilityService:
    BLOCKED_ROOM_STATUSES = {
        Room.Status.CLEANING,
        Room.Status.OUT_OF_SERVICE,
        Room.Status.OCCUPIED,
        Room.Status.RESERVED,
    }

    @classmethod
    def validate_room_can_be_used(cls, room):
        if not room.is_active:
            raise ValidationError({"room": "La chambre est inactive."})
        if not room.room_type.is_day_use_available:
            raise ValidationError({"room": "Le day use n'est pas autorise pour ce type de chambre."})
        if room.status in cls.BLOCKED_ROOM_STATUSES:
            raise ValidationError({"room": "La chambre n'est pas disponible pour un day use."})

    @classmethod
    def available_rooms(cls, *, hotel, start_datetime, end_datetime):
        queryset = Room.objects.select_related("room_type").filter(is_active=True, room_type__is_day_use_available=True)
        if hotel:
            queryset = queryset.filter(hotel=hotel)
        available = []
        for room in queryset.order_by("number"):
            try:
                cls.validate_room_can_be_used(room)
                DayUseConflictService.validate_no_conflict(
                    room=room,
                    start_datetime=start_datetime,
                    end_datetime=end_datetime,
                )
            except ValidationError:
                continue
            available.append(room)
        return available


class DayUseHistoryService:
    @staticmethod
    def write(day_use, *, action_type, description, actor=None, request=None, metadata=None):
        log_history(
            action_type=action_type,
            module="day_use",
            entity_type="DayUse",
            entity_reference=day_use.reference,
            description=description,
            actor=actor,
            request=request,
            hotel=day_use.hotel,
            metadata={"day_use_id": day_use.id, **(metadata or {})},
        )


class DayUseLifecycleService:
    @staticmethod
    def create(*, hotel, guest, room, payload, actor=None, request=None):
        start = normalize_datetime(payload.get("start_datetime") or payload.get("planned_entry_at"), "start_datetime")
        start = start or timezone.now()
        duration = DayUsePricingService.validate_duration(payload.get("expected_duration_hours") or payload.get("duration_hours") or 3)
        end = start + timedelta(hours=duration)

        with transaction.atomic():
            locked_room = Room.objects.select_for_update().select_related("room_type").get(pk=room.pk)
            DayUseAvailabilityService.validate_room_can_be_used(locked_room)
            DayUseConflictService.validate_no_conflict(room=locked_room, start_datetime=start, end_datetime=end)
            pricing = DayUsePricingService.calculate(
                room=locked_room,
                duration_hours=duration,
                discount_amount=payload.get("discount_amount") or 0,
                hourly_rate=payload.get("hourly_rate"),
            )
            try:
                day_use = DayUse.objects.create(
                    hotel=hotel or locked_room.hotel,
                    guest=guest,
                    room=locked_room,
                    status=DayUse.Status.PENDING_PAYMENT,
                    planned_entry_at=start,
                    start_datetime=start,
                    end_datetime=end,
                    expected_duration_hours=duration,
                    hourly_rate=pricing["hourly_rate"],
                    subtotal_amount=pricing["subtotal_amount"],
                    discount_amount=pricing["discount_amount"],
                    final_amount=pricing["final_amount"],
                    package_price=pricing["final_amount"],
                    total_amount=pricing["final_amount"],
                    notes=payload.get("notes") or "",
                    created_by=actor if getattr(actor, "is_authenticated", False) else None,
                    updated_by=actor if getattr(actor, "is_authenticated", False) else None,
                )
            except IntegrityError as exc:
                raise ValidationError({"room": "Conflit horaire avec une occupation existante."}) from exc
            day_use.refresh_financials(save=True)

        DayUseHistoryService.write(
            day_use,
            action_type=HistoryEntry.ActionType.DAY_USE_CREATED,
            description=f"Day use {day_use.reference} cree.",
            actor=actor,
            request=request,
        )
        return day_use

    @staticmethod
    def check_in(day_use, *, actor=None, request=None):
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("room", "guest").get(pk=day_use.pk)
            room = Room.objects.select_for_update().get(pk=locked.room_id)
            DayUseAvailabilityService.validate_room_can_be_used(room)
            DayUseConflictService.validate_no_conflict(
                room=room,
                start_datetime=locked.start_datetime or locked.planned_entry_at,
                end_datetime=locked.end_datetime or (locked.planned_entry_at + timedelta(hours=locked.expected_duration_hours or 3)),
                exclude_day_use=locked,
            )
            locked.refresh_financials(save=True)
            if locked.payment_status != DayUse.PaymentStatus.PAID:
                raise ValidationError("Le paiement complet est requis avant le check-in.")
            if locked.status not in {DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY}:
                raise ValidationError("Ce day use ne peut pas etre passe en check-in.")
            now = timezone.now()
            locked.status = DayUse.Status.IN_PROGRESS
            locked.check_in_at = now
            locked.checked_in_at = now
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.save(update_fields=["status", "check_in_at", "checked_in_at", "updated_by", "updated_at"])
            room.status = Room.Status.OCCUPIED
            room.save(update_fields=["status", "updated_at"])

        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.DAY_USE_CHECK_IN,
            description=f"Check-in day use {locked.reference}.",
            actor=actor,
            request=request,
        )
        return locked

    @staticmethod
    def check_out(day_use, *, actor=None, request=None):
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("room", "guest").get(pk=day_use.pk)
            room = Room.objects.select_for_update().get(pk=locked.room_id)
            if locked.status not in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME}:
                raise ValidationError("Seul un day use en chambre ou en depassement peut etre cloture.")
            now = timezone.now()
            started = locked.checked_in_at or locked.check_in_at or locked.start_datetime or locked.planned_entry_at
            actual_hours = max(Decimal((now - started).total_seconds()) / Decimal("3600"), Decimal("0"))
            expected = Decimal(locked.expected_duration_hours or 0)
            overtime_hours = max(actual_hours - expected, Decimal("0"))
            locked.actual_duration_hours = actual_hours.quantize(Decimal("0.01"))
            if overtime_hours > 0:
                locked.overtime_amount = (locked.hourly_rate * overtime_hours).quantize(Decimal("0.01"))
                locked.final_amount = locked.subtotal_amount - locked.discount_amount + locked.overtime_amount + locked.extension_amount
                locked.total_amount = locked.final_amount
            locked.status = DayUse.Status.COMPLETED
            locked.check_out_at = now
            locked.checked_out_at = now
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.refresh_financials(save=False)
            locked.save()
            room.status = Room.Status.CLEANING
            room.save(update_fields=["status", "updated_at"])
            RoomHousekeepingTask.objects.get_or_create(
                hotel=locked.hotel,
                room=room,
                status=RoomHousekeepingTask.Status.PENDING,
                defaults={
                    "task_type": RoomHousekeepingTask.TaskType.TURNOVER,
                    "priority": RoomHousekeepingTask.Priority.HIGH,
                    "notes": f"Rotation automatique apres sortie day use {locked.reference}.",
                },
            )

        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.DAY_USE_CHECK_OUT,
            description=f"Check-out day use {locked.reference}. Chambre envoyee au nettoyage.",
            actor=actor,
            request=request,
            metadata={"actual_duration_hours": str(locked.actual_duration_hours)},
        )
        return locked

    @staticmethod
    def cancel(day_use, *, reason, actor=None, request=None):
        if not str(reason or "").strip():
            raise ValidationError({"cancellation_reason": "La raison d'annulation est obligatoire."})
        if day_use.status in {DayUse.Status.COMPLETED, DayUse.Status.CANCELLED, DayUse.Status.NO_SHOW}:
            raise ValidationError("Ce day use ne peut plus etre annule.")
        if day_use.status in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME} or day_use.check_in_at:
            raise ValidationError("Un day use deja en chambre doit etre cloture, pas annule.")
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("room").get(pk=day_use.pk)
            locked.status = DayUse.Status.CANCELLED
            locked.cancellation_reason = reason
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.save(update_fields=["status", "cancellation_reason", "updated_by", "updated_at"])
            sync_room_operational_status(locked.room)
        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            description=f"Day use {locked.reference} annule.",
            actor=actor,
            request=request,
            metadata={"reason": reason},
        )
        return locked

    @staticmethod
    def no_show(day_use, *, reason, actor=None, request=None):
        if not str(reason or "").strip():
            raise ValidationError({"no_show_reason": "La raison du no-show est obligatoire."})
        if day_use.check_in_at or day_use.status in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME}:
            raise ValidationError("Un day use deja en chambre ne peut pas etre marque no-show.")
        if day_use.status not in {DayUse.Status.PENDING_PAYMENT, DayUse.Status.READY}:
            raise ValidationError("Seul un day use en attente peut etre marque no-show.")
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("room").get(pk=day_use.pk)
            locked.status = DayUse.Status.NO_SHOW
            locked.no_show_reason = reason
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.save(update_fields=["status", "no_show_reason", "updated_by", "updated_at"])
            sync_room_operational_status(locked.room)
        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            description=f"Day use {locked.reference} marque no-show.",
            actor=actor,
            request=request,
            metadata={"reason": reason},
        )
        return locked

    @staticmethod
    def extend(day_use, *, extra_hours, actor=None, request=None):
        extra = DayUsePricingService.validate_duration(extra_hours)
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("room").get(pk=day_use.pk)
            if locked.status not in {DayUse.Status.IN_PROGRESS, DayUse.Status.OVERTIME}:
                raise ValidationError("Seul un day use en cours peut etre prolonge.")
            total_duration = (locked.expected_duration_hours or 0) + extra
            if total_duration > DayUsePricingService.MAX_DURATION_HOURS:
                raise ValidationError({"extra_hours": "La duree totale du day use ne peut pas depasser 10h."})
            current_end = locked.end_datetime or locked.planned_entry_at + timedelta(hours=locked.expected_duration_hours or 3)
            new_end = current_end + timedelta(hours=extra)
            DayUseConflictService.validate_no_conflict(
                room=locked.room,
                start_datetime=locked.start_datetime or locked.planned_entry_at,
                end_datetime=new_end,
                exclude_day_use=locked,
            )
            extension_amount = (locked.hourly_rate * Decimal(extra)).quantize(Decimal("0.01"))
            locked.end_datetime = new_end
            locked.expected_duration_hours = total_duration
            locked.extension_count += 1
            locked.extension_amount += extension_amount
            locked.final_amount += extension_amount
            locked.total_amount = locked.final_amount
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.refresh_financials(save=False)
            locked.save()
        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            description=f"Prolongation day use {locked.reference} de {extra}h.",
            actor=actor,
            request=request,
            metadata={"extra_hours": extra, "extension_amount": str(extension_amount)},
        )
        return locked

    @staticmethod
    def convert_to_night(day_use, *, payload=None, actor=None, request=None):
        payload = payload or {}
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().select_related("guest", "room__room_type").get(pk=day_use.pk)
            if locked.converted_to_night:
                raise ValidationError("Ce day use est deja converti en nuitee.")
            if locked.status in {DayUse.Status.CANCELLED, DayUse.Status.NO_SHOW, DayUse.Status.COMPLETED}:
                raise ValidationError("Ce day use ne peut pas etre converti en nuitee.")
            room = Room.objects.select_for_update().select_related("room_type").get(pk=locked.room_id)
            start_value = locked.start_datetime or locked.planned_entry_at or timezone.now()
            check_in_date = timezone.localdate(start_value)
            raw_checkout = payload.get("check_out_date")
            if raw_checkout:
                try:
                    check_out_date = date.fromisoformat(str(raw_checkout))
                except ValueError as exc:
                    raise ValidationError({"check_out_date": "Date de depart invalide."}) from exc
            else:
                check_out_date = check_in_date + timedelta(days=1)
            if check_out_date <= check_in_date:
                raise ValidationError({"check_out_date": "La date de depart doit etre apres la date d'arrivee."})
            booking = Booking.objects.create(
                hotel=locked.hotel or room.hotel,
                guest=locked.guest,
                room_type=room.room_type,
                room=room,
                status=Booking.Status.CONFIRMED,
                source=Booking.BookingSource.WALK_IN,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                adults=int(payload.get("adults") or 1),
                children=int(payload.get("children") or 0),
                estimated_amount=as_decimal(payload.get("estimated_amount") or room.room_type.base_price_per_night),
                notes=payload.get("notes") or f"Conversion depuis day use {locked.reference}.",
            )
            locked.converted_to_night = True
            locked.converted_reservation = booking
            locked.updated_by = actor if getattr(actor, "is_authenticated", False) else locked.updated_by
            locked.save(update_fields=["converted_to_night", "converted_reservation", "updated_by", "updated_at"])
        DayUseHistoryService.write(
            locked,
            action_type=HistoryEntry.ActionType.STATUS_UPDATED,
            description=f"Day use {locked.reference} converti en reservation {booking.reference}.",
            actor=actor,
            request=request,
            metadata={"booking_id": booking.id, "booking_reference": booking.reference},
        )
        return booking, locked


class DayUsePaymentService:
    @staticmethod
    def record_payment(day_use, *, payload, actor=None, request=None):
        amount = as_decimal(payload.get("amount"))
        if amount <= 0:
            raise ValidationError({"amount": "Le montant doit etre positif."})
        external_reference = payload.get("external_reference") or ""
        with transaction.atomic():
            locked = DayUse.objects.select_for_update().get(pk=day_use.pk)
            locked.refresh_financials(save=True)
            if locked.status in {DayUse.Status.CANCELLED, DayUse.Status.NO_SHOW}:
                raise ValidationError("Impossible d'encaisser un day use annule ou no-show.")
            if external_reference:
                existing = Payment.objects.filter(
                    day_use=locked,
                    external_reference=external_reference,
                    status__in=[Payment.Status.PENDING, Payment.Status.PAID],
                ).first()
                if existing:
                    return existing
            if amount > locked.remaining_amount:
                raise ValidationError({"amount": "Le montant encaisse depasse le solde restant."})
            payment = Payment.objects.create(
                hotel=locked.hotel,
                client=locked.guest,
                day_use=locked,
                status=payload.get("status") or Payment.Status.PAID,
                payment_type=Payment.PaymentType.DAY_USE_PREPAYMENT,
                method=payload.get("method") or Payment.Method.CASH,
                amount=amount,
                paid_at=normalize_datetime(payload.get("paid_at"), "paid_at") or timezone.now(),
                notes=payload.get("notes") or f"Paiement day use {locked.reference}",
                external_reference=external_reference,
                currency=payload.get("currency") or "XOF",
                recorded_by=actor if getattr(actor, "is_authenticated", False) else None,
            )
            locked.refresh_financials(save=True)
            day_use = locked
        DayUseHistoryService.write(
            day_use,
            action_type=HistoryEntry.ActionType.PAYMENT_RECORDED,
            description=f"Paiement day use {payment.reference} enregistre.",
            actor=actor,
            request=request,
            metadata={"payment_id": payment.id, "amount": str(amount)},
        )
        return payment


class DayUseDashboardService:
    @staticmethod
    def build(*, hotel=None, target_date=None):
        target_date = target_date or timezone.localdate()
        queryset = DayUse.objects.select_related("guest", "room").filter(created_at__date=target_date)
        if hotel:
            queryset = queryset.filter(hotel=hotel)
        paid_payments = Payment.objects.filter(day_use__in=queryset, status=Payment.Status.PAID)
        return {
            "date": target_date.isoformat(),
            "total_day_use": queryset.count(),
            "occupied_day_use": queryset.filter(status=DayUse.Status.IN_PROGRESS).count(),
            "pending_payments": queryset.exclude(payment_status=DayUse.PaymentStatus.PAID).count(),
            "overtime": queryset.filter(status=DayUse.Status.OVERTIME).count(),
            "completed": queryset.filter(status=DayUse.Status.COMPLETED).count(),
            "revenue": f"{(paid_payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')):.2f}",
            "average_duration": queryset.aggregate(avg=Avg("actual_duration_hours"))["avg"] or 0,
            "top_rooms": list(
                queryset.values("room__number")
                .annotate(total=Count("id"), revenue=Sum("final_amount"))
                .order_by("-total")[:5]
            ),
        }


class DayUseReceiptService:
    @staticmethod
    def build(day_use):
        day_use.refresh_financials(save=True)
        return {
            "reference": day_use.reference,
            "client": day_use.guest.full_name,
            "room": day_use.room.number,
            "start_datetime": day_use.start_datetime.isoformat() if day_use.start_datetime else "",
            "end_datetime": day_use.end_datetime.isoformat() if day_use.end_datetime else "",
            "final_amount": f"{day_use.final_amount:.2f}",
            "amount_paid": f"{day_use.amount_paid:.2f}",
            "remaining_amount": f"{day_use.remaining_amount:.2f}",
            "currency": "XOF",
            "payments": [
                {
                    "reference": payment.reference,
                    "amount": f"{payment.amount:.2f}",
                    "method": payment.get_method_display(),
                    "paid_at": payment.paid_at.isoformat() if payment.paid_at else "",
                }
                for payment in day_use.payments.filter(status=Payment.Status.PAID).order_by("-paid_at", "-id")
            ],
        }
