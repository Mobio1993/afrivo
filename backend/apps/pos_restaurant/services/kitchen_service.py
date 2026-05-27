from django.utils import timezone

from ..models import KitchenTicket


class KitchenService:
    @staticmethod
    def start_ticket(ticket_id, cuisinier):
        ticket = KitchenTicket.objects.get(pk=ticket_id)
        ticket.statut = KitchenTicket.Status.EN_PREP
        ticket.cuisinier = cuisinier
        ticket.started_at = timezone.now()
        ticket.save(update_fields=["statut", "cuisinier", "started_at"])
        ticket.order.items.filter(statut="en_attente").update(statut="en_prep")
        return ticket

    @staticmethod
    def mark_ready(ticket_id):
        ticket = KitchenTicket.objects.get(pk=ticket_id)
        ticket.statut = KitchenTicket.Status.PRET
        ticket.ready_at = timezone.now()
        ticket.save(update_fields=["statut", "ready_at"])
        ticket.order.items.filter(statut="en_prep").update(statut="pret")
        return ticket
