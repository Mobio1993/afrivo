export default function RtKpiBar({ summary, lastUpdate }) {
  const fmt = (value) => value !== null && value !== undefined ? value : "-";
  const kpis = [
    { label: "Disponibles", value: summary.disponibles, color: "green", sub: "Pretes a louer" },
    { label: "Occupees", value: summary.occupees, color: "blue", sub: "Avec presence" },
    { label: "Nettoyage", value: summary.nettoyage, color: "amber", sub: "En cours" },
    { label: "Alertes actives", value: summary.alertes_actives, color: summary.alertes_actives > 0 ? "red" : "", sub: "Requierent action" },
    { label: "Temp. moyenne", value: summary.temperature_moyenne !== null ? `${summary.temperature_moyenne}°C` : "-", color: "", sub: "Parc hotelier" },
    { label: "Humidite moyenne", value: summary.humidite_moyenne !== null ? `${summary.humidite_moyenne}%` : "-", color: "", sub: "Parc hotelier" },
    { label: "Capteurs HS", value: summary.capteurs_hors_ligne, color: summary.capteurs_hors_ligne > 0 ? "red" : "green", sub: "Hors ligne" },
    { label: "Portes ouvertes", value: summary.portes_ouvertes_long, color: summary.portes_ouvertes_long > 0 ? "amber" : "green", sub: ">10 min" },
  ];

  return (
    <div className="rt-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rt-kpi-cell">
          <div className="rt-kpi-lbl">{kpi.label}</div>
          <div className={`rt-kpi-val ${kpi.color ? `rt-kpi-${kpi.color}` : ""}`}>{fmt(kpi.value)}</div>
          <div className="rt-kpi-sub">{kpi.sub}</div>
        </div>
      ))}
      {lastUpdate && (
        <div className="rt-kpi-update">
          Mise a jour : {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}
    </div>
  );
}
