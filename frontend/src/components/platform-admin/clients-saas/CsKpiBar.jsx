export default function CsKpiBar({ data }) {
  const kpis = [
    {
      label: "Clients SaaS",
      value: data.total,
      sub: "Organisations",
      icon: "ti-users",
      icoClass: "cs-ki-blue",
    },
    {
      label: "Actives",
      value: data.actives,
      sub: `${data.total > 0 ? Math.round((data.actives / data.total) * 100) : 0}% du portefeuille`,
      icon: "ti-circle-check",
      icoClass: "cs-ki-green",
      valClass: data.actives > 0 ? "cs-val-green" : "",
    },
    {
      label: "Suspendues",
      value: data.suspendues,
      sub: data.suspendues > 0 ? "Action requise" : "Aucune",
      icon: "ti-circle-x",
      icoClass: "cs-ki-red",
      valClass: data.suspendues > 0 ? "cs-val-red" : "",
    },
    {
      label: "Hotels rattaches",
      value: data.hotels_total,
      sub: "Inventaire cumule",
      icon: "ti-building",
      icoClass: "cs-ki-amber",
    },
    {
      label: "Abonnements actifs",
      value: data.abonnements_actifs,
      sub: "Contrats en cours",
      icon: "ti-receipt",
      icoClass: "cs-ki-purple",
    },
  ];

  return (
    <div className="cs-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="cs-kpi-cell">
          <div className={`cs-kpi-ico ${kpi.icoClass}`}>
            <i className={`ti ${kpi.icon}`} aria-hidden="true"></i>
          </div>
          <div>
            <div className="cs-kpi-lbl">{kpi.label}</div>
            <div className={`cs-kpi-val ${kpi.valClass || ""}`}>{kpi.value}</div>
            <div className="cs-kpi-sub">{kpi.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
