import { formatAmount, formatDate, formatDateTime, normalizeValue } from "../utils";
import { EmptyStateCard } from "./EmptyStateCard";

function PortfolioCard({ label, value, meta }) {
  return (
    <article className="info-card dashboard-kpi-card clients-highlight-card">
      <span className="dashboard-card-label">{label}</span>
      <div className="clients-highlight-value">{normalizeValue(value)}</div>
      <p>{meta}</p>
    </article>
  );
}

export function ClientInvoicesTab({ selectedClient }) {
  if (!selectedClient) {
    return null;
  }

  const portfolio = selectedClient.invoice_portfolio || {};
  const invoices = selectedClient.invoice_history || [];

  return (
    <div className="table-like clients-invoices-tab">
      <div className="clients-summary-grid">
        <PortfolioCard
          label="Factures actives"
          value={portfolio.total_count || 0}
          meta="Factures visibles hors annulations."
        />
        <PortfolioCard
          label="Montant facture"
          value={formatAmount(portfolio.total_amount)}
          meta="Total cumule des factures du client."
        />
        <PortfolioCard
          label="Solde restant"
          value={formatAmount(portfolio.balance_due)}
          meta="Montant encore a recouvrer sur l'historique charge."
        />
        <PortfolioCard
          label="Factures payees"
          value={portfolio.paid_count || 0}
          meta="Factures deja soldees integralement."
        />
      </div>

      {invoices.length ? (
        <div className="table-like">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="table-card detail-info-card clients-invoice-card">
              <div className="clients-consumption-card__head">
                <div>
                  <strong>{normalizeValue(invoice.invoice_number)}</strong>
                  <p>
                    Emise le {formatDateTime(invoice.issued_at)} ·
                    {" "}
                    {invoice.stay_reference
                      ? `Sejour ${normalizeValue(invoice.stay_reference)}`
                      : "Sans sejour rattache"}
                  </p>
                </div>
                <div className="client-badge-row">
                  <span className="client-badge">{normalizeValue(invoice.status)}</span>
                  <span className="client-badge subtle">{normalizeValue(invoice.currency)}</span>
                </div>
              </div>

              <div className="clients-consumption-grid">
                <div className="table-row">
                  <strong>Sous-total</strong>
                  <span>{formatAmount(invoice.subtotal_amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Remise</strong>
                  <span>{formatAmount(invoice.discount_amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Taxe</strong>
                  <span>{formatAmount(invoice.tax_amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Total</strong>
                  <span>{formatAmount(invoice.total_amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Montant paye</strong>
                  <span>{formatAmount(invoice.amount_paid)}</span>
                </div>
                <div className="table-row">
                  <strong>Solde</strong>
                  <span>{formatAmount(invoice.balance_due)}</span>
                </div>
                <div className="table-row">
                  <strong>Echeance</strong>
                  <span>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</span>
                </div>
                <div className="table-row">
                  <strong>Lignes</strong>
                  <span>{normalizeValue(invoice.item_count)}</span>
                </div>
                <div className="table-row">
                  <strong>Reservation</strong>
                  <span>{normalizeValue(invoice.reservation_reference || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Notes</strong>
                  <span>{normalizeValue(invoice.notes || "-")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucune facture consolidee"
          description="Les factures client apparaitront ici avec leurs totaux, leur solde et leur rattachement eventuel au sejour."
        />
      )}
    </div>
  );
}
