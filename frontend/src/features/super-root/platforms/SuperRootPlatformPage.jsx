import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { SrBadge, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";
import { superRootPlatformsApi } from "./superRootPlatformsApi";

const STATUS_CONFIG = {
  active: { label: "Active", tone: "ok" },
  suspended: { label: "Suspendue", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "warning" },
  degraded: { label: "Degradee", tone: "warning" },
};

const TECH_LABELS = {
  api: "API",
  database: "PostgreSQL",
  cache: "Cache",
  queue: "Workers",
  websocket: "WebSocket",
};

const PLATFORM_ACTIONS = [
  { id: "healthcheck", label: "Healthcheck", tone: "outline" },
  { id: "maintenance", label: "Mode maintenance", tone: "outline", critical: true },
  { id: "reactivate", label: "Reactiver", tone: "primary" },
  { id: "incidents", label: "Verifier incidents", tone: "outline" },
  { id: "monitoring", label: "Monitoring live", tone: "outline" },
  { id: "audit", label: "Audit plateforme", tone: "outline" },
  { id: "subscription_lifecycle", label: "Cycle abonnements", tone: "outline", critical: true },
  { id: "integrity", label: "Controle integrite", tone: "outline" },
  { id: "snapshot", label: "Exporter snapshot", tone: "outline" },
  { id: "critical_quotas", label: "Quotas critiques", tone: "outline" },
  { id: "suspended_clients", label: "Clients suspendus", tone: "outline" },
];

const PLATFORM_FORM_INITIAL = {
  name: "",
  slug: "",
  code: "",
  domain_url: "",
  environment: "production",
  region: "",
  owner_email: "",
  notes: "",
};

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF`;
}

function statusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.active;
}

function actionPayload(reason = "") {
  return {
    reason,
    confirmation: {
      confirmed: true,
      phrase: "CONFIRMER",
    },
  };
}

function getErrorMessage(error, fallback) {
  return error?.payload?.detail || error?.message || fallback;
}

function normalizeResult(action, payload) {
  const map = {
    healthcheck: payload.healthcheck,
    maintenance: payload.platform,
    reactivate: payload.platform,
    incidents: payload,
    monitoring: payload.monitoring,
    audit: payload,
    subscription_lifecycle: payload.result,
    integrity: payload.integrity,
    snapshot: payload.snapshot,
    critical_quotas: payload,
    suspended_clients: payload,
  };
  return map[action] ?? payload;
}

function resultRows(action, result) {
  if (!result) return [];
  if (action === "incidents") return result.incidents || [];
  if (action === "audit") return result.audit_events || [];
  if (action === "critical_quotas") return result.quotas || [];
  if (action === "suspended_clients") return result.organizations || [];
  return [];
}

function ResultPreview({ action, result }) {
  if (!result) return null;
  const rows = resultRows(action, result);
  if (rows.length) {
    return (
      <div className="sr-platform-result-list">
        {rows.slice(0, 8).map((row, index) => (
          <div className="sr-platform-result-row" key={row.id || row.hotel_id || index}>
            <strong>{row.description || row.event_type || row.hotel_name || row.name || row.action || "Element"}</strong>
            <span>
              {row.severity || row.status || row.organization_name || row.actor || row.slug || row.created_at || "-"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <pre className="sr-platform-result-json">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function SuperRootPlatformPage({ section = "platform" }) {
  const { data, error, loading, reload } = useSuperRootResource("platforms");
  const [actionState, setActionState] = useState({ id: "", label: "", result: null, error: "", loading: false });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(PLATFORM_FORM_INITIAL);
  const [createState, setCreateState] = useState({ loading: false, error: "", success: "" });
  const [organizations, setOrganizations] = useState([]);
  const [attachForm, setAttachForm] = useState({ platform_id: "", organization_id: "", include_organization_hotels: true });
  const [attachState, setAttachState] = useState({ loading: false, error: "", success: "" });
  const platforms = data?.platforms || [];
  const platform = platforms[0] || {};
  const summary = data?.summary || {};
  const risks = data?.risks || {};
  const technical = data?.technical || {};
  const quickLinks = data?.quick_links || [];
  const title = {
    organizations: "Organisations systeme",
    hotels: "Hotels systeme",
    modules: "Modules systeme",
    licenses: "Licences systeme",
    subscriptions: "Abonnements systeme",
    users: "Utilisateurs systeme",
    platform: "Plateformes AFRIVO",
  }[section] || "Plateformes AFRIVO";

  useEffect(() => {
    superRootPlatformsApi.listOrganizations()
      .then((payload) => setOrganizations(payload.organizations || []))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    if (!attachForm.platform_id && platforms.length) {
      const firstCustomPlatform = platforms.find((item) => item.id !== "afrivo-default") || platforms[0];
      setAttachForm((current) => ({ ...current, platform_id: firstCustomPlatform.id || "" }));
    }
  }, [attachForm.platform_id, platforms]);

  async function runAction(action) {
    const labels = {
      maintenance: "mettre la plateforme en maintenance",
      suspend: "suspendre la plateforme",
      reactivate: "reactiver la plateforme",
      healthcheck: "lancer un healthcheck",
      incidents: "verifier les incidents",
      monitoring: "charger le monitoring live",
      audit: "charger l'audit plateforme",
      subscription_lifecycle: "executer le cycle abonnements",
      integrity: "controler l'integrite",
      snapshot: "generer un snapshot",
      critical_quotas: "charger les quotas critiques",
      suspended_clients: "charger les clients suspendus",
    };
    const platformId = platform.id || "afrivo-default";
    if (action === "snapshot") {
      window.location.href = superRootPlatformsApi.snapshotExportUrl(platformId);
    }
    const needsReason = action === "maintenance" || action === "suspend";
    let reason = "";
    if (needsReason) {
      reason = window.prompt(`Motif pour ${labels[action]} :`, "");
      if (reason === null) return;
    }
    const needsConfirmation = ["maintenance", "suspend", "subscription_lifecycle"].includes(action);
    if (needsConfirmation) {
      const confirmed = window.confirm(`Confirmer : ${labels[action]} ?`);
      if (!confirmed) return;
    }

    setActionState({ id: action, label: labels[action], result: null, error: "", loading: true });
    try {
      const payload = action === "healthcheck"
        ? await superRootPlatformsApi.healthcheck(platformId)
        : action === "maintenance"
          ? await superRootPlatformsApi.maintenance(platformId, actionPayload(reason))
          : action === "reactivate"
            ? await superRootPlatformsApi.reactivate(platformId)
            : action === "incidents"
              ? await superRootPlatformsApi.incidents(platformId)
              : action === "monitoring"
                ? await superRootPlatformsApi.monitoringLive(platformId)
                : action === "audit"
                  ? await superRootPlatformsApi.platformAudit(platformId)
                  : action === "subscription_lifecycle"
                    ? await superRootPlatformsApi.subscriptionLifecycle(platformId, {
                        dry_run: false,
                        ...actionPayload("Cycle abonnements lance depuis Plateformes Super Root"),
                      })
                    : action === "integrity"
                      ? await superRootPlatformsApi.integrityCheck(platformId)
                      : action === "snapshot"
                        ? await superRootPlatformsApi.snapshot(platformId)
                        : action === "critical_quotas"
                          ? await superRootPlatformsApi.criticalQuotas(platformId)
                          : action === "suspended_clients"
                            ? await superRootPlatformsApi.suspendedClients(platformId)
                            : await superRootPlatformsApi.runPlatformAction(platformId, action, {});
      setActionState({ id: action, label: labels[action], result: normalizeResult(action, payload), error: "", loading: false });
      if (["maintenance", "reactivate", "suspend", "subscription_lifecycle"].includes(action)) {
        await reload();
      }
    } catch (err) {
      setActionState({
        id: action,
        label: labels[action],
        result: null,
        error: getErrorMessage(err, "Action plateforme impossible."),
        loading: false,
      });
    }
  }

  function updateCreateField(field, value) {
    setCreateForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = value
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      if (field === "name" && !current.code) {
        next.code = value
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part[0])
          .join("")
          .slice(0, 4)
          .toUpperCase();
      }
      return next;
    });
  }

  async function createPlatform(event) {
    event.preventDefault();
    setCreateState({ loading: true, error: "", success: "" });
    try {
      await superRootPlatformsApi.createPlatform(createForm);
      setCreateForm(PLATFORM_FORM_INITIAL);
      setShowCreate(false);
      setCreateState({ loading: false, error: "", success: "Plateforme creee avec succes." });
      await reload();
    } catch (err) {
      setCreateState({
        loading: false,
        error: getErrorMessage(err, "Creation de plateforme impossible."),
        success: "",
      });
    }
  }

  async function attachTenants(event) {
    event.preventDefault();
    setAttachState({ loading: true, error: "", success: "" });
    try {
      const payload = {
        organization_id: attachForm.organization_id ? Number(attachForm.organization_id) : null,
        include_organization_hotels: Boolean(attachForm.include_organization_hotels),
      };
      await superRootPlatformsApi.attachTenants(attachForm.platform_id, payload);
      setAttachState({ loading: false, error: "", success: "Rattachement effectue avec succes." });
      await reload();
      const orgPayload = await superRootPlatformsApi.listOrganizations();
      setOrganizations(orgPayload.organizations || []);
    } catch (err) {
      setAttachState({
        loading: false,
        error: getErrorMessage(err, "Rattachement impossible."),
        success: "",
      });
    }
  }

  const platformStatus = statusConfig(platform.status);
  const technicalItems = ["api", "database", "cache", "queue", "websocket"].map((key) => ({
    key,
    label: TECH_LABELS[key],
    value: technical[key] || {},
  }));

  return (
    <SuperRootPageShell
      title={title}
      subtitle="Etat global, disponibilite technique, risques et pilotage transversal AFRIVO."
      actions={(
        <>
          <button className="sr-btn" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fermer" : "Nouvelle plateforme"}
          </button>
          <button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>
          <button className="sr-btn sr-btn-outline" onClick={() => runAction("healthcheck")}>Healthcheck</button>
        </>
      )}
    >
      <SuperRootState loading={loading} error={error}>
        {showCreate ? (
          <section className="sr-platform-create-card">
            <div className="sr-platform-card-head">
              <span>Provisioning Super Root</span>
              <h2>Nouvelle plateforme AFRIVO</h2>
            </div>
            <form className="sr-platform-create-form" onSubmit={createPlatform}>
              <label>
                Nom plateforme *
                <input
                  className="sr-input"
                  value={createForm.name}
                  onChange={(event) => updateCreateField("name", event.target.value)}
                  placeholder="ex. AFRIVO Europe"
                  required
                />
              </label>
              <label>
                Slug *
                <input
                  className="sr-input"
                  value={createForm.slug}
                  onChange={(event) => updateCreateField("slug", event.target.value)}
                  placeholder="afrivo-europe"
                  required
                />
              </label>
              <label>
                Code
                <input
                  className="sr-input"
                  value={createForm.code}
                  onChange={(event) => updateCreateField("code", event.target.value.toUpperCase())}
                  placeholder="AFE"
                />
              </label>
              <label>
                Environnement
                <select
                  className="sr-input"
                  value={createForm.environment}
                  onChange={(event) => updateCreateField("environment", event.target.value)}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="sandbox">Sandbox</option>
                  <option value="development">Development</option>
                </select>
              </label>
              <label>
                URL domaine
                <input
                  className="sr-input"
                  value={createForm.domain_url}
                  onChange={(event) => updateCreateField("domain_url", event.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </label>
              <label>
                Region
                <input
                  className="sr-input"
                  value={createForm.region}
                  onChange={(event) => updateCreateField("region", event.target.value)}
                  placeholder="Europe / West Africa"
                />
              </label>
              <label>
                Owner email
                <input
                  className="sr-input"
                  value={createForm.owner_email}
                  onChange={(event) => updateCreateField("owner_email", event.target.value)}
                  placeholder="ops@afrivo.com"
                  type="email"
                />
              </label>
              <label className="sr-platform-create-notes">
                Notes
                <textarea
                  className="sr-input"
                  value={createForm.notes}
                  onChange={(event) => updateCreateField("notes", event.target.value)}
                  placeholder="Contexte technique, region, contraintes de lancement..."
                  rows={3}
                />
              </label>
              <div className="sr-platform-create-note">
                Cette creation enregistre une vraie plateforme Super Root. Les tenants, domaines et donnees business peuvent ensuite etre rattaches progressivement a cette plateforme.
              </div>
              {createState.error ? <div className="sr-error sr-platform-create-error">{createState.error}</div> : null}
              <div className="sr-platform-create-actions">
                <button className="sr-btn sr-btn-outline" onClick={() => setShowCreate(false)} type="button">Annuler</button>
                <button className="sr-btn" disabled={createState.loading} type="submit">
                  {createState.loading ? "Creation..." : "Creer la plateforme"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
        {createState.success ? <div className="sr-state sr-platform-create-success">{createState.success}</div> : null}
        {attachState.success ? <div className="sr-state sr-platform-create-success">{attachState.success}</div> : null}

        <section className={`sr-platform-command ${platform.status === "suspended" ? "is-suspended" : ""}`}>
          <div className="sr-platform-command-head">
            <div className="sr-platform-brand">
              <div className="sr-platform-avatar">{platform.code || "AF"}</div>
              <div>
                <span className="sr-platform-kicker">Plateforme principale</span>
                <h2>{platform.name || "AFRIVO Default"}</h2>
                <p>{platform.reason || "Supervision globale SaaS AFRIVO."}</p>
              </div>
            </div>
            <div className="sr-platform-state">
              <SrBadge tone={platformStatus.tone}>{platformStatus.label}</SrBadge>
              <strong>{technical.uptime_pct ?? 99.8}%</strong>
              <span>Uptime</span>
            </div>
          </div>

          <div className="sr-platform-business-grid">
            {[
              ["Organisations", summary.organizations, `${summary.organizations_active || 0} actives`],
              ["Hotels", summary.hotels, `${summary.hotels_active || 0} actifs`],
              ["Utilisateurs", summary.users, "actifs"],
              ["Licences", summary.licenses, `${summary.licenses_active || 0} actives`],
              ["Abonnements", summary.subscriptions, `${summary.subscriptions_active || 0} actifs`],
              ["Revenus/mois", formatMoney(summary.revenue_monthly), "projection"],
            ].map(([label, value, meta]) => (
              <div className="sr-platform-metric" key={label}>
                <span>{label}</span>
                <strong>{value ?? 0}</strong>
                <small>{meta}</small>
              </div>
            ))}
          </div>

          <div className="sr-platform-actions">
            <button className="sr-btn sr-btn-outline" onClick={() => runAction("maintenance")}>
              Maintenance
            </button>
            <button className="sr-btn sr-btn-danger" onClick={() => runAction("suspend")}>
              Suspendre
            </button>
            <button className="sr-btn" onClick={() => runAction("reactivate")}>
              Reactiver
            </button>
          </div>
        </section>

        <section className="sr-platform-card">
          <div className="sr-platform-card-head">
            <span>Registry multi-plateforme</span>
            <h2>Plateformes enregistrees</h2>
          </div>
          <div className="sr-platform-registry">
            {platforms.map((item) => {
              const cfg = statusConfig(item.status);
              return (
                <div className="sr-platform-registry-row" key={item.id}>
                  <div className="sr-platform-avatar">{item.code || "PF"}</div>
                  <div className="sr-platform-registry-main">
                    <strong>{item.name}</strong>
                    <span>{item.domain_url || item.region || item.environment || "Plateforme AFRIVO"}</span>
                  </div>
                  <SrBadge tone={cfg.tone}>{cfg.label}</SrBadge>
                  <span>{item.technical?.uptime_pct ?? "-"}%</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sr-platform-card">
          <div className="sr-platform-card-head">
            <span>Rattachement tenant</span>
            <h2>Associer organisations et hotels</h2>
          </div>
          <form className="sr-platform-attach-form" onSubmit={attachTenants}>
            <label>
              Plateforme cible
              <select
                className="sr-input"
                value={attachForm.platform_id}
                onChange={(event) => setAttachForm((current) => ({ ...current, platform_id: event.target.value }))}
                required
              >
                {platforms.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Organisation
              <select
                className="sr-input"
                value={attachForm.organization_id}
                onChange={(event) => setAttachForm((current) => ({ ...current, organization_id: event.target.value }))}
                required
              >
                <option value="">Selectionner une organisation</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} - {organization.platform_name || "AFRIVO Default"}
                  </option>
                ))}
              </select>
            </label>
            <label className="sr-platform-attach-toggle">
              <input
                type="checkbox"
                checked={attachForm.include_organization_hotels}
                onChange={(event) => setAttachForm((current) => ({ ...current, include_organization_hotels: event.target.checked }))}
              />
              Rattacher aussi tous les hotels de cette organisation
            </label>
            {attachState.error ? <div className="sr-error sr-platform-create-error">{attachState.error}</div> : null}
            <div className="sr-platform-create-actions">
              <button className="sr-btn" disabled={attachState.loading || !attachForm.platform_id || !attachForm.organization_id} type="submit">
                {attachState.loading ? "Rattachement..." : "Rattacher"}
              </button>
            </div>
          </form>
        </section>

        <section className="sr-platform-card">
          <div className="sr-platform-card-head">
            <span>Actions plateforme</span>
            <h2>Centre de controle</h2>
          </div>
          <div className="sr-platform-action-grid">
            {PLATFORM_ACTIONS.map((item) => (
              <button
                className={`sr-platform-action-btn ${item.tone === "primary" ? "is-primary" : ""}`}
                disabled={actionState.loading}
                key={item.id}
                onClick={() => runAction(item.id)}
                type="button"
              >
                {item.label}
                {item.critical ? <span>Critique</span> : null}
              </button>
            ))}
          </div>
          {(actionState.loading || actionState.error || actionState.result) ? (
            <div className="sr-platform-result">
              <div className="sr-platform-result-head">
                <strong>{actionState.label || "Resultat action"}</strong>
                {actionState.loading ? <span>Execution...</span> : null}
              </div>
              {actionState.error ? <div className="sr-error">{actionState.error}</div> : null}
              {!actionState.error && !actionState.loading ? (
                <ResultPreview action={actionState.id} result={actionState.result} />
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="sr-platform-grid">
          <section className="sr-platform-card">
            <div className="sr-platform-card-head">
              <span>Disponibilite technique</span>
              <h2>Infrastructure</h2>
            </div>
            <div className="sr-platform-tech-list">
              {technicalItems.map((item) => (
                <div className="sr-platform-tech-row" key={item.key}>
                  <span className={`sr-platform-dot is-${item.value.status || "ok"}`} />
                  <strong>{item.label}</strong>
                  <span>
                    {item.value.latency_ms != null
                      ? `${item.value.latency_ms} ms`
                      : item.value.pending != null
                        ? `${item.value.pending} pending`
                        : item.value.status || "ok"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="sr-platform-card">
            <div className="sr-platform-card-head">
              <span>Risques globaux</span>
              <h2>Points a surveiller</h2>
            </div>
            <div className="sr-platform-risk-list">
              {[
                ["Organisations suspendues", risks.organizations_suspended],
                ["Hotels sans abonnement", risks.hotels_without_subscription],
                ["Quotas critiques", risks.quota_critical],
                ["Quotas attention", risks.quota_attention],
                ["Admins manquants", risks.admins_missing],
                ["Licences expirees/suspendues", risks.licenses_expired],
                ["Incidents", risks.incidents],
              ].map(([label, value]) => (
                <div className="sr-platform-risk-row" key={label}>
                  <span>{label}</span>
                  <strong className={value > 0 ? "is-warning" : ""}>{value || 0}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="sr-platform-card">
          <div className="sr-platform-card-head">
            <span>Navigation centralisee</span>
            <h2>Acces rapides plateforme</h2>
          </div>
          <div className="sr-platform-links">
            {quickLinks.map((link) => (
              <Link className="sr-platform-link" to={link.path} key={link.path}>
                {link.label}
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
