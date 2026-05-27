import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../../shared/components/AppSelect";
import { DatePicker } from "../../../shared/components/DatePicker";
import { getClientHistory } from "../../../services/clientsService";
import { formatAmount, formatDateTime, normalizeValue } from "../utils";
import { EmptyStateCard } from "./EmptyStateCard";

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "Tous les evenements" },
  { value: "client_created", label: "Client cree" },
  { value: "stay_created", label: "Sejour cree" },
  { value: "check_in", label: "Check-in" },
  { value: "check_out", label: "Check-out" },
  { value: "consumption_recorded", label: "Consommation" },
  { value: "invoice_created", label: "Facture creee" },
  { value: "invoice_paid", label: "Facture soldee" },
  { value: "payment_recorded", label: "Paiement enregistre" },
  { value: "payment_cancelled", label: "Paiement annule" },
  { value: "payment_refunded", label: "Paiement rembourse" },
  { value: "satisfaction_recorded", label: "Satisfaction client" },
  { value: "status_changed", label: "Changement de statut" },
  { value: "event_logged", label: "Evenement journalise" },
];

function PortfolioCard({ label, value, meta }) {
  return (
    <article className="info-card dashboard-kpi-card clients-highlight-card">
      <span className="dashboard-card-label">{label}</span>
      <div className="clients-highlight-value">{normalizeValue(value)}</div>
      <p>{meta}</p>
    </article>
  );
}

export function ClientHistoryTab({ selectedClient }) {
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyData, setHistoryData] = useState({
    results: selectedClient?.timeline_history || [],
    summary: selectedClient?.timeline_portfolio || { event_types: {}, last_event_at: "" },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistoryData({
      results: selectedClient?.timeline_history || [],
      summary: selectedClient?.timeline_portfolio || { event_types: {}, last_event_at: "" },
    });
    setEventType("");
    setDateFrom("");
    setDateTo("");
    setError("");
  }, [selectedClient?.id]);

  useEffect(() => {
    if (!selectedClient?.id) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      getClientHistory(selectedClient.id, {
        eventTypes: eventType ? [eventType] : [],
        dateFrom,
        dateTo,
      })
        .then((payload) => setHistoryData(payload))
        .catch((requestError) => {
          setError(requestError.message || "Impossible de charger l'historique client.");
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, eventType, selectedClient?.id]);

  const summary = historyData.summary || {};
  const events = historyData.results || [];

  const summaryCards = useMemo(
    () => [
      {
        label: "Dernier evenement",
        value: summary.last_event_at ? formatDateTime(summary.last_event_at) : "-",
        meta: "Derniere trace chronologique visible sur le dossier client.",
      },
      {
        label: "Paiements journalises",
        value: (summary.event_types || {}).payment_recorded || 0,
        meta: "Encaissements reperes dans la timeline consolidee.",
      },
      {
        label: "Factures generees",
        value: (summary.event_types || {}).invoice_created || 0,
        meta: "Documents de facturation visibles dans le parcours client.",
      },
      {
        label: "Mouvements de sejour",
        value:
          ((summary.event_types || {}).stay_created || 0) +
          ((summary.event_types || {}).check_in || 0) +
          ((summary.event_types || {}).check_out || 0),
        meta: "Creation, arrivees et sorties rattachees au client.",
      },
    ],
    [summary],
  );

  if (!selectedClient) {
    return null;
  }

  return (
    <div className="table-like clients-history-tab">
      <div className="clients-summary-grid">
        {summaryCards.map((item) => (
          <PortfolioCard key={item.label} label={item.label} value={item.value} meta={item.meta} />
        ))}
      </div>

      <div className="table-card detail-info-card clients-history-filters clients-filters-container">
        <div className="clients-history-filters__intro">
          <span className="clients-history-filters__eyebrow">Filtres</span>
          <strong>Affiner la timeline client</strong>
          <p>Filtre l'historique par nature d'evenement ou par periode, sans quitter la fiche client.</p>
        </div>

        <div className="clients-history-filters__grid clients-filters-row">
          <label className="form-field clients-history-filter-field clients-history-filter-field--event-type clients-filter-item">
            <span className="form-label">Type d'evenement</span>
            <AppSelect value={eventType} onChange={(event) => setEventType(event.target.value)} name="event_type">
              {EVENT_TYPE_OPTIONS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </AppSelect>
          </label>

          <label className="form-field clients-history-filter-field clients-history-filter-field--date clients-filter-item">
            <span className="form-label">Du</span>
            <DatePicker
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              name="date_from"
              placeholder="Choisir une date"
              className="clients-compact-date-trigger"
              popoverClassName="clients-compact-date-popover"
              popoverMinWidth={236}
              matchTriggerWidth={false}
            />
          </label>

          <label className="form-field clients-history-filter-field clients-history-filter-field--date clients-filter-item">
            <span className="form-label">Au</span>
            <DatePicker
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              name="date_to"
              placeholder="Choisir une date"
              className="clients-compact-date-trigger"
              popoverClassName="clients-compact-date-popover"
              popoverMinWidth={236}
              matchTriggerWidth={false}
            />
          </label>
        </div>
      </div>

      {loading ? <div className="status-box">Chargement de l'historique...</div> : null}
      {error ? <div className="alert-box">{error}</div> : null}

      {events.length ? (
        <section className="list-panel dashboard-panel client-history-section">
          <div className="panel-head">
            <div>
              <h3>Timeline consolidee</h3>
              <p>{events.length} evenement(s) affiches pour la vue courante.</p>
            </div>
          </div>

          <div className="table-like client-history-timeline">
            {events.map((event, index) => (
              <article
                key={`${event.related_object_type}-${event.related_object_id}-${event.event_type}-${index}`}
                className="table-card detail-info-card client-history-card"
              >
                <div className="client-history-track" aria-hidden="true">
                  <span className="client-history-dot" />
                  <span className="client-history-line" />
                </div>

                <div className="client-history-body">
                  <div className="client-history-top">
                    <div>
                      <strong>{normalizeValue(event.title)}</strong>
                      <span>{normalizeValue(event.event_type)}</span>
                    </div>
                    <span>{formatDateTime(event.event_date)}</span>
                  </div>

                  <div className="client-history-meta">
                    <div className="table-row">
                      <strong>Description</strong>
                      <span>{normalizeValue(event.description)}</span>
                    </div>
                    <div className="table-row">
                      <strong>Reference</strong>
                      <span>{normalizeValue(event.reference || "-")}</span>
                    </div>
                    <div className="table-row">
                      <strong>Source</strong>
                      <span>{normalizeValue(event.source_module || "-")}</span>
                    </div>
                    <div className="table-row">
                      <strong>Statut</strong>
                      <span>{normalizeValue(event.status || "-")}</span>
                    </div>
                    <div className="table-row">
                      <strong>Montant</strong>
                      <span>{event.amount ? formatAmount(event.amount) : "-"}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyStateCard
          title="Aucun evenement dans l'historique"
          description="Aucun evenement client ne correspond encore aux filtres de cette vue."
        />
      )}
    </div>
  );
}
