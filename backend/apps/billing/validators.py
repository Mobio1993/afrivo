from django.core.exceptions import ValidationError

from apps.billing.models import ClientInvoice, Payment


def validate_invoice_can_receive_payment(invoice):
    if invoice.status == ClientInvoice.Status.CANCELLED:
        raise ValidationError("Une facture annulee ne peut pas recevoir de paiement.")
    if invoice.status == ClientInvoice.Status.PAID:
        raise ValidationError("Cette facture est deja integralement payee.")


def validate_payment_can_be_confirmed(payment):
    if payment.status != Payment.Status.PENDING:
        raise ValidationError("Seul un paiement en attente peut etre confirme.")


def validate_payment_can_be_cancelled(payment):
    if payment.status not in {Payment.Status.PENDING, Payment.Status.PAID}:
        raise ValidationError("Ce paiement ne peut pas etre annule dans son etat actuel.")
