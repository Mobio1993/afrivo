import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../shared/components/AppSelect";
import { DatePicker } from "../../shared/components/DatePicker";
import { getActivityLogDetail, getActivityLogs, getActivityLogSummary } from "../../services/historyService";
import "./ActivityLogsPage.css";

const ACTION_OPTIONS = [
  "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "VIEW", "CONFIRM", "CANCEL",
  "CHECKIN", "CHECKOUT", "PAYMENT", "REFUND", "ROOM_STATUS_CHANGE", "PRICE_CHANGE",
  "PASSWORD_CHANGE", "PERMISSION_CHANGE", "EXPORT",
];

const SEVERITY_OPTIONS = ["info", "success", "warning", "danger", "critical"];

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "manager", label: "Manager" },
  { value: "reception", label: "Reception" },
  { value: "cashier", label: "Caissier" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "restaurant", label: "Restaurant" },
];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function JsonBlock({ value }) {
  const hasValue = value && Object.keys(value).length > 0;
  return (
    <pre className="activity-json-block">
      {hasValue ? JSON.stringify(value, null, 2) : "{}"}
    </pre>
  );
}

function SummaryCard({ label, value, meta, tone = "default" }) {
  return (
    <article className={`info-card activity-summary-card activity-summary-card--${tone}`}>
      <strong>{label}</strong>
      <div className="metric">{value ?? 0}</div>
      <p>{meta}</p>
    </article>
  );
}

export function ActivityLogsPage() {
  const [filters, setFilters] = useState({
    search: "",
    user: "",
    role: "",
    module: "",
    action: "",
    severity: "",
    date_start: "",
    date_end: "",
    page: 1,
    page_size: 20,
  });
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
  const [summary, setSummary] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(() => {
    const values = new Set(logs.map((item) => item.module).filter(Boolean));
    ["auth", "clients", "rooms", "operations", "bookings", "billing", "consumptions", "users", "reports", "tenancy"].forEach((item) => values.add(item));
    return Array.from(values).sort();
  }, [logs]);

  const users = useMemo(() => {
    const seen = new Map();
    logs.forEach((item) => {
      if (item.user && !seen.has(item.user)) {
        seen.set(item.user, item.user_name);
      }
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [logs]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [logsPayload, summaryPayload] = await Promise.all([
          getActivityLogs(filters),
          getActivityLogSummary(filters),
        ]);
        if (ignore) return;
        setLogs(logsPayload.results || []);
        setPagination({
          count: logsPayload.count || 0,
          next: logsPayload.next,
          previous: logsPayload.previous,
        });
        setSummary(summaryPayload);
      } catch (requestError) {
        if (!ignore) setError(requestError.message || "Journal d'activite indisponible.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [filters]);

  async function openDetail(log) {
    setSelectedLog(log);
    setDetailLoading(true);
    try {
      const payload = await getActivityLogDetail(log.id);
      setSelectedLog(payload);
    } catch {
      setSelectedLog(log);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((pagination.count || 0) / Number(filters.page_size || 20)));

  return (
    <div className="page-stack activity-logs-page">
      {error ? <div className="alert-box">{error}</div> : null}

      <section className="activity-summary-grid">
        <SummaryCard label="Operations aujourd'hui" value={summary?.operations_today} meta="Actions operationnelles tracees sur la journee." tone="success" />
        <SummaryCard label="Connexions aujourd'hui" value={summary?.logins_today} meta="Sessions utilisateurs ouvertes aujourd'hui." tone="info" />
        <SummaryCard label="Actions sensibles" value={summary?.sensitive_actions} meta="Operations critiques ou changements a surveiller." tone="warning" />
        <SummaryCard label="Paiements enregistres" value={summary?.payments_recorded} meta="Encaissements et flux financiers journalises." tone="payment" />
        <SummaryCard label="Alertes critiques" value={summary?.critical_alerts} meta="Evenements urgents necessitant une verification." tone="danger" />
      </section>

      <section className="activity-filter-panel">
        <input
          type="search"
          className="filter-input activity-search-field"
          placeholder="Rechercher utilisateur, objet, hotel, description..."
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
        />
        <AppSelect value={filters.user} onChange={(event) => updateFilter("user", event.target.value)} name="activity_user">
          <option value="">Tous les utilisateurs</option>
          {users.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.role} onChange={(event) => updateFilter("role", event.target.value)} name="activity_role">
          <option value="">Tous les roles</option>
          {ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.module} onChange={(event) => updateFilter("module", event.target.value)} name="activity_module">
          <option value="">Tous les modules</option>
          {modules.map((item) => <option key={item} value={item}>{item}</option>)}
        </AppSelect>
        <AppSelect value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} name="activity_action">
          <option value="">Toutes les actions</option>
          {ACTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </AppSelect>
        <AppSelect value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)} name="activity_severity">
          <option value="">Toutes gravites</option>
          {SEVERITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </AppSelect>
        <DatePicker value={filters.date_start} onChange={(event) => updateFilter("date_start", event.target.value)} name="activity_date_start" placeholder="Debut" />
        <DatePicker value={filters.date_end} onChange={(event) => updateFilter("date_end", event.target.value)} name="activity_date_end" placeholder="Fin" />
      </section>

      <section className="activity-table-panel">
        <div className="activity-table-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Role</th>
                <th>Module</th>
                <th>Action</th>
                <th>Description</th>
                <th>Gravite</th>
                <th>Hotel</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.user_name}</td>
                  <td>{log.user_role || "-"}</td>
                  <td>{log.module}</td>
                  <td><span className="activity-pill">{log.action}</span></td>
                  <td className="activity-description">{log.description}</td>
                  <td><span className={`activity-severity activity-severity--${log.severity}`}>{log.severity}</span></td>
                  <td>{log.hotel_name || "-"}</td>
                  <td><button type="button" className="ghost-button activity-detail-button" onClick={() => openDetail(log)}>Detail</button></td>
                </tr>
              ))}
              {!logs.length && !loading ? (
                <tr><td colSpan="9" className="activity-empty">Aucune operation ne correspond aux filtres.</td></tr>
              ) : null}
              {loading ? (
                <tr><td colSpan="9" className="activity-empty">Chargement du journal...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="activity-pagination">
          <span>{pagination.count || 0} operation(s) - page {filters.page} / {totalPages}</span>
          <div>
            <button type="button" className="secondary-button" disabled={!pagination.previous} onClick={() => updateFilter("page", Math.max(1, filters.page - 1))}>Precedent</button>
            <button type="button" className="secondary-button" disabled={!pagination.next} onClick={() => updateFilter("page", filters.page + 1)}>Suivant</button>
          </div>
        </div>
      </section>

      {selectedLog ? (
        <div className="activity-drawer-backdrop" onMouseDown={() => !detailLoading && setSelectedLog(null)}>
          <aside className="activity-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className="activity-drawer-header">
              <div>
                <span className="eyebrow">Detail audit</span>
                <h3>{selectedLog.action}</h3>
                <p>{selectedLog.description}</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setSelectedLog(null)}>Fermer</button>
            </header>
            <div className="activity-drawer-body">
              <div className="activity-detail-grid">
                <div><strong>Date</strong><span>{formatDateTime(selectedLog.created_at)}</span></div>
                <div><strong>Utilisateur</strong><span>{selectedLog.user_name}</span></div>
                <div><strong>Role</strong><span>{selectedLog.user_role || "-"}</span></div>
                <div><strong>Hotel</strong><span>{selectedLog.hotel_name || "-"}</span></div>
                <div><strong>Module</strong><span>{selectedLog.module}</span></div>
                <div><strong>Objet</strong><span>{selectedLog.object_type || "-"} #{selectedLog.object_id || "-"}</span></div>
                <div><strong>Reference</strong><span>{selectedLog.object_reference || "-"}</span></div>
                <div><strong>IP</strong><span>{selectedLog.ip_address || "-"}</span></div>
                <div><strong>Session</strong><span>{selectedLog.session_key || "-"}</span></div>
                <div className="full-width"><strong>Navigateur</strong><span>{selectedLog.user_agent || "-"}</span></div>
              </div>
              <section>
                <h4>Anciennes valeurs</h4>
                <JsonBlock value={selectedLog.old_values} />
              </section>
              <section>
                <h4>Nouvelles valeurs</h4>
                <JsonBlock value={selectedLog.new_values} />
              </section>
              <section>
                <h4>Metadonnees</h4>
                <JsonBlock value={selectedLog.metadata} />
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
