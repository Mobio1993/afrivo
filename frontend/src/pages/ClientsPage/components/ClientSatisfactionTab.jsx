import { useMemo } from "react";

import { formatDateTime, normalizeValue } from "../utils";
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

function formatScore(value, suffix) {
  return value === null || value === undefined || value === "" ? "-" : `${value}${suffix}`;
}

function buildSatisfactionTone(portfolio) {
  const dissatisfied = Number(portfolio?.dissatisfied_count || 0);
  const neutral = Number(portfolio?.neutral_count || 0);
  const average = Number(portfolio?.average_overall_rating || 0);

  if (dissatisfied > 0 || (average > 0 && average <= 2.5)) {
    return { label: "Insatisfait", tone: "blacklist" };
  }
  if (neutral > 0 || (average > 0 && average < 4)) {
    return { label: "Neutre", tone: "standard" };
  }
  return { label: "Satisfait", tone: "loyal" };
}

export function ClientSatisfactionTab({ selectedClient }) {
  const portfolio = selectedClient?.satisfaction_portfolio || {};
  const satisfactions = selectedClient?.satisfaction_history || [];
  const latestFeedback = portfolio.latest_feedback || satisfactions[0] || null;
  const tone = buildSatisfactionTone(portfolio);

  const summaryCards = useMemo(
    () => [
      {
        label: "Avis clients",
        value: portfolio.total_count || 0,
        meta: "Nombre total de feedbacks soumis par le client depuis l'application externe.",
      },
      {
        label: "Note moyenne",
        value: portfolio.average_overall_rating || "-",
        meta: "Synthese de satisfaction globale exploitable pour le suivi qualite.",
      },
      {
        label: "Recommandation",
        value: portfolio.average_recommendation_score || "-",
        meta: "Moyenne des scores de recommandation remontes par le client.",
      },
      {
        label: "Avis sensibles",
        value: portfolio.dissatisfied_count || 0,
        meta: "Feedbacks a surveiller pour preparer reclamations et actions correctives.",
      },
    ],
    [portfolio],
  );

  const serviceCards = useMemo(
    () => [
      { label: "Accueil", value: portfolio.average_reception_rating },
      { label: "Chambre", value: portfolio.average_room_rating },
      { label: "Proprete", value: portfolio.average_cleanliness_rating },
      { label: "Restaurant", value: portfolio.average_restaurant_rating },
      { label: "Bar", value: portfolio.average_bar_rating },
      { label: "Piscine", value: portfolio.average_pool_rating },
      { label: "Spa", value: portfolio.average_spa_rating },
      { label: "Blanchisserie", value: portfolio.average_laundry_rating },
    ],
    [portfolio],
  );

  if (!selectedClient) {
    return null;
  }

  return (
    <div className="table-like clients-satisfaction-tab">
      <div className="clients-summary-grid">
        {summaryCards.map((item) => (
          <PortfolioCard key={item.label} label={item.label} value={item.value} meta={item.meta} />
        ))}
      </div>

      <section className="table-card detail-info-card clients-satisfaction-overview">
        <div className="clients-history-filters__intro">
          <span className="clients-history-filters__eyebrow">Lecture seule</span>
          <strong>Analyse satisfaction client</strong>
          <p>
            Les avis sont soumis par le client depuis l'application externe. La plateforme admin reste volontairement
            en consultation uniquement.
          </p>
        </div>

        <div className="clients-satisfaction-overview__grid">
          <article className="clients-satisfaction-overview__card">
            <span className={`client-status-badge client-status-badge--${tone.tone}`}>{tone.label}</span>
            <strong>{portfolio.total_count || 0} avis exploitable(s)</strong>
            <p>Classement rapide pour reception, direction et pilotage qualite.</p>
          </article>

          <article className="clients-satisfaction-overview__card">
            <span className="client-badge">Dernier avis</span>
            <strong>{latestFeedback ? formatDateTime(latestFeedback.submitted_at) : "-"}</strong>
            <p>{latestFeedback?.stay_reference ? `Lie au sejour ${latestFeedback.stay_reference}.` : "Aucun avis recent."}</p>
          </article>

          <article className="clients-satisfaction-overview__card">
            <span className="client-badge subtle">Recommande l'hotel</span>
            <strong>{portfolio.would_recommend_count || 0}</strong>
            <p>Nombre d'avis indiquant une intention positive de recommandation.</p>
          </article>
        </div>
      </section>

      <section className="table-card detail-info-card clients-satisfaction-services">
        <div className="clients-detail-section-card__head">
          <strong>Evaluation moyenne par service</strong>
        </div>
        <div className="clients-satisfaction-services__grid">
          {serviceCards.map((item) => (
            <article key={item.label} className="clients-satisfaction-service-card">
              <span>{item.label}</span>
              <strong>{formatScore(item.value, "/5")}</strong>
            </article>
          ))}
        </div>
      </section>

      {satisfactions.length ? (
        <div className="table-like">
          {satisfactions.map((item) => (
            <article key={item.id} className="table-card detail-info-card clients-satisfaction-card">
              <div className="clients-consumption-card__head">
                <div>
                  <strong>{normalizeValue(item.reference)}</strong>
                  <p>
                    {formatDateTime(item.submitted_at)} -{" "}
                    {item.stay_reference ? `Sejour ${normalizeValue(item.stay_reference)}` : "Avis global"}
                  </p>
                </div>
                <div className="client-badge-row">
                  <span className="client-badge">{normalizeValue(item.satisfaction_level)}</span>
                  <span className="client-badge subtle">{formatScore(item.overall_rating, "/5")}</span>
                </div>
              </div>

              <div className="clients-consumption-grid">
                <div className="table-row">
                  <strong>Recommandation</strong>
                  <span>{formatScore(item.recommendation_score, "/10")}</span>
                </div>
                <div className="table-row">
                  <strong>Recommande l'hotel</strong>
                  <span>
                    {item.would_recommend === null || item.would_recommend === undefined
                      ? "-"
                      : item.would_recommend
                        ? "Oui"
                        : "Non"}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Statut</strong>
                  <span>{normalizeValue(item.status || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Origine</strong>
                  <span>{normalizeValue(item.source || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Accueil / chambre / proprete</strong>
                  <span>
                    {normalizeValue(item.reception_rating || "-")} / {normalizeValue(item.room_rating || "-")} /{" "}
                    {normalizeValue(item.cleanliness_rating || "-")}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Restaurant / bar / piscine</strong>
                  <span>
                    {normalizeValue(item.restaurant_rating || "-")} / {normalizeValue(item.bar_rating || "-")} /{" "}
                    {normalizeValue(item.pool_rating || "-")}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Spa / blanchisserie</strong>
                  <span>
                    {normalizeValue(item.spa_rating || "-")} / {normalizeValue(item.laundry_rating || "-")}
                  </span>
                </div>
                <div className="table-row">
                  <strong>Points positifs</strong>
                  <span>{normalizeValue(item.positive_points || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Points negatifs</strong>
                  <span>{normalizeValue(item.negative_points || "-")}</span>
                </div>
                <div className="table-row">
                  <strong>Suggestions</strong>
                  <span>{normalizeValue(item.suggestions || "-")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucun avis de satisfaction"
          description="Les feedbacks soumis par les clients via l'application externe apparaitront ici en lecture seule."
        />
      )}
    </div>
  );
}
