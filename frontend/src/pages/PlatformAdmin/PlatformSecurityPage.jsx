import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../components/AppSelect";
import {
  createPlatformSecurityReview,
  listPlatformSecurityEventsFiltered,
} from "../../services/platformAdminService";
import {
  IconEmptyEvent,
  PlatformBadge,
  PlatformEmptyState,
  PlatformNavTabs,
} from "./PlatformAdminComponents";
import { SkeletonStackList } from "./PlatformAdminSkeletons";
import "./PlatformAdmin.css";

const EVENT_OPTIONS = [
  { value: "", label: "Tous les evenements" },
  { value: "organization_created", label: "Organisation creee" },
  { value: "hotel_created", label: "Hotel cree" },
  { value: "hotel_suspended", label: "Hotel suspendu" },
  { value: "hotel_reactivated", label: "Hotel reactive" },
  { value: "subscription_created", label: "Abonnement cree" },
  { value: "subscription_updated", label: "Abonnement mis a jour" },
  { value: "user_linked", label: "Admin hotel cree" },
  { value: "security_review", label: "Revue securite" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Toutes les cibles" },
  { value: "Organization", label: "Organisation" },
  { value: "Hotel", label: "Hotel" },
  { value: "HotelSubscription", label: "Abonnement" },
  { value: "SubscriptionPlan", label: "Plan" },
  { value: "User", label: "Utilisateur" },
];

const REVIEW_SEVERITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const EMPTY_REVIEW_FORM = {
  target_type: "Hotel",
  target_id: "",
  target_label: "",
  note: "",
  severity: "info",
};

export function PlatformSecurityPage() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadEvents() {
    const payload = await listPlatformSecurityEventsFiltered({
      event_type: eventFilter,
      target_type: targetTypeFilter,
      search,
      limit: 40,
    });
    setEvents(payload.results || []);
  }

  useEffect(() => {
    setLoading(true);
    loadEvents()
      .catch((requestError) => {
        setError(requestError.message || "Impossible de charger les evenements securite.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventFilter, targetTypeFilter]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((item) => {
      if (!term) {
        return true;
      }
      return [item.event_label, item.target_label, item.actor_name, item.target_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [events, search]);

  function handleReviewChange(event) {
    const { name, value } = event.target;
    setReviewForm((current) => ({ ...current, [name]: value }));
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await createPlatformSecurityReview({
        ...reviewForm,
        target_id: reviewForm.target_id ? Number(reviewForm.target_id) : null,
      });
      setReviewForm(EMPTY_REVIEW_FORM);
      setSuccess("Revue securite enregistree.");
      await loadEvents();
    } catch (requestError) {
      setError(requestError.message || "Impossible d'enregistrer la revue securite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack platform-admin-page">
      <section className="hero-panel">
        <span className="eyebrow">Plateforme</span>
        <h2>Support et securite</h2>
        <p>Journal filtrable, revue manuelle et lecture support des actions sensibles plateforme.</p>
      </section>

      <PlatformNavTabs />

      <section className="platform-admin-dashboard-grid">
        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Filtres support</h3>
              <p>Affinez les evenements plateforme par type, cible et recherche libre.</p>
            </div>
          </div>
          <div className="platform-admin-toolbar">
            <input
              className="filter-input"
              placeholder="Rechercher par evenement, acteur ou cible"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <AppSelect value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
              {EVENT_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
            <AppSelect value={targetTypeFilter} onChange={(event) => setTargetTypeFilter(event.target.value)}>
              {TARGET_TYPE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </div>
        </section>

        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Revue securite</h3>
              <p>Tracez une revue manuelle, un incident, ou une verification support.</p>
            </div>
          </div>
          <form className="platform-admin-grid-form" onSubmit={handleReviewSubmit}>
            <AppSelect
              name="target_type"
              value={reviewForm.target_type}
              onChange={handleReviewChange}
              disabled={submitting}
            >
              {TARGET_TYPE_OPTIONS.filter((item) => item.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
            <input
              className="filter-input"
              name="target_id"
              placeholder="ID cible optionnel"
              value={reviewForm.target_id}
              onChange={handleReviewChange}
              disabled={submitting}
            />
            <input
              className="filter-input"
              name="target_label"
              placeholder="Libelle cible"
              value={reviewForm.target_label}
              onChange={handleReviewChange}
              disabled={submitting}
              required
            />
            <AppSelect
              name="severity"
              value={reviewForm.severity}
              onChange={handleReviewChange}
              disabled={submitting}
            >
              {REVIEW_SEVERITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
            <textarea
              className="filter-input platform-admin-textarea"
              name="note"
              placeholder="Note de revue securite"
              value={reviewForm.note}
              onChange={handleReviewChange}
              disabled={submitting}
              required
            />
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer la revue"}
            </button>
          </form>
        </section>
      </section>

      {loading ? (
        <section className="list-panel">
          <SkeletonStackList count={6} />
        </section>
      ) : null}
      {error ? <div className="alert-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      {!loading && !error ? (
        <section className="list-panel">
          {filteredEvents.length ? (
            <div className="platform-admin-stack-list">
              {filteredEvents.map((item) => {
                const severity =
                  item.metadata?.severity || (item.event_type === "security_review" ? "warning" : "info");
                return (
                  <article key={item.id} className="platform-admin-stack-card">
                    <div className="platform-admin-stack-top">
                      <strong>{item.event_label}</strong>
                      <span className="platform-admin-code">{item.created_at_display || "-"}</span>
                    </div>
                    <div className="platform-admin-badge-row">
                      <PlatformBadge status={severity} label={severity} />
                      <PlatformBadge status="neutral" label={item.target_type || "Global"} />
                    </div>
                    <div className="platform-admin-inline-stats">
                      <span><strong>Acteur</strong>{item.actor_name || "Systeme"}</span>
                      <span><strong>Cible</strong>{item.target_label || "Aucune cible"}</span>
                    </div>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>
                      {item.metadata?.note || item.target_label || "Aucune note detaillee."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <PlatformEmptyState
              icon={<IconEmptyEvent />}
              title="Aucun evenement trouve"
              description="Le journal s'enrichira au fur et a mesure des actions sensibles plateforme."
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
