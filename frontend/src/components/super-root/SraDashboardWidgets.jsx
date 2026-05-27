const SEVERITY = {
  ok: { label: "OK", cls: "ok" },
  success: { label: "OK", cls: "ok" },
  warning: { label: "Attention", cls: "warning" },
  danger: { label: "Danger", cls: "critical" },
  critical: { label: "Critique", cls: "critical" },
};

function severityConfig(value) {
  return SEVERITY[value] || SEVERITY.ok;
}

function money(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF`;
}

function shortDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function ActionButton({ target, navigate }) {
  if (!target || !navigate) return null;
  return (
    <button className="sra-mini-link" type="button" onClick={() => navigate(target)}>
      Ouvrir
      <i className="ti ti-arrow-right" aria-hidden="true"></i>
    </button>
  );
}

export function SraMonitoringSummary({ summary }) {
  if (!summary) return null;
  const status = severityConfig(summary.status === "ok" ? "ok" : "warning");
  return (
    <div className="sra-card sra-monitoring-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Monitoring live</span>
        <span className={`sra-status-chip sra-status-${status.cls}`}>{summary.status || "warning"}</span>
      </div>
      <div className="sra-monitor-grid">
        {(summary.items || []).map((item) => {
          const itemStatus = severityConfig(item.status);
          return (
            <div key={item.id} className={`sra-monitor-item sra-monitor-${itemStatus.cls}`}>
              <span className="sra-monitor-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SraUrgentActions({ actions = [], navigate }) {
  return (
    <div className="sra-card sra-urgent-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Actions urgentes</span>
        <span className="sra-card-sub">{actions.length} priorite(s)</span>
      </div>
      <div className="sra-priority-list">
        {actions.map((item) => {
          const severity = severityConfig(item.severity);
          return (
            <div key={item.id} className={`sra-priority-row sra-priority-${severity.cls}`}>
              <div>
                <div className="sra-row-title">{item.label}</div>
                <div className="sra-row-desc">{item.description}</div>
              </div>
              <div className="sra-row-right">
                <span className={`sra-count-pill sra-count-${severity.cls}`}>{item.count}</span>
                <ActionButton target={item.target} navigate={navigate} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SraRiskCenter({ riskCenter, navigate }) {
  const items = riskCenter?.items || [];
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Centre de risques</span>
        <span className={`sra-status-chip sra-status-${severityConfig(riskCenter?.status).cls}`}>
          {riskCenter?.status || "ok"}
        </span>
      </div>
      <div className="sra-risk-grid">
        {items.map((item) => {
          const severity = severityConfig(item.severity);
          return (
            <button
              key={item.id}
              className={`sra-risk-tile sra-risk-${severity.cls}`}
              type="button"
              onClick={() => item.target && navigate?.(item.target)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SraCriticalIncidents({ incidents = [], navigate }) {
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Incidents critiques</span>
        <span className="sra-card-sub">7 derniers jours</span>
      </div>
      <div className="sra-compact-list">
        {incidents.length === 0 ? (
          <div className="sra-compact-empty">Aucun incident critique recent.</div>
        ) : (
          incidents.slice(0, 5).map((item) => {
            const severity = severityConfig(item.severity);
            return (
              <div key={item.id} className="sra-compact-row">
                <span className={`sra-dot sra-dot-${severity.cls}`}></span>
                <div className="sra-compact-main">
                  <div className="sra-row-title">{item.title}</div>
                  <div className="sra-row-desc">{item.description || item.target || item.source}</div>
                </div>
                <div className="sra-compact-meta">
                  <span>{shortDate(item.created_at)}</span>
                  <ActionButton target={item.link} navigate={navigate} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SraSecurityOverview({ security, navigate }) {
  if (!security) return null;
  const metrics = [
    ["Sessions SR", security.active_super_root_sessions],
    ["Sans MFA", security.sensitive_users_without_mfa],
    ["Echecs login", security.failed_login_attempts],
    ["Verrouilles", security.locked_users],
  ];
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Securite Super Root</span>
        <button className="sra-mini-link" type="button" onClick={() => navigate?.("/super-root/security")}>
          Voir securite
        </button>
      </div>
      <div className="sra-metric-grid">
        {metrics.map(([label, value]) => (
          <div key={label} className="sra-metric-tile">
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </div>
        ))}
      </div>
      <div className="sra-tiny-list">
        {(security.recent_sensitive_activity || []).slice(0, 4).map((item) => (
          <div key={item.id} className="sra-tiny-row">
            <span>{item.description || item.action}</span>
            <em>{shortDate(item.created_at)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SraRevenueOverview({ revenue, navigate }) {
  if (!revenue) return null;
  const trend = Number(revenue.trend_pct || 0);
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Revenus SaaS</span>
        <span className={`sra-status-chip ${trend >= 0 ? "sra-status-ok" : "sra-status-critical"}`}>
          {trend >= 0 ? "+" : ""}{trend}%
        </span>
      </div>
      <div className="sra-revenue-main">
        <span>Revenu mensuel</span>
        <strong>{money(revenue.monthly_revenue)}</strong>
      </div>
      <div className="sra-revenue-split">
        <div><span>Abonnements</span><strong>{money(revenue.subscription_revenue)}</strong></div>
        <div><span>Licences</span><strong>{money(revenue.license_revenue)}</strong></div>
      </div>
      <div className="sra-mini-stats">
        <button type="button" onClick={() => navigate?.("/super-root/licenses")}>Abo actifs {revenue.subscriptions?.active ?? 0}</button>
        <button type="button" onClick={() => navigate?.("/super-root/licenses")}>Trial {revenue.subscriptions?.trial ?? 0}</button>
        <button type="button" onClick={() => navigate?.("/super-root/licenses")}>Licences actives {revenue.licenses?.active ?? 0}</button>
      </div>
    </div>
  );
}

export function SraCriticalActions({ actions = [], navigate }) {
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Dernieres actions critiques</span>
        <button className="sra-mini-link" type="button" onClick={() => navigate?.("/super-root/audit-logs")}>Audit</button>
      </div>
      <div className="sra-compact-list">
        {actions.length === 0 ? (
          <div className="sra-compact-empty">Aucune action sensible recente.</div>
        ) : (
          actions.slice(0, 5).map((item) => (
            <div key={item.id} className="sra-compact-row">
              <span className={`sra-dot sra-dot-${severityConfig(item.severity).cls}`}></span>
              <div className="sra-compact-main">
                <div className="sra-row-title">{item.action}</div>
                <div className="sra-row-desc">{item.actor || "system"} - {item.target || item.source}</div>
              </div>
              <span className="sra-compact-time">{shortDate(item.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SraHealthTimeline({ timeline }) {
  if (!timeline) return null;
  const points = timeline.points || [];
  const trendIcon = timeline.trend === "up" ? "ti-trending-up" : timeline.trend === "down" ? "ti-trending-down" : "ti-minus";
  return (
    <div className="sra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Health timeline</span>
        <span className={`sra-status-chip ${timeline.trend === "down" ? "sra-status-warning" : "sra-status-ok"}`}>
          <i className={`ti ${trendIcon}`} aria-hidden="true"></i> {timeline.delta > 0 ? "+" : ""}{timeline.delta}
        </span>
      </div>
      <div className="sra-health-body">
        <div className="sra-health-score">
          <strong>{timeline.current}</strong>
          <span>/100 maintenant</span>
        </div>
        <div className="sra-health-bars">
          {points.slice(-12).map((point, index) => (
            <span
              key={`${point.recorded_at}-${index}`}
              style={{ height: `${Math.max(12, Number(point.score || 0))}%` }}
              title={`${point.score}/100 - ${point.reason}`}
            ></span>
          ))}
        </div>
        <p>{timeline.reason}</p>
      </div>
    </div>
  );
}
