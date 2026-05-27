import { useEffect, useState } from "react";

import { getClientPayments } from "../../../services/clientsService";
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

export function ClientPaymentsTab({ selectedClient }) {
  const [payload, setPayload] = useState({
    payment_portfolio: selectedClient?.payment_portfolio || {},
    results: selectedClient?.payment_history || [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedClient?.id) return undefined;
    setPayload({
      payment_portfolio: selectedClient.payment_portfolio || {},
      results: selectedClient.payment_history || [],
    });
    setLoading(true);
    setError("");
    getClientPayments(selectedClient.id)
      .then((data) => setPayload(data))
      .catch((requestError) => setError(requestError.message || "Impossible de charger les paiements."))
      .finally(() => setLoading(false));
    return undefined;
  }, [selectedClient?.id]);

  if (!selectedClient) {
    return null;
  }

  const portfolio = payload.payment_portfolio || {};
  const payments = payload.results || [];

  return (
    <div className="table-like clients-payments-tab">
      <div className="clients-summary-grid">
        <PortfolioCard
          label="Paiements confirmes"
          value={portfolio.confirmed_count || 0}
          meta="Encaissements reellement comptabilises."
        />
        <PortfolioCard
          label="Montant encaisse"
          value={formatAmount(portfolio.confirmed_amount)}
          meta="Somme des paiements confirmes du client."
        />
        <PortfolioCard
          label="En attente"
          value={portfolio.pending_count || 0}
          meta="Paiements saisis mais non encore confirmes."
        />
        <PortfolioCard
          label="Montant en attente"
          value={formatAmount(portfolio.pending_amount)}
          meta="Encaissements en attente de validation."
        />
      </div>

      {loading ? <div className="status-box">Chargement des paiements...</div> : null}
      {error ? <div className="alert-box">{error}</div> : null}

      {payments.length ? (
        <div className="table-like">
          {payments.map((payment) => (
            <article key={payment.id} className="table-card detail-info-card clients-payment-card">
              <div className="clients-consumption-card__head">
                <div>
                  <strong>{normalizeValue(payment.payment_reference)}</strong>
                  <p>
                    {formatDateTime(payment.paid_at)} ·{" "}
                    {payment.stay_reference
                      ? `Sejour ${normalizeValue(payment.stay_reference)}`
                      : "Sans sejour rattache"}
                  </p>
                </div>
                <div className="client-badge-row">
                  <span className="client-badge">{normalizeValue(payment.payment_type)}</span>
                  <span className="client-badge subtle">{normalizeValue(payment.status)}</span>
                </div>
              </div>

              <div className="clients-consumption-grid">
                <div className="table-row">
                  <strong>Mode</strong>
                  <span>{normalizeValue(payment.method)}</span>
                </div>
                <div className="table-row">
                  <strong>Montant</strong>
                  <span>{formatAmount(payment.amount)}</span>
                </div>
                <div className="table-row">
                  <strong>Facture</strong>
                  <span>{normalizeValue(payment.invoice_reference || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Reservation</strong>
                  <span>{normalizeValue(payment.reservation_reference || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Reference externe</strong>
                  <span>{normalizeValue(payment.external_reference || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Origine</strong>
                  <span>{normalizeValue(payment.source || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Devise</strong>
                  <span>{normalizeValue(payment.currency)}</span>
                </div>
                <div className="table-row">
                  <strong>Notes</strong>
                  <span>{normalizeValue(payment.notes || "-")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucun paiement consolide"
          description="Les encaissements client apparaitront ici avec leur statut, leur mode et leur rattachement eventuel a un sejour ou une facture."
        />
      )}
    </div>
  );
}
