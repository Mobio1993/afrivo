export default function SraStatusBanner({ data, onAction }) {
  if (!data) return null;
  const { score, scoreInfo, scoreDescription, kpis, lastRefresh } = data;
  const uptimeStatus = kpis.uptime >= 99 ? "ok" : "warning";
  const erreursStatus = kpis.erreursApi5xx > 0 ? "critical" : "ok";
  const incidentsStatus = kpis.incidents7j > 0 ? "warning" : "ok";
  const alertesStatus = kpis.alertes > 0 ? "warning" : "ok";
  const kpiList = [
    { label: "Plateformes", value: kpis.plateformes, color: "#5DCAA5", status: "ok" },
    { label: "Hotels", value: kpis.hotels, color: "#5DCAA5", status: "ok" },
    { label: "Revenus/mois", value: kpis.revenueMois ? `${Number(kpis.revenueMois).toLocaleString("fr-FR")} XOF` : "-", color: "#fff", status: "neutral" },
    { label: "Uptime", value: `${kpis.uptime}%`, color: uptimeStatus === "ok" ? "#5DCAA5" : "#EF9F27", status: uptimeStatus },
    { label: "Erreurs API 5xx", value: kpis.erreursApi5xx ?? 0, color: erreursStatus === "critical" ? "#F09595" : "#5DCAA5", status: erreursStatus },
    { label: "Incidents 7j", value: kpis.incidents7j ?? 0, color: incidentsStatus === "warning" ? "#EF9F27" : "#5DCAA5", status: incidentsStatus },
    { label: "Alertes", value: kpis.alertes ?? 0, color: alertesStatus === "warning" ? "#EF9F27" : "#5DCAA5", status: alertesStatus },
  ];
  const actions = [
    { id: "create", icon: "ti-building-plus", label: "Nouvelle plateforme", cls: "sra-btn-primary" },
    { id: "maintenance", icon: "ti-tool", label: "Maintenance", cls: "sra-btn-danger" },
    { id: "admins", icon: "ti-user-shield", label: "Admins", cls: "sra-btn-ghost" },
    { id: "billing", icon: "ti-receipt", label: "Facturation", cls: "sra-btn-ghost" },
  ];

  return (
    <div className="sra-banner">
      <div className="sra-banner-left">
        <div className="sra-score-circle" style={{ borderColor: scoreInfo.color }}>
          <span className="sra-score-val" style={{ color: scoreInfo.color }}>{score}</span>
          <span className="sra-score-sub">/100</span>
        </div>
        <div className="sra-banner-info">
          <span className="sra-score-label" style={{ background: scoreInfo.bg, color: scoreInfo.color }}>
            {scoreInfo.label}
          </span>
          <span className="sra-banner-desc">{scoreDescription}</span>
          {lastRefresh && <span className="sra-banner-refresh">Mis a jour : {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>
      <div className="sra-banner-kpis">
        {kpiList.map((item) => (
          <div key={item.label} className={`sra-bk sra-bk-${item.status}`}>
            <span className="sra-bk-val" style={{ color: item.color }}>{item.value}</span>
            <span className="sra-bk-lbl">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="sra-banner-actions">
        {actions.map((action) => (
          <button key={action.id} className={`sra-action-btn ${action.cls}`} onClick={() => onAction?.(action.id)} type="button">
            <i className={`ti ${action.icon}`} aria-hidden="true"></i>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
