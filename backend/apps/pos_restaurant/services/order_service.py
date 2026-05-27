from ..models import KitchenTicket, Order, OrderItem, POSServer, Table


class OrderService:
    @staticmethod
    def create_order(table_id, serveur, notes=""):
        table = Table.objects.get(pk=table_id)
        if table.statut == Table.Status.FERMEE:
            raise ValueError("Impossible d'ouvrir une commande sur une table fermee")
        server = POSServer.resolve_for_user(serveur, table.area.restaurant)
        order = Order.objects.create(table=table, serveur=serveur, server=server, notes=notes)
        table.statut = Table.Status.OCCUPEE
        table.save(update_fields=["statut"])
        return order

    @staticmethod
    def add_item(order, menu_item, quantite=1, notes=""):
        if not menu_item.disponible:
            raise ValueError("Article indisponible")
        return OrderItem.objects.create(
            order=order,
            menu_item=menu_item,
            quantite=max(1, int(quantite or 1)),
            prix_unitaire=menu_item.prix,
            notes=notes,
        )

    @staticmethod
    def send_to_kitchen(order):
        ticket = KitchenTicket.objects.create(order=order)
        order.statut = Order.Status.EN_CUISINE
        order.save(update_fields=["statut", "updated_at"])
        return ticket

    @staticmethod
    def void_item(item, void_reason, user):
        from ..audit import pos_audit_logger

        item.statut = OrderItem.Status.ANNULE
        item.void_reason = void_reason
        item.save(update_fields=["statut", "void_reason"])
        pos_audit_logger.log(
            user,
            "void_item",
            {
                "order": item.order.reference,
                "item": item.menu_item.nom,
                "reason": void_reason.libelle,
            },
        )
