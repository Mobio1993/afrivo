from decimal import Decimal

from django.utils import timezone

from ..models import Bill, Payment, Table


class PaymentService:
    @staticmethod
    def process_payment(bill, mode, montant, caissier, reference_externe="", sejour=None):
        if mode == Payment.Mode.CHAMBRE and not sejour:
            raise ValueError("Sejour requis pour ajouter a la chambre")

        payment = Payment.objects.create(
            bill=bill,
            mode=mode,
            montant=Decimal(str(montant or 0)),
            caissier=caissier,
            reference_externe=reference_externe,
            sejour=sejour,
        )

        total_paye = sum((p.montant for p in bill.payments.all()), Decimal("0"))
        if total_paye >= bill.total:
            bill.statut = Bill.Status.PAYEE
            bill.closed_at = timezone.now()
            bill.save(update_fields=["statut", "closed_at"])
            bill.order.statut = "payee"
            bill.order.save(update_fields=["statut", "updated_at"])
            bill.order.table.statut = Table.Status.LIBRE
            bill.order.table.save(update_fields=["statut"])

        if mode == Payment.Mode.CHAMBRE and sejour:
            from .room_charge_service import RoomChargeService

            RoomChargeService.add_charge(sejour, bill, payment)

        return payment
