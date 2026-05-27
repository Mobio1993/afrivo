from decimal import Decimal

from ..models import Bill


class BillingService:
    @staticmethod
    def generate_bill(order, discount=None, tax=None):
        items = order.items.exclude(statut="annule")
        sous_total = sum((item.sous_total for item in items), Decimal("0"))
        remise = Decimal("0")
        if discount and discount.actif:
            if discount.type_remise == "pct":
                remise = sous_total * discount.valeur / Decimal("100")
            else:
                remise = min(discount.valeur, sous_total)
        taxe = Decimal("0")
        if tax and tax.actif:
            taxe = (sous_total - remise) * tax.taux_pct / Decimal("100")
        total = sous_total - remise + taxe

        bill, _ = Bill.objects.get_or_create(order=order)
        bill.sous_total = sous_total
        bill.remise_montant = remise
        bill.taxe_montant = taxe
        bill.total = total
        bill.discount = discount
        bill.save()
        return bill
