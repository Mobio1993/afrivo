import { formatAmount, formatDateTime, normalizeValue } from "../utils";
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

export function ClientConsumptionsTab({ selectedClient }) {
  if (!selectedClient) {
    return null;
  }

  const portfolio = selectedClient.consumption_portfolio || {};
  const consumptions = selectedClient.consumption_history || [];
  const byService = portfolio.by_service || [];

  return (
    <div className="table-like clients-consumptions-tab">
      <div className="clients-summary-grid">
        <PortfolioCard
          label="Total lignes"
          value={portfolio.total_count || 0}
          meta="Consommations disponibles sur l'historique client."
        />
        <PortfolioCard
          label="Montant cumule"
          value={formatAmount(portfolio.total_amount)}
          meta="Base preparee pour la future facturation globale client."
        />
        <PortfolioCard
          label="Deja facturees"
          value={portfolio.billed_count || 0}
          meta="Lignes deja rattachees a un flux de facturation."
        />
        <PortfolioCard
          label="Deja payees"
          value={portfolio.paid_count || 0}
          meta="Consommations marquees comme reglees."
        />
      </div>

      {byService.length ? (
        <div className="clients-consumptions-service-grid">
          {byService.map((item) => (
            <article
              key={`${item.service_department__code}-${item.service_department__name}`}
              className="table-card detail-info-card clients-consumption-service-card"
            >
              <strong>{normalizeValue(item.service_department__name)}</strong>
              <span>{normalizeValue(item.count)} ligne(s)</span>
              <p>{formatAmount(item.total_amount)}</p>
            </article>
          ))}
        </div>
      ) : null}

      {consumptions.length ? (
        <div className="table-like">
          {consumptions.map((consumption) => (
            <article
              key={consumption.id}
              className="table-card detail-info-card clients-consumption-card"
            >
              <div className="clients-consumption-card__head">
                <div>
                  <strong>{normalizeValue(consumption.label)}</strong>
                  <p>
                    {normalizeValue(consumption.reference)} · {normalizeValue(consumption.service)}
                  </p>
                </div>
                <div className="client-badge-row">
                  <span className="client-badge">{normalizeValue(consumption.status)}</span>
                  <span className="client-badge subtle">
                    {normalizeValue(consumption.payment_status)}
                  </span>
                </div>
              </div>

              <div className="clients-consumption-grid">
                <div className="table-row">
                  <strong>Date</strong>
                  <span>{formatDateTime(consumption.consumed_at)}</span>
                </div>
                <div className="table-row">
                  <strong>Quantite</strong>
                  <span>{normalizeValue(consumption.quantity)}</span>
                </div>
                <div className="table-row">
                  <strong>Prix unitaire</strong>
                  <span>{formatAmount(consumption.unit_price)}</span>
                </div>
                <div className="table-row">
                  <strong>Montant total</strong>
                  <span>{formatAmount(consumption.total_amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Sejour</strong>
                  <span>
                    {consumption.stay_reference
                      ? normalizeValue(consumption.stay_reference)
                      : "Client externe"}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Reservation</strong>
                  <span>{normalizeValue(consumption.reservation_reference || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Chambre</strong>
                  <span>{normalizeValue(consumption.room || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Notes</strong>
                  <span>{normalizeValue(consumption.notes || "-")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucune consommation consolidee"
          description="Les consommations du client apparaitront ici, avec le service, le sejour associe et leur statut de facturation."
        />
      )}
    </div>
  );
}
