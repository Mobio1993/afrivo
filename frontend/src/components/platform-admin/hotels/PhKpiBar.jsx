export default function PhKpiBar({ data }) {
  const kpis = [
    { label: "Hotels total", value: data.hotels_total, sub: "Inventaire global", icon: "ti-building", color: "blue" },
    {
      label: "Hotels actifs",
      value: data.hotels_actifs,
      sub: `${data.hotels_total > 0 ? Math.round((data.hotels_actifs / data.hotels_total) * 100) : 0}% du parc`,
      icon: "ti-circle-check",
      color: "green",
    },
    {
      label: "Suspendus",
      value: data.hotels_suspendus,
      sub: "Hors service",
      icon: "ti-circle-x",
      color: data.hotels_suspendus > 0 ? "red" : "green",
    },
    { label: "Admins hotel", value: data.admins_total, sub: "Comptes admin actifs", icon: "ti-shield-check", color: "purple" },
    { label: "Utilisateurs", value: data.utilisateurs_total, sub: "Tous hotels confondus", icon: "ti-users", color: "amber" },
    {
      label: "Quota critique",
      value: data.quota_critique_count,
      sub: data.quota_critique_count > 0 ? "Hotels a surveiller" : "Aucun",
      icon: "ti-alert-triangle",
      color: data.quota_critique_count > 0 ? "red" : "green",
    },
  ];

  return (
    <div className="ph-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="ph-kpi-cell">
          <div className={`ph-kpi-ico ph-kpi-ico-${kpi.color}`}>
            <i className={`ti ${kpi.icon}`} aria-hidden="true" />
          </div>
          <div>
            <div className="ph-kpi-lbl">{kpi.label}</div>
            <div className={`ph-kpi-val ph-kpi-${kpi.color}`}>{kpi.value}</div>
            <div className="ph-kpi-sub">{kpi.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
