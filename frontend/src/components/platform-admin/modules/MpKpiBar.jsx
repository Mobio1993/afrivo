export default function MpKpiBar({ data }) {
  const kpis = [
    {
      label: "Modules",
      value: data.modules_total,
      sub: "Catalogue plateforme",
      icon: "ti-puzzle",
      icoClass: "mp-ki-blue",
    },
    {
      label: "Actifs",
      value: data.modules_actifs,
      sub: "Disponibles a la vente",
      icon: "ti-circle-check",
      icoClass: "mp-ki-green",
      valClass: data.modules_actifs > 0 ? "mp-val-green" : "",
    },
    {
      label: "Hotels abonnes",
      value: data.hotels_abonnes_total,
      sub: "Toutes licences confondues",
      icon: "ti-building",
      icoClass: "mp-ki-amber",
    },
    {
      label: "Adoption moy.",
      value: `${data.taux_adoption_moyen}%`,
      sub: "Par module sur le parc",
      icon: "ti-chart-bar",
      icoClass: "mp-ki-purple",
      valClass: data.taux_adoption_moyen >= 20 ? "mp-val-green" : "mp-val-amber",
    },
  ];

  return (
    <div className="mp-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="mp-kpi-cell">
          <div className={`mp-kpi-ico ${kpi.icoClass}`}>
            <i className={`ti ${kpi.icon}`} aria-hidden="true"></i>
          </div>
          <div>
            <div className="mp-kpi-lbl">{kpi.label}</div>
            <div className={`mp-kpi-val ${kpi.valClass || ""}`}>{kpi.value}</div>
            <div className="mp-kpi-sub">{kpi.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
