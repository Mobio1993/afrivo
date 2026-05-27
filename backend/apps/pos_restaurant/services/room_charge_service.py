import logging

logger = logging.getLogger("pos")


class RoomChargeService:
    @staticmethod
    def add_charge(sejour, bill, payment):
        """
        Keep a durable POS payment link to the stay through Payment.sejour.
        Existing billing apps are intentionally not modified by this new module.
        """
        try:
            logger.info(
                "POS room charge linked",
                extra={
                    "stay_id": getattr(sejour, "id", None),
                    "bill": bill.reference,
                    "payment": payment.reference,
                    "amount": str(payment.montant),
                },
            )
        except Exception as exc:
            logger.error("RoomCharge failed: %s", exc)
