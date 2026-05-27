import { useEffect, useState } from "react";

import { getClientStays } from "../../../services/clientsService";
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

function StayTimelineBlock({ label, planned, actual }) {
  return (
    <div className="clients-stay-timeline-block">
      <strong>{label}</strong>
      <span>Prevu : {planned ? formatDateTime(planned) : "-"}</span>
      <span>Reel : {actual ? formatDateTime(actual) : "-"}</span>
    </div>
  );
}

export function ClientStaysTab({ selectedClient }) {
  const [payload, setPayload] = useState({
    stay_portfolio: selectedClient?.stay_portfolio || {},
    stay_history: selectedClient?.stay_history || [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedClient?.id) return undefined;
    setPayload({
      stay_portfolio: selectedClient.stay_portfolio || {},
      stay_history: selectedClient.stay_history || [],
    });
    setLoading(true);
    setError("");
    getClientStays(selectedClient.id)
      .then((data) => setPayload(data))
      .catch((requestError) => setError(requestError.message || "Impossible de charger les sejours."))
      .finally(() => setLoading(false));
    return undefined;
  }, [selectedClient?.id]);

  if (!selectedClient) {
    return null;
  }

  const portfolio = payload.stay_portfolio || {};
  const stays = payload.stay_history || [];

  return (
    <div className="table-like clients-stays-tab">
      <div className="clients-summary-grid">
        <PortfolioCard
          label="Sejours actifs"
          value={portfolio.active_count || 0}
          meta="Clients actuellement en maison sur cette fiche."
        />
        <PortfolioCard
          label="Sejours termines"
          value={portfolio.completed_count || 0}
          meta="Historique des passages clotures."
        />
        <PortfolioCard
          label="Paiements lies"
          value={formatAmount(portfolio.payments_total)}
          meta="Encaissements deja rattaches aux sejours du client."
        />
        <PortfolioCard
          label="Consommations liees"
          value={formatAmount(portfolio.consumptions_total)}
          meta="Base utile pour le futur folio client."
        />
      </div>

      {loading ? <div className="status-box">Chargement des sejours...</div> : null}
      {error ? <div className="alert-box">{error}</div> : null}

      {stays.length ? (
        <div className="table-like">
          {stays.map((stay) => (
            <article key={stay.id} className="table-card detail-info-card clients-stay-card">
              <div className="clients-stay-card__head">
                <div>
                  <strong>{normalizeValue(stay.reference)}</strong>
                  <p>
                    {normalizeValue(stay.room)} · {normalizeValue(stay.room_type)} · {normalizeValue(stay.status)}
                  </p>
                </div>
                <div className="client-badge-row">
                  <span className="client-badge">{normalizeValue(stay.source)}</span>
                  {stay.booking_reference ? (
                    <span className="client-badge subtle">Reservation {stay.booking_reference}</span>
                  ) : (
                    <span className="client-badge subtle">Sejour direct</span>
                  )}
                </div>
              </div>

              <div className="clients-stay-grid">
                <StayTimelineBlock
                  label="Arrivee"
                  planned={stay.planned_check_in}
                  actual={stay.actual_check_in || stay.check_in_at}
                />
                <StayTimelineBlock
                  label="Depart"
                  planned={stay.planned_check_out || stay.expected_check_out_date}
                  actual={stay.actual_check_out || stay.check_out_at}
                />
              </div>

              <div className="clients-stay-metrics">
                <div className="table-row">
                  <strong>Occupants</strong>
                  <span>
                    {normalizeValue(stay.number_of_guests)} ({normalizeValue(stay.adults_count)} adulte(s) /{" "}
                    {normalizeValue(stay.children_count)} enfant(s))
                  </span>
                </div>
                <div className="table-row">
                  <strong>Paiements</strong>
                  <span>
                    {normalizeValue(stay.payment_count)} operation(s) · {formatAmount(stay.payment_total)}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Consommations</strong>
                  <span>
                    {normalizeValue(stay.consumption_count)} ligne(s) · {formatAmount(stay.consumption_total)}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Factures</strong>
                  <span>
                    {normalizeValue(stay.invoice_count)} facture(s) · {formatAmount(stay.invoice_total)}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Motif</strong>
                  <span>{stay.purpose_of_stay ? normalizeValue(stay.purpose_of_stay) : "-"}</span>
                </div>
                <div className="table-row">
                  <strong>Demandes speciales</strong>
                  <span>{stay.special_requests ? normalizeValue(stay.special_requests) : "-"}</span>
                </div>
                <div className="table-row">
                  <strong>Notes</strong>
                  <span>{stay.notes ? normalizeValue(stay.notes) : "-"}</span>
                </div>
                <div className="table-row">
                  <strong>Depart prevu</strong>
                  <span>
                    {stay.expected_check_out_date ? formatDate(stay.expected_check_out_date) : "-"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucun sejour consolide"
          description="Les sejours du client apparaitront ici avec leurs dates prevues, dates reelles, consommations et paiements lies."
        />
      )}
    </div>
  );
}
