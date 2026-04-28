import { useEffect, useState } from "react";

import {
  createPlatformOnboardingBundle,
  getPlatformDashboard,
  listPlatformOrganizations,
  listPlatformSecurityEvents,
  listPlatformSubscriptionPlans,
  runPlatformSubscriptionLifecycle,
} from "../../services/platformAdminService";
import {
  SkeletonSummaryCards,
  SkeletonTwoStackPanels,
  SkeletonStackList,
} from "./PlatformAdminSkeletons";
import { PlatformOnboardingStepper } from "./PlatformOnboardingStepper";
import {
  PlatformNavTabs,
  PlatformBadge,
  PlatformKpiCard,
  PlatformEmptyState,
  IconHotel,
  IconOrg,
  IconSubscription,
  IconUser,
  IconEmptyEvent,
  PLATFORM_LINKS_ALL,
} from "./PlatformAdminComponents";
import "./PlatformAdmin.css";

/* KPI icon variants mapped to summary card labels */
const KPI_CONFIG = {
  "organisations": { iconVariant: "blue",  icon: <IconOrg /> },
  "hotels":        { iconVariant: "teal",  icon: <IconHotel /> },
  "abonnements":   { iconVariant: "amber", icon: <IconSubscription /> },
  "admins":        { iconVariant: "slate", icon: <IconUser /> },
};

function getKpiConfig(label = "") {
  const key = label.toLowerCase();
  for (const [k, v] of Object.entries(KPI_CONFIG)) {
    if (key.includes(k)) return v;
  }
  return { iconVariant: "teal", icon: <IconHotel /> };
}

function ExpiringList({ title, subtitle, items, dateKey }) {
  return (
    <section className="list-panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {items.length ? (
        <div className="platform-admin-stack-list">
          {items.map((item) => (
            <article key={item.id} className="platform-admin-stack-card">
              <div className="platform-admin-stack-top">
                <strong>{item.hotel_name}</strong>
                <span className="platform-admin-code">{item.organization_name}</span>
              </div>
              <p style={{ color: "var(--text-soft)", fontSize: "0.82rem" }}>
                {dateKey === "trial_ends_at" ? "Essai à surveiller" : "Renouvellement à traiter"}
              </p>
              <small className="platform-admin-muted">{item[dateKey] || "—"}</small>
            </article>
          ))}
        </div>
      ) : (
        <PlatformEmptyState
          icon={<IconEmptyEvent />}
          title="Rien à signaler"
          description="Aucune échéance proche n'est remontée pour le moment."
        />
      )}
    </section>
  );
}

export function PlatformDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [onboardingKey, setOnboardingKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadScreen() {
    const [dashboardPayload, eventsPayload, organizationsPayload, plansPayload] = await Promise.all([
      getPlatformDashboard(),
      listPlatformSecurityEvents(),
      listPlatformOrganizations(),
      listPlatformSubscriptionPlans(),
    ]);

    setDashboard(dashboardPayload);
    setEvents(eventsPayload.results || []);
    setOrganizations(organizationsPayload.results || []);
    setPlans(plansPayload.results || []);
  }

  useEffect(() => {
    loadScreen()
      .catch((requestError) => {
        setError(requestError.message || "Impossible de charger la console plateforme.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleLifecycleRun() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await runPlatformSubscriptionLifecycle();
      await loadScreen();
      const lifecycle = response.lifecycle || {};
      setSuccess(
        `Cycle commercial execute: ${lifecycle.suspended_count || 0} suspension(s), ${lifecycle.expired_count || 0} essai(s) expire(s).`,
      );
    } catch (requestError) {
      setError(requestError.message || "Impossible d'executer le cycle commercial.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOnboardingSubmit(formData) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      ...formData,
      organization_id: formData.organization_id ? Number(formData.organization_id) : null,
      plan_id:         formData.plan_id         ? Number(formData.plan_id)         : null,
      starts_at:       formData.starts_at       || null,
      ends_at:         formData.ends_at         || null,
      trial_ends_at:   formData.trial_ends_at   || null,
    };
    if (!payload.organization_id) delete payload.organization_id;

    try {
      const response = await createPlatformOnboardingBundle(payload);
      await loadScreen();
      setOnboardingKey((k) => k + 1);
      setSuccess(
        `Onboarding termine pour ${response.hotel?.name || "le nouvel hotel"} avec admin ${response.user?.username || ""}.`.trim(),
      );
    } catch (requestError) {
      setError(requestError.message || "Impossible de finaliser cet onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack platform-admin-page">
      <section className="dashboard-hero">
        <div className="section-head">
          <div>
            <span className="eyebrow">Plateforme AFRIVO</span>
            <h2>Console plateforme</h2>
            <p>Supervision globale des organisations, hotels, abonnements et acces administrateurs.</p>
          </div>
        </div>
      </section>

      <PlatformNavTabs />

      {loading ? (
        <>
          <SkeletonSummaryCards count={4} />
          <SkeletonTwoStackPanels count={3} />
          <SkeletonTwoStackPanels count={3} />
          <section className="list-panel">
            <SkeletonStackList count={4} />
          </section>
        </>
      ) : null}
      {error ? <div className="alert-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      {!loading && dashboard ? (
        <>
          <section className="hero-panel">
            <span className="eyebrow">Pilotage global</span>
            <h2>{dashboard.title}</h2>
            <p>{dashboard.subtitle}</p>
            <div className="platform-admin-action-row">
              <button type="button" className="primary-button" onClick={handleLifecycleRun} disabled={submitting}>
                {submitting ? "Execution..." : "Executer le cycle commercial"}
              </button>
            </div>
          </section>

          <section className="platform-admin-summary-grid">
            {(dashboard.summary_cards || []).map((card) => {
              const kpi = getKpiConfig(card.label);
              return (
                <PlatformKpiCard
                  key={card.label}
                  icon={kpi.icon}
                  iconVariant={kpi.iconVariant}
                  label={card.label}
                  value={card.value}
                  meta={card.meta}
                  trendVariant="neutral"
                />
              );
            })}
          </section>

          <section className="platform-admin-dashboard-grid">
            <section className="list-panel">
              <div className="panel-head">
                <div>
                  <h3>Etat des abonnements</h3>
                  <p>Lecture immediate des cycles actifs, essais, suspensions et expirations.</p>
                </div>
              </div>
                  <div className="platform-admin-stack-list">
                {(dashboard.subscription_status || []).map((item) => (
                  <article key={item.status} className="platform-admin-stack-card">
                    <div className="platform-admin-stack-top">
                      <strong>{item.label}</strong>
                      <PlatformBadge status={item.status} label={item.label} />
                    </div>
                    <div className="metric">{item.count}</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.82rem" }}>Abonnement(s) actuellement classés dans cet état.</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="list-panel">
              <div className="panel-head">
                <div>
                  <h3>Quotas a surveiller</h3>
                  <p>Reperez les hotels proches de saturation avant l'incident support.</p>
                </div>
              </div>
              <div className="platform-admin-stack-list">
                {(dashboard.quota_highlights || []).map((item) => (
                  <article key={item.label} className="platform-admin-stack-card">
                    <div className="platform-admin-stack-top">
                      <strong>{item.label}</strong>
                      <div className="metric">{item.value}</div>
                    </div>
                    <p>{item.meta}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="platform-admin-dashboard-grid">
            <ExpiringList
              title="Essais expirants"
              subtitle="Hotels encore en essai dont la fenetre commerciale arrive a terme."
              items={dashboard.expiring_trials || []}
              dateKey="trial_ends_at"
            />
            <ExpiringList
              title="Abonnements a renouveler"
              subtitle="Contrats actifs proches de l'echeance pour le suivi commercial."
              items={dashboard.expiring_subscriptions || []}
              dateKey="ends_at"
            />
          </section>

          <section className="list-panel">
            <div className="panel-head">
              <div>
                <h3>Onboarding complet SaaS</h3>
                <p>Creation en une seule operation d'une organisation, d'un hotel, de son admin et de son abonnement.</p>
              </div>
            </div>
            <PlatformOnboardingStepper
              key={onboardingKey}
              organizations={organizations}
              plans={plans}
              onSubmit={handleOnboardingSubmit}
              submitting={submitting}
            />
          </section>

          <section className="list-panel">
            <div className="panel-head">
              <div>
                <h3>Derniers evenements securite</h3>
                <p>Journal plateforme recent pour le support, l'audit et la supervision.</p>
              </div>
            </div>
            {events.length ? (
              <div className="platform-admin-stack-list">
                {events.slice(0, 6).map((eventItem) => (
                  <article key={eventItem.id} className="platform-admin-stack-card">
                    <div className="platform-admin-stack-top">
                      <strong>{eventItem.event_label}</strong>
                      <span className="platform-admin-code">{eventItem.created_at_display || "-"}</span>
                    </div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.82rem" }}>{eventItem.target_label || "Cible non renseignée"}</p>
                    <small className="platform-admin-muted">
                      {(eventItem.actor_name || "Système")} · {(eventItem.target_type || "Global")}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconEmptyEvent />}
                title="Aucun événement récent"
                description="Le journal plateforme sera alimenté par les futures actions sensibles et le support."
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
