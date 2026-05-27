import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../shared/components/AppSelect";
import {
  createIamRole,
  createPlatformSecurityReview,
  getAuditIntegrityStatus,
  listIamAssignments,
  listIamPermissions,
  listIamRoles,
  listPlatformSecurityEventsFiltered,
  listRolePermissionHistory,
  listSecurityAlerts,
  updateIamRole,
} from "../../services/platformAdminService";
import {
  IconEmptyEvent,
  PlatformBadge,
  PlatformEmptyState,
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
  { value: "module_created", label: "Module cree" },
  { value: "module_updated", label: "Module mis a jour" },
  { value: "license_created", label: "Licence creee" },
  { value: "license_updated", label: "Licence mise a jour" },
  { value: "license_suspended", label: "Licence suspendue" },
  { value: "license_renewed", label: "Licence renouvelee" },
  { value: "admin_created", label: "Admin cree" },
  { value: "admin_updated", label: "Admin mis a jour" },
  { value: "admin_access_reset", label: "Acces admin reinitialise" },
  { value: "user_linked", label: "Admin hotel cree" },
  { value: "security_review", label: "Revue securite" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Toutes les cibles" },
  { value: "Organization", label: "Organisation" },
  { value: "Hotel", label: "Hotel" },
  { value: "HotelSubscription", label: "Abonnement" },
  { value: "SubscriptionPlan", label: "Plan" },
  { value: "PlatformModule", label: "Module" },
  { value: "PlatformLicense", label: "Licence" },
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

const EMPTY_ROLE_FORM = {
  code: "",
  name: "",
  description: "",
  permission_codes: [],
};

function groupPermissionsByModule(permissions) {
  return permissions.reduce((groups, permission) => {
    const moduleCode = permission.module_code || "global";
    if (!groups[moduleCode]) {
      groups[moduleCode] = [];
    }
    groups[moduleCode].push(permission);
    return groups;
  }, {});
}

function formatAuditDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRoleHistoryTitle(item) {
  if (item.event_type === "user_role_changed") {
    return `Role utilisateur modifie : ${item.target_reference || "Utilisateur"}`;
  }
  if (item.event_type === "iam_role_created") {
    return `Role IAM cree : ${item.role_code || item.target_reference}`;
  }
  if (item.event_type === "iam_role_updated") {
    return `Role IAM modifie : ${item.role_code || item.target_reference}`;
  }
  if (item.event_type === "assigne") {
    return `Role assigne : ${item.role_code}`;
  }
  if (item.event_type === "revoque") {
    return `Role revoque : ${item.role_code}`;
  }
  return item.description || "Changement IAM";
}

export function PlatformSecurityPage() {
  const [events, setEvents] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [roleHistory, setRoleHistory] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState({ summary: {}, results: [] });
  const [auditIntegrity, setAuditIntegrity] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  async function loadEvents() {
    const payload = await listPlatformSecurityEventsFiltered({
      event_type: eventFilter,
      target_type: targetTypeFilter,
      search,
      limit: 40,
    });
    setEvents(payload.results || []);
  }

  async function loadIam() {
    const [
      rolesPayload,
      permissionsPayload,
      assignmentsPayload,
      historyPayload,
      alertsPayload,
      integrityPayload,
    ] = await Promise.all([
      listIamRoles(),
      listIamPermissions(),
      listIamAssignments(),
      listRolePermissionHistory({ page_size: 12 }),
      listSecurityAlerts(),
      getAuditIntegrityStatus(),
    ]);
    const nextRoles = rolesPayload.results || [];
    setRoles(nextRoles);
    setPermissions(permissionsPayload.results || []);
    setAssignments(assignmentsPayload.results || []);
    setRoleHistory(historyPayload.results || []);
    setSecurityAlerts({
      summary: alertsPayload.summary || {},
      results: alertsPayload.results || [],
    });
    setAuditIntegrity(integrityPayload || null);
    if (!selectedRoleId && nextRoles.length > 0) {
      const firstRole = nextRoles[0];
      setSelectedRoleId(firstRole.id);
      setRoleForm({
        code: firstRole.code || "",
        name: firstRole.name || "",
        description: firstRole.description || "",
        permission_codes: firstRole.permission_codes || [],
      });
    }
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

  useEffect(() => {
    loadIam().catch((requestError) => {
      setError(requestError.message || "Impossible de charger la matrice IAM.");
    });
  }, []);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  const permissionsByModule = useMemo(() => groupPermissionsByModule(permissions), [permissions]);

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

  function selectRole(role) {
    setSelectedRoleId(role.id);
    setRoleForm({
      code: role.code || "",
      name: role.name || "",
      description: role.description || "",
      permission_codes: role.permission_codes || [],
    });
    setSuccess("");
    setError("");
  }

  function startNewRole() {
    setSelectedRoleId(null);
    setRoleForm(EMPTY_ROLE_FORM);
    setSuccess("");
    setError("");
  }

  function handleRoleFieldChange(event) {
    const { name, value } = event.target;
    setRoleForm((current) => ({
      ...current,
      [name]: name === "code" ? value.toUpperCase().replace(/[^A-Z0-9_]/g, "") : value,
    }));
  }

  function toggleRolePermission(permissionCode) {
    setRoleForm((current) => {
      const currentCodes = new Set(current.permission_codes || []);
      if (currentCodes.has(permissionCode)) {
        currentCodes.delete(permissionCode);
      } else {
        currentCodes.add(permissionCode);
      }
      return {
        ...current,
        permission_codes: Array.from(currentCodes).sort(),
      };
    });
  }

  async function handleRoleSubmit(event) {
    event.preventDefault();
    if (savingRole) return;

    setSavingRole(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        code: roleForm.code,
        name: roleForm.name,
        description: roleForm.description,
        permission_codes: roleForm.permission_codes,
      };
      const response = selectedRoleId
        ? await updateIamRole(selectedRoleId, payload)
        : await createIamRole(payload);
      const savedRole = response.role;
      setSuccess(selectedRoleId ? "Role IAM mis a jour." : "Role IAM cree.");
      await loadIam();
      if (savedRole?.id) {
        setSelectedRoleId(savedRole.id);
        setRoleForm({
          code: savedRole.code || "",
          name: savedRole.name || "",
          description: savedRole.description || "",
          permission_codes: savedRole.permission_codes || [],
        });
      }
    } catch (requestError) {
      setError(requestError.message || "Impossible d'enregistrer le role IAM.");
    } finally {
      setSavingRole(false);
    }
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

      <section className="list-panel iam-console-panel">
        <div className="panel-head">
          <div>
            <h3>Roles et permissions IAM</h3>
            <p>Gerez la matrice d'acces qui servira de base aux controles backend et aux guards React.</p>
          </div>
          <button type="button" className="secondary-button" onClick={startNewRole}>
            Nouveau role
          </button>
        </div>

        <div className="iam-console-grid">
          <aside className="iam-role-list">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`iam-role-item ${role.id === selectedRoleId ? "on" : ""}`}
                onClick={() => selectRole(role)}
              >
                <strong>{role.name}</strong>
                <span>{role.code}</span>
                <small>{role.permission_codes?.length || 0} permission(s)</small>
              </button>
            ))}
          </aside>

          <form className="iam-role-editor" onSubmit={handleRoleSubmit}>
            <div className="platform-admin-grid-form">
              <input
                className="filter-input"
                name="code"
                placeholder="CODE_ROLE"
                value={roleForm.code}
                onChange={handleRoleFieldChange}
                disabled={Boolean(selectedRole?.is_system)}
                required
              />
              <input
                className="filter-input"
                name="name"
                placeholder="Nom du role"
                value={roleForm.name}
                onChange={handleRoleFieldChange}
                required
              />
              <textarea
                className="filter-input platform-admin-textarea"
                name="description"
                placeholder="Description operationnelle"
                value={roleForm.description}
                onChange={handleRoleFieldChange}
              />
            </div>

            <div className="iam-permission-matrix">
              {Object.entries(permissionsByModule).map(([moduleCode, modulePermissions]) => (
                <div className="iam-permission-group" key={moduleCode}>
                  <h4>{moduleCode}</h4>
                  <div>
                    {modulePermissions.map((permission) => {
                      const checked = roleForm.permission_codes.includes(permission.code);
                      return (
                        <label className={`iam-permission-check ${checked ? "on" : ""}`} key={permission.code}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRolePermission(permission.code)}
                          />
                          <span>{permission.action || permission.code}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" className="primary-button" disabled={savingRole}>
              {savingRole ? "Enregistrement..." : selectedRoleId ? "Enregistrer le role" : "Creer le role"}
            </button>
          </form>
        </div>
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Assignations actives</h3>
            <p>Vue support des roles attribues par organisation ou par hotel.</p>
          </div>
        </div>
        <div className="iam-assignment-list">
          {assignments.length ? assignments.slice(0, 12).map((assignment) => (
            <article className="iam-assignment-card" key={`${assignment.scope}-${assignment.id}`}>
              <strong>{assignment.user.full_name}</strong>
              <span>{assignment.role_code}</span>
              <small>{assignment.scope} · {assignment.target.name}</small>
            </article>
          )) : (
            <PlatformEmptyState
              icon={<IconEmptyEvent />}
              title="Aucune assignation IAM"
              description="Les roles assignes aux organisations et hotels apparaitront ici."
            />
          )}
        </div>
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Alertes securite</h3>
            <p>Detection automatique des signaux sensibles sur les dernieres 24 heures.</p>
          </div>
          <div className="security-alert-summary">
            <span>{securityAlerts.summary?.critical || 0} critique(s)</span>
            <span>{securityAlerts.summary?.warning || 0} warning</span>
          </div>
        </div>
        {securityAlerts.results?.length ? (
          <div className="security-alert-list">
            {securityAlerts.results.map((alert, index) => (
              <article className={`security-alert-card ${alert.severity === "critical" ? "critical" : "warning"}`} key={`${alert.type}-${alert.source_log_id || index}`}>
                <div className="security-alert-icon">{alert.severity === "critical" ? "!" : "i"}</div>
                <div className="security-alert-body">
                  <div className="security-alert-top">
                    <strong>{alert.title}</strong>
                    <span>{formatAuditDate(alert.created_at)}</span>
                  </div>
                  <p>{alert.message}</p>
                  <div className="security-alert-meta">
                    <span><strong>Acteur</strong>{alert.actor_name || "Systeme"}</span>
                    <span><strong>Cible</strong>{alert.target || "-"}</span>
                    <span><strong>IP</strong>{alert.ip_address || "-"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <PlatformEmptyState
            icon={<IconEmptyEvent />}
            title="Aucune alerte securite active"
            description="Les signaux critiques et warnings apparaitront ici automatiquement."
          />
        )}
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Integrite du journal d'audit</h3>
            <p>Verification cryptographique des evenements d'audit recents.</p>
          </div>
          <PlatformBadge
            status={auditIntegrity?.status === "valid" ? "active" : "warning"}
            label={auditIntegrity?.status === "valid" ? "Valide" : "A verifier"}
          />
        </div>
        {auditIntegrity ? (
          <div className="audit-integrity-grid">
            <article>
              <span>Verifies</span>
              <strong>{auditIntegrity.sealed || 0}</strong>
              <small>{auditIntegrity.total_checked || 0} log(s) controles</small>
            </article>
            <article>
              <span>Non scelles</span>
              <strong>{auditIntegrity.unsealed || 0}</strong>
              <small>Anciens logs ou migration incomplete</small>
            </article>
            <article>
              <span>Invalides</span>
              <strong>{auditIntegrity.invalid || 0}</strong>
              <small>Alteration potentielle detectee</small>
            </article>
            <article>
              <span>Hash courant</span>
              <strong className="audit-integrity-hash">{auditIntegrity.latest_hash || "-"}</strong>
              <small>Dernier scellement connu</small>
            </article>
          </div>
        ) : (
          <PlatformEmptyState
            icon={<IconEmptyEvent />}
            title="Integrite non disponible"
            description="Le statut du journal apparaitra apres chargement."
          />
        )}
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Historique roles et permissions</h3>
            <p>Trace auditable des changements IAM : acteur, cible, portee, IP et navigateur.</p>
          </div>
        </div>
        {roleHistory.length ? (
          <div className="iam-history-list">
            {roleHistory.map((item) => {
              const addedCount = item.permission_delta?.added?.length || 0;
              const removedCount = item.permission_delta?.removed?.length || 0;
              return (
                <article className="iam-history-card" key={item.id}>
                  <div className="iam-history-head">
                    <div>
                      <strong>{formatRoleHistoryTitle(item)}</strong>
                      <span>{item.description}</span>
                    </div>
                    <span className="platform-admin-code">{formatAuditDate(item.created_at)}</span>
                  </div>
                  <div className="platform-admin-badge-row">
                    <PlatformBadge status={item.severity || "neutral"} label={item.severity || "info"} />
                    <PlatformBadge status="neutral" label={item.scope || item.target_type || "Global"} />
                    {item.hotel_name ? <PlatformBadge status="platform" label={item.hotel_name} /> : null}
                  </div>
                  <div className="iam-history-grid">
                    <span><strong>Acteur</strong>{item.actor_name || "Systeme"}</span>
                    <span><strong>Cible</strong>{item.target_reference || item.role_code || "-"}</span>
                    <span><strong>Role avant</strong>{item.old_role || "-"}</span>
                    <span><strong>Role apres</strong>{item.new_role || item.role_code || "-"}</span>
                    <span><strong>Portee</strong>{item.scope_target || item.scope || "Plateforme"}</span>
                    <span><strong>IP</strong>{item.ip_address || "-"}</span>
                  </div>
                  <div className="iam-history-meta">
                    <span>{addedCount} permission(s) ajoutee(s)</span>
                    <span>{removedCount} permission(s) retiree(s)</span>
                    <span title={item.user_agent || ""}>{item.user_agent || "User-agent non capture"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <PlatformEmptyState
            icon={<IconEmptyEvent />}
            title="Aucun changement IAM audite"
            description="Les modifications de roles et permissions apparaitront ici."
          />
        )}
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
