import { useEffect, useMemo, useRef, useState } from "react";

import { AppSelect } from "../../components/AppSelect";
import { DateTimePicker } from "../../components/DateTimePicker";
import {
  changePlatformSubscriptionPlan,
  createPlatformSubscription,
  createPlatformSubscriptionPlan,
  listPlatformHotels,
  listPlatformSubscriptionPlans,
  listPlatformSubscriptions,
  renewPlatformSubscription,
  runPlatformSubscriptionLifecycle,
  updatePlatformSubscription,
  updatePlatformSubscriptionPlan,
} from "../../services/platformAdminService";
import { SkeletonDashboardGrid } from "./PlatformAdminSkeletons";
import {
  PlatformNavTabs,
  PlatformBadge,
  PlatformKpiCard,
  PlatformEntityCell,
  PlatformEmptyState,
  IconSubscription,
  IconHotel,
  IconEmptyHotel,
} from "./PlatformAdminComponents";
import "./PlatformAdmin.css";

const STATUS_OPTIONS = [
  { value: "all",       label: "Tous les statuts" },
  { value: "active",    label: "Actifs" },
  { value: "trial",     label: "Essais" },
  { value: "suspended", label: "Suspendus" },
  { value: "expired",   label: "Expirés" },
  { value: "cancelled", label: "Annulés" },
];

const BILLING_CYCLES = [
  { value: "monthly", label: "Mensuel" },
  { value: "yearly",  label: "Annuel" },
  { value: "custom",  label: "Personnalisé" },
];

const SUBSCRIPTION_STATUSES = [
  { value: "draft",     label: "Brouillon" },
  { value: "trial",     label: "Essai" },
  { value: "active",    label: "Actif" },
  { value: "suspended", label: "Suspendu" },
  { value: "expired",   label: "Expiré" },
  { value: "cancelled", label: "Annulé" },
];

const EMPTY_SUBSCRIPTION_FORM = {
  hotel_id:      "",
  plan_id:       "",
  status:        "active",
  starts_at:     "",
  ends_at:       "",
  trial_ends_at: "",
  billing_cycle: "monthly",
  notes:         "",
};

const EMPTY_PLAN_FORM = {
  code:          "",
  name:          "",
  description:   "",
  monthly_price: "0.00",
  yearly_price:  "0.00",
  max_hotels:    "1",
  max_users:     "5",
  is_active:     true,
};

const EMPTY_RENEW_FORM = {
  duration_days: "30",
  note:          "",
};

const EMPTY_CHANGE_PLAN_FORM = {
  plan_id: "",
  note:    "",
};

/* FIX #2 — durée auto-dismiss des notifications */
const AUTO_DISMISS_MS = 4000;

/* FIX #2 — spinner SVG réutilisable */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <circle
        cx="7" cy="7" r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="20 10"
      />
    </svg>
  );
}

function normalizeStatus(status) {
  return String(status || "neutral").toLowerCase();
}

function quotaStatusLabel(status) {
  if (status === "critical")  return "Hors quota";
  if (status === "warning")   return "Quota à surveiller";
  if (status === "unlimited") return "Sans limite";
  return "Quota sain";
}

export function PlatformSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [hotels, setHotels]               = useState([]);
  const [plans, setPlans]                 = useState([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(null);
  const [selectedPlanId, setSelectedPlanId]                 = useState(null);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subscriptionForm, setSubscriptionForm] = useState(EMPTY_SUBSCRIPTION_FORM);
  const [planForm, setPlanForm]               = useState(EMPTY_PLAN_FORM);
  const [renewForm, setRenewForm]             = useState(EMPTY_RENEW_FORM);
  const [changePlanForm, setChangePlanForm]   = useState(EMPTY_CHANGE_PLAN_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  /* FIX #5 — un état de chargement par action, pas un état global partagé */
  const [submittingSubscription, setSubmittingSubscription] = useState(false);
  const [submittingPlan,         setSubmittingPlan]         = useState(false);
  const [submittingRenew,        setSubmittingRenew]        = useState(false);
  const [submittingChangePlan,   setSubmittingChangePlan]   = useState(false);
  const [submittingLifecycle,    setSubmittingLifecycle]    = useState(false);

  /* FIX #1 — timers auto-dismiss */
  const errorTimerRef   = useRef(null);
  const successTimerRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(errorTimerRef.current);
    clearTimeout(successTimerRef.current);
  }, []);

  function showError(msg) {
    clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = window.setTimeout(() => setError(""), AUTO_DISMISS_MS);
  }

  function showSuccess(msg) {
    clearTimeout(successTimerRef.current);
    setSuccess(msg);
    successTimerRef.current = window.setTimeout(() => setSuccess(""), AUTO_DISMISS_MS);
  }

  async function loadScreen(
    preferredSubscriptionId = selectedSubscriptionId,
    preferredPlanId = selectedPlanId,
  ) {
    const [subscriptionsPayload, hotelsPayload, plansPayload] = await Promise.all([
      listPlatformSubscriptions(),
      listPlatformHotels(),
      listPlatformSubscriptionPlans(),
    ]);

    const nextSubscriptions = subscriptionsPayload.results || [];
    const nextHotels        = hotelsPayload.results || [];
    const nextPlans         = plansPayload.results || [];
    setSubscriptions(nextSubscriptions);
    setHotels(nextHotels);
    setPlans(nextPlans);

    const nextSelectedSubscriptionId =
      preferredSubscriptionId && nextSubscriptions.some((item) => item.id === preferredSubscriptionId)
        ? preferredSubscriptionId
        : nextSubscriptions[0]?.id || null;
    const nextSelectedPlanId =
      preferredPlanId && nextPlans.some((item) => item.id === preferredPlanId)
        ? preferredPlanId
        : nextPlans[0]?.id || null;

    setSelectedSubscriptionId(nextSelectedSubscriptionId);
    setSelectedPlanId(nextSelectedPlanId);
  }

  useEffect(() => {
    loadScreen()
      .catch((requestError) => {
        showError(requestError.message || "Impossible de charger les abonnements.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredSubscriptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subscriptions.filter((item) => {
      const matchesSearch =
        !term
        || [item.organization_name, item.hotel_name, item.hotel_code, item.plan_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const selectedSubscription =
    filteredSubscriptions.find((item) => item.id === selectedSubscriptionId)
    || subscriptions.find((item) => item.id === selectedSubscriptionId)
    || null;

  const selectedPlan = plans.find((item) => item.id === selectedPlanId) || null;

  useEffect(() => {
    if (selectedSubscription) {
      setSubscriptionForm({
        hotel_id:      String(selectedSubscription.hotel),
        plan_id:       String(selectedSubscription.plan),
        status:        selectedSubscription.status || "active",
        starts_at:     selectedSubscription.starts_at     ? selectedSubscription.starts_at.slice(0, 16)     : "",
        ends_at:       selectedSubscription.ends_at       ? selectedSubscription.ends_at.slice(0, 16)       : "",
        trial_ends_at: selectedSubscription.trial_ends_at ? selectedSubscription.trial_ends_at.slice(0, 16) : "",
        billing_cycle: selectedSubscription.billing_cycle || "monthly",
        notes:         selectedSubscription.notes || "",
      });
      setChangePlanForm({
        plan_id: String(selectedSubscription.plan || ""),
        note:    "",
      });
      setRenewForm(EMPTY_RENEW_FORM);
      return;
    }

    setSubscriptionForm(EMPTY_SUBSCRIPTION_FORM);
    setChangePlanForm(EMPTY_CHANGE_PLAN_FORM);
  }, [selectedSubscription?.id, hotels.length, plans.length]);

  useEffect(() => {
    if (selectedPlan) {
      setPlanForm({
        code:          selectedPlan.code        || "",
        name:          selectedPlan.name        || "",
        description:   selectedPlan.description || "",
        monthly_price: String(selectedPlan.monthly_price ?? "0.00"),
        yearly_price:  String(selectedPlan.yearly_price  ?? "0.00"),
        max_hotels:    String(selectedPlan.max_hotels ?? 1),
        max_users:     String(selectedPlan.max_users  ?? 5),
        is_active:     Boolean(selectedPlan.is_active),
      });
      return;
    }
    setPlanForm(EMPTY_PLAN_FORM);
  }, [selectedPlan?.id]);

  function handleSubscriptionFormChange(event) {
    const { name, value } = event.target;
    setSubscriptionForm((current) => ({ ...current, [name]: value }));
  }

  function handlePlanFormChange(event) {
    const { name, value } = event.target;
    setPlanForm((current) => ({
      ...current,
      [name]: name === "is_active" ? value === "true" : value,
    }));
  }

  function handleRenewFormChange(event) {
    const { name, value } = event.target;
    setRenewForm((current) => ({ ...current, [name]: value }));
  }

  function handleChangePlanFormChange(event) {
    const { name, value } = event.target;
    setChangePlanForm((current) => ({ ...current, [name]: value }));
  }

  function selectedHotelOrganizationId(hotelId) {
    const hotel = hotels.find((item) => String(item.id) === String(hotelId));
    return hotel?.organization || null;
  }

  /* FIX #5 — chaque handler utilise son propre état de soumission */
  /* FIX i1 — validation : hôtel et plan obligatoires */
  const canSubmitSubscription = Boolean(
    subscriptionForm.hotel_id && subscriptionForm.plan_id && !submittingSubscription
  );

  async function handleSubscriptionSubmit(event) {
    event.preventDefault();
    if (!canSubmitSubscription) return;

    setSubmittingSubscription(true);
    setError("");
    setSuccess("");

    const payload = {
      organization_id: selectedHotelOrganizationId(subscriptionForm.hotel_id),
      hotel_id:        Number(subscriptionForm.hotel_id),
      plan_id:         Number(subscriptionForm.plan_id),
      status:          subscriptionForm.status,
      starts_at:       subscriptionForm.starts_at     || null,
      ends_at:         subscriptionForm.ends_at       || null,
      trial_ends_at:   subscriptionForm.trial_ends_at || null,
      billing_cycle:   subscriptionForm.billing_cycle,
      notes:           subscriptionForm.notes,
    };

    try {
      if (selectedSubscription) {
        await updatePlatformSubscription(selectedSubscription.id, payload);
        /* FIX #2 — messages avec accents corrects + auto-dismiss */
        showSuccess("Abonnement mis à jour.");
        await loadScreen(selectedSubscription.id, selectedPlanId);
      } else {
        const response = await createPlatformSubscription(payload);
        showSuccess("Abonnement créé.");
        await loadScreen(response.subscription?.id || null, selectedPlanId);
      }
    } catch (requestError) {
      showError(requestError.message || "Impossible d'enregistrer cet abonnement.");
    } finally {
      setSubmittingSubscription(false);
    }
  }

  /* p5 — validation canSubmitPlan */
  const canSubmitPlan = Boolean(
    planForm.code.trim() &&
    planForm.name.trim() &&
    !submittingPlan
  );

  async function handlePlanSubmit(event) {
    event.preventDefault();
    if (!canSubmitPlan) return;

    /* p2/p3 — validation numérique côté client */
    const monthlyPrice = parseFloat(planForm.monthly_price);
    const yearlyPrice  = parseFloat(planForm.yearly_price);
    const maxHotels    = parseInt(planForm.max_hotels, 10);
    const maxUsers     = parseInt(planForm.max_users,  10);

    if (isNaN(monthlyPrice) || monthlyPrice < 0) {
      showError("Le prix mensuel doit être un nombre positif.");
      return;
    }
    if (isNaN(yearlyPrice) || yearlyPrice < 0) {
      showError("Le prix annuel doit être un nombre positif.");
      return;
    }
    if (isNaN(maxHotels) || maxHotels < 1) {
      showError("Le quota hôtels doit être au moins 1.");
      return;
    }
    if (isNaN(maxUsers) || maxUsers < 1) {
      showError("Le quota utilisateurs doit être au moins 1.");
      return;
    }

    setSubmittingPlan(true);
    setError("");
    setSuccess("");

    const payload = {
      ...planForm,
      monthly_price: monthlyPrice,
      yearly_price:  yearlyPrice,
      max_hotels:    maxHotels,
      max_users:     maxUsers,
    };

    try {
      if (selectedPlan) {
        await updatePlatformSubscriptionPlan(selectedPlan.id, payload);
        /* FIX #2 */
        showSuccess("Plan mis à jour.");
        await loadScreen(selectedSubscriptionId, selectedPlan.id);
      } else {
        const response = await createPlatformSubscriptionPlan(payload);
        showSuccess("Plan créé.");
        await loadScreen(selectedSubscriptionId, response.plan?.id || null);
      }
    } catch (requestError) {
      showError(requestError.message || "Impossible d'enregistrer ce plan.");
    } finally {
      setSubmittingPlan(false);
    }
  }

  async function handleRenewSubmit(event) {
    event.preventDefault();
    if (!selectedSubscription || submittingRenew) return;

    setSubmittingRenew(true);
    setError("");
    setSuccess("");

    try {
      const response = await renewPlatformSubscription(selectedSubscription.id, {
        duration_days: Number(renewForm.duration_days),
        note:          renewForm.note,
      });
      /* FIX #2 */
      showSuccess("Abonnement renouvelé.");
      setRenewForm(EMPTY_RENEW_FORM);
      await loadScreen(response.subscription?.id || selectedSubscription.id, selectedPlanId);
    } catch (requestError) {
      showError(requestError.message || "Impossible de renouveler cet abonnement.");
    } finally {
      setSubmittingRenew(false);
    }
  }

  async function handleChangePlanSubmit(event) {
    event.preventDefault();
    if (!selectedSubscription || submittingChangePlan) return;

    setSubmittingChangePlan(true);
    setError("");
    setSuccess("");

    try {
      const response = await changePlatformSubscriptionPlan(selectedSubscription.id, {
        plan_id: Number(changePlanForm.plan_id),
        note:    changePlanForm.note,
      });
      /* FIX #2 */
      const kindLabel = response.change_kind === "upgrade"
        ? "Plan mis à niveau (upgrade)."
        : response.change_kind === "downgrade"
          ? "Plan rétrogradé (downgrade)."
          : "Plan mis à jour.";
      showSuccess(kindLabel);
      await loadScreen(
        response.subscription?.id || selectedSubscription.id,
        Number(changePlanForm.plan_id),
      );
    } catch (requestError) {
      showError(requestError.message || "Impossible de changer ce plan.");
    } finally {
      setSubmittingChangePlan(false);
    }
  }

  async function handleRunLifecycle() {
    if (submittingLifecycle) return;

    setSubmittingLifecycle(true);
    setError("");
    setSuccess("");

    try {
      const response = await runPlatformSubscriptionLifecycle();
      await loadScreen(selectedSubscriptionId, selectedPlanId);
      const lifecycle = response.lifecycle || {};
      /* FIX #2 */
      showSuccess(
        `Cycle commercial exécuté : ${lifecycle.suspended_count || 0} suspension(s), ${lifecycle.expired_count || 0} essai(s) expiré(s).`,
      );
    } catch (requestError) {
      showError(requestError.message || "Impossible d'exécuter le cycle commercial.");
    } finally {
      setSubmittingLifecycle(false);
    }
  }

  function handleNewPlan() {
    setSelectedPlanId(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setSuccess("");
    setError("");
  }

  function handleNewSubscription() {
    setSelectedSubscriptionId(null);
    setSubscriptionForm(EMPTY_SUBSCRIPTION_FORM);
    setSuccess("");
    setError("");
  }

  /* Dérivé : au moins une action en cours (pour désactiver les boutons secondaires) */
  const anySubmitting =
    submittingSubscription ||
    submittingPlan         ||
    submittingRenew        ||
    submittingChangePlan   ||
    submittingLifecycle;

  return (
    <div className="page-stack platform-admin-page">
      <section className="hero-panel">
        <span className="eyebrow">Plateforme</span>
        {/* FIX #2 — accents */}
        <h2>Abonnements, plans et quotas</h2>
        <p>Gestion contractuelle des plans AFRIVO, des quotas et des abonnements hôtels.</p>
      </section>

      <PlatformNavTabs />

      <section className="platform-admin-dashboard-grid">
        {/* ── Formulaire abonnement ─────────────────────────────── */}
        <section className="list-panel">
          <div className="panel-head">
            <div>
              {/* FIX #2 — accents */}
              <h3>{selectedSubscription ? "Mettre à jour un abonnement" : "Affecter un abonnement"}</h3>
              <p>Création ou mise à jour du contrat commercial rattaché à un hôtel.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleNewSubscription}
              disabled={submittingSubscription}
            >
              Nouvel abonnement
            </button>
          </div>

          {/* FIX i3 — labels visibles sur tous les champs + grille 2 colonnes lisible */}
          <form
            className="platform-admin-grid-form"
            onSubmit={handleSubscriptionSubmit}
            aria-busy={submittingSubscription}
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
          >
            {/* Hôtel */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-hotel">Hôtel</span>
              <AppSelect
                name="hotel_id"
                value={subscriptionForm.hotel_id}
                onChange={handleSubscriptionFormChange}
                disabled={submittingSubscription}
                aria-labelledby="label-hotel"
                invalid={!subscriptionForm.hotel_id && subscriptionForm.hotel_id !== undefined}
              >
                <option value="">Choisir un hôtel</option>
                {hotels.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name} — {item.organization_name}
                  </option>
                ))}
              </AppSelect>
            </div>

            {/* Plan */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-plan-sub">Plan</span>
              <AppSelect
                name="plan_id"
                value={subscriptionForm.plan_id}
                onChange={handleSubscriptionFormChange}
                disabled={submittingSubscription}
                aria-labelledby="label-plan-sub"
                invalid={!subscriptionForm.plan_id}
              >
                <option value="">Choisir un plan</option>
                {plans.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </AppSelect>
            </div>

            {/* Statut */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-sub-status">Statut</span>
              <AppSelect
                name="status"
                value={subscriptionForm.status}
                onChange={handleSubscriptionFormChange}
                disabled={submittingSubscription}
                aria-labelledby="label-sub-status"
              >
                {SUBSCRIPTION_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </div>

            {/* Cycle de facturation */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-billing">Cycle de facturation</span>
              <AppSelect
                name="billing_cycle"
                value={subscriptionForm.billing_cycle}
                onChange={handleSubscriptionFormChange}
                disabled={submittingSubscription}
                aria-labelledby="label-billing"
              >
                {BILLING_CYCLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </AppSelect>
            </div>

            {/* Date de début */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-starts">Date de début</span>
              <DateTimePicker
                name="starts_at"
                value={subscriptionForm.starts_at}
                onChange={handleSubscriptionFormChange}
                aria-labelledby="label-starts"
              />
            </div>

            {/* Fin période d'essai */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-trial">Fin période d'essai</span>
              <DateTimePicker
                name="trial_ends_at"
                value={subscriptionForm.trial_ends_at}
                onChange={handleSubscriptionFormChange}
                aria-labelledby="label-trial"
              />
            </div>

            {/* Date de fin */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-ends">Date de fin</span>
              <DateTimePicker
                name="ends_at"
                value={subscriptionForm.ends_at}
                onChange={handleSubscriptionFormChange}
                aria-labelledby="label-ends"
              />
            </div>

            {/* Notes — pleine largeur */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
              <span className="platform-admin-form-label" id="label-notes-sub">Notes contrat</span>
              <textarea
                className="filter-input platform-admin-textarea"
                name="notes"
                placeholder="Notes internes, conditions particulières…"
                aria-labelledby="label-notes-sub"
                value={subscriptionForm.notes}
                onChange={handleSubscriptionFormChange}
                disabled={submittingSubscription}
              />
            </div>

            {/* FIX i1+i5 — disabled sur canSubmitSubscription + pleine largeur */}
            <button
              type="submit"
              className="primary-button"
              disabled={!canSubmitSubscription}
              aria-busy={submittingSubscription}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}
            >
              {submittingSubscription ? (
                <><Spinner />Enregistrement…</>
              ) : selectedSubscription ? (
                "Mettre à jour"
              ) : (
                "Créer l'abonnement"
              )}
            </button>
          </form>

          {/* FIX #8 — séparateur entre label et valeur dans inline-stats */}
          {selectedSubscription ? (
            <div className="platform-admin-inline-stats">
              <span><strong>Plan : </strong>{selectedSubscription.plan_name}</span>
              <span><strong>Utilisateurs actifs : </strong>{selectedSubscription.active_user_count || 0}</span>
              <span><strong>Quota : </strong>{selectedSubscription.plan_max_users != null ? selectedSubscription.plan_max_users : "Illimité"}</span>
              <span><strong>État quota : </strong>{quotaStatusLabel(selectedSubscription.user_quota_status)}</span>
            </div>
          ) : null}
        </section>

        {/* ── Formulaire plan ───────────────────────────────────── */}
        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>{selectedPlan ? "Mettre à jour un plan" : "Créer un plan"}</h3>
              <p>Définition des quotas hôtels et utilisateurs par offre AFRIVO.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleNewPlan}
              disabled={submittingPlan}
            >
              Nouveau plan
            </button>
          </div>

          {/* p1 — labels visibles, p4 — ordre réorganisé, p2/p3 — type=number, grille 2 cols */}
          <form
            className="platform-admin-grid-form"
            onSubmit={handlePlanSubmit}
            aria-busy={submittingPlan}
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
          >
            {/* ── Identité ── */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-plan-code">Code</span>
              <input
                className="filter-input"
                name="code"
                placeholder="ex. STARTER"
                aria-labelledby="label-plan-code"
                value={planForm.code}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
                required
              />
            </div>

            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-plan-name">Nom du plan</span>
              <input
                className="filter-input"
                name="name"
                placeholder="ex. Starter"
                aria-labelledby="label-plan-name"
                value={planForm.name}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
                required
              />
            </div>

            {/* p4 — Statut en 3e position, après les infos d'identité */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
              <span className="platform-admin-form-label" id="label-plan-active">Statut</span>
              <AppSelect
                name="is_active"
                value={String(planForm.is_active)}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
                aria-labelledby="label-plan-active"
              >
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </AppSelect>
            </div>

            {/* ── Tarification ── */}
            {/* p2 — type=number, min=0, step=0.01 */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-monthly">Prix mensuel (FCFA)</span>
              <input
                className="filter-input"
                type="number"
                name="monthly_price"
                placeholder="0"
                min="0"
                step="0.01"
                aria-labelledby="label-monthly"
                value={planForm.monthly_price}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
              />
            </div>

            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-yearly">Prix annuel (FCFA)</span>
              <input
                className="filter-input"
                type="number"
                name="yearly_price"
                placeholder="0"
                min="0"
                step="0.01"
                aria-labelledby="label-yearly"
                value={planForm.yearly_price}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
              />
            </div>

            {/* ── Quotas ── */}
            {/* p3 — type=number, min=1, step=1 */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-max-hotels">Quota hôtels</span>
              <input
                className="filter-input"
                type="number"
                name="max_hotels"
                placeholder="1"
                min="1"
                step="1"
                aria-labelledby="label-max-hotels"
                value={planForm.max_hotels}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
              />
            </div>

            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="platform-admin-form-label" id="label-max-users">Quota utilisateurs</span>
              <input
                className="filter-input"
                type="number"
                name="max_users"
                placeholder="5"
                min="1"
                step="1"
                aria-labelledby="label-max-users"
                value={planForm.max_users}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
              />
            </div>

            {/* ── Description — pleine largeur ── */}
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
              <span className="platform-admin-form-label" id="label-plan-desc">Description</span>
              <textarea
                className="filter-input platform-admin-textarea"
                name="description"
                placeholder="Fonctionnalités incluses, conditions particulières…"
                aria-labelledby="label-plan-desc"
                value={planForm.description}
                onChange={handlePlanFormChange}
                disabled={submittingPlan}
              />
            </div>

            {/* p5 — canSubmitPlan + gridColumn pleine largeur */}
            <button
              type="submit"
              className="primary-button"
              disabled={!canSubmitPlan}
              aria-busy={submittingPlan}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}
            >
              {submittingPlan ? (
                <><Spinner />Enregistrement…</>
              ) : selectedPlan ? (
                "Mettre à jour le plan"
              ) : (
                "Créer le plan"
              )}
            </button>
          </form>
        </section>
      </section>

      {/* ── Actions commerciales ────────────────────────────────── */}
      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Actions commerciales</h3>
            <p>Renouvellement, upgrade ou downgrade du plan, et exécution manuelle du cycle commercial.</p>
          </div>
          {/* FIX #2 + FIX #5 — spinner isolé sur le bouton lifecycle */}
          <button
            type="button"
            className="secondary-button"
            onClick={handleRunLifecycle}
            disabled={submittingLifecycle}
            aria-busy={submittingLifecycle}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {submittingLifecycle ? <><Spinner />Exécution…</> : "Exécuter le cycle"}
          </button>
        </div>

        {selectedSubscription ? (
          <div className="platform-admin-dashboard-grid">
            {/* Renouvellement */}
            <form
              className="platform-admin-grid-form"
              onSubmit={handleRenewSubmit}
              aria-busy={submittingRenew}
            >
              <input
                className="filter-input"
                name="duration_days"
                placeholder="Durée en jours"
                aria-label="Durée du renouvellement en jours"
                value={renewForm.duration_days}
                onChange={handleRenewFormChange}
                disabled={submittingRenew}
                required
              />
              <textarea
                className="filter-input platform-admin-textarea"
                name="note"
                placeholder="Note de renouvellement"
                aria-label="Note de renouvellement"
                value={renewForm.note}
                onChange={handleRenewFormChange}
                disabled={submittingRenew}
              />
              {/* FIX #2 + FIX #5 */}
              <button
                type="submit"
                className="primary-button"
                disabled={submittingRenew}
                aria-busy={submittingRenew}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {submittingRenew ? <><Spinner />Renouvellement…</> : "Renouveler cet abonnement"}
              </button>
            </form>

            {/* Changement de plan */}
            <form
              className="platform-admin-grid-form"
              onSubmit={handleChangePlanSubmit}
              aria-busy={submittingChangePlan}
            >
              <AppSelect
                name="plan_id"
                value={changePlanForm.plan_id}
                onChange={handleChangePlanFormChange}
                disabled={submittingChangePlan}
                aria-label="Choisir un nouveau plan"
              >
                <option value="">Choisir un nouveau plan</option>
                {plans.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </AppSelect>
              <textarea
                className="filter-input platform-admin-textarea"
                name="note"
                placeholder="Note de changement de plan"
                aria-label="Note de changement de plan"
                value={changePlanForm.note}
                onChange={handleChangePlanFormChange}
                disabled={submittingChangePlan}
              />
              {/* FIX #2 + FIX #5 */}
              <button
                type="submit"
                className="primary-button"
                disabled={submittingChangePlan}
                aria-busy={submittingChangePlan}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {submittingChangePlan
                  ? <><Spinner />Changement…</>
                  : "Appliquer le changement de plan"
                }
              </button>
            </form>
          </div>
        ) : (
          <PlatformEmptyState
            icon={<IconSubscription />}
            title="Aucun abonnement sélectionné"
            description="Choisissez un abonnement dans la liste pour lancer un renouvellement ou changer de plan."
          />
        )}
      </section>

      {/* ── Toolbar recherche ───────────────────────────────────── */}
      <section className="list-panel">
        <div className="platform-admin-toolbar">
          {/* FIX #7 — aria-label sur l'input de recherche */}
          <input
            className="filter-input"
            placeholder="Rechercher par organisation, hôtel ou plan"
            aria-label="Rechercher un abonnement"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {/* FIX #7 — aria-label sur le filtre statut */}
          <AppSelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filtrer par statut"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {loading ? <SkeletonDashboardGrid leftRows={6} leftCols={6} rightCount={3} /> : null}

      {/* FIX #1 — role ARIA + auto-dismiss (géré via showError/showSuccess) */}
      {error ? (
        <div className="alert-box" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="success-box" role="status" aria-live="polite" aria-atomic="true">
          {success}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="platform-admin-dashboard-grid">
          {/* ── Table abonnements ─────────────────────────────── */}
          <section className="list-panel">
            <div className="panel-head">
              <div>
                {/* FIX #2 — accents */}
                <h3>Abonnements hôtels</h3>
                <p>Lecture opérationnelle du parc contractuel AFRIVO.</p>
              </div>
            </div>

            {filteredSubscriptions.length ? (
              <div className="platform-admin-table-wrap">
                <table className="platform-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Hôtel</th>
                      <th scope="col">Organisation</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Quota</th>
                      <th scope="col">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscriptions.map((item) => (
                      /* FIX #3 — accessibilité clavier + affordance visuelle */
                      <tr
                        key={item.id}
                        className={selectedSubscription?.id === item.id ? "active" : ""}
                        onClick={() => setSelectedSubscriptionId(item.id)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selectedSubscription?.id === item.id}
                        aria-label={`Sélectionner l'abonnement de ${item.hotel_name || "cet hôtel"}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSubscriptionId(item.id);
                          }
                        }}
                      >
                        <td>
                          <PlatformEntityCell
                            name={item.hotel_name || "—"}
                            sub={item.hotel_code  || "—"}
                            status={normalizeStatus(item.status)}
                          />
                        </td>
                        <td>{item.organization_name || "—"}</td>
                        <td>{item.plan_name || "Sans plan"}</td>
                        <td>
                          <PlatformBadge
                            status={normalizeStatus(item.status)}
                            label={item.status_label || item.status}
                          />
                        </td>
                        <td>
                          <PlatformBadge
                            status={item.user_quota_status || "neutral"}
                            label={`${item.active_user_count || 0}/${item.plan_max_users || "∞"}`}
                          />
                        </td>
                        <td>{item.ends_at_display || item.trial_ends_at_display || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconEmptyHotel />}
                title="Aucun abonnement trouvé"
                description="La liste se mettra à jour avec les activations commerciales."
              />
            )}
          </section>

          {/* ── Catalogue plans ───────────────────────────────── */}
          <section className="list-panel">
            <div className="panel-head">
              <div>
                <h3>Plans et quotas</h3>
                {/* FIX #2 — accents */}
                <p>Catalogue des offres AFRIVO avec capacités hôtels et utilisateurs.</p>
              </div>
            </div>

            {plans.length ? (
              <div className="platform-admin-stack-list">
                {plans.map((item) => (
                  <article
                    key={item.id}
                    className={`platform-admin-stack-card${selectedPlan?.id === item.id ? " active" : ""}`}
                    onClick={() => setSelectedPlanId(item.id)}
                    /* FIX #3 — accessibilité clavier sur les cards */
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedPlan?.id === item.id}
                    aria-label={`Sélectionner le plan ${item.name}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedPlanId(item.id);
                      }
                    }}
                  >
                    <div className="platform-admin-stack-top">
                      <strong>{item.name}</strong>
                      <PlatformBadge
                        status={item.is_active ? "active" : "inactive"}
                        label={item.is_active ? "Actif" : "Inactif"}
                      />
                    </div>
                    <span className="platform-admin-code">{item.code}</span>
                    {/* FIX #8 — espace après le label dans inline-stats */}
                    <div className="platform-admin-inline-stats">
                      <span><strong>Hôtels : </strong>{item.max_hotels}</span>
                      <span><strong>Utilisateurs : </strong>{item.max_users}</span>
                      <span><strong>Mensuel : </strong>{item.monthly_price}</span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                      {item.description || "Aucune description de plan."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconSubscription />}
                title="Aucun plan disponible"
                description="Créez un premier plan AFRIVO pour commencer la gestion commerciale."
              />
            )}
          </section>
        </section>
      ) : null}

      {/* FIX #2 — keyframe spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}