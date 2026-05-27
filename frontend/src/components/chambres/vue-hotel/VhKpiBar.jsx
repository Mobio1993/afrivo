export default function VhKpiBar({ data }) {
  const fmt = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
  const total = (data.disponibles || 0) + (data.occupees || 0) + (data.nettoyage || 0) + (data.hors_service || 0);

  const kpis = [
    { label: "Disponibles", value: data.disponibles, color: "green", sub: "Pretes a louer" },
    { label: "Occupees", value: data.occupees, color: "red", sub: `${data.occupees} clients presents` },
    { label: "Nettoyage", value: data.nettoyage, color: "amber", sub: "En cours" },
    { label: "Taux occupation", value: fmtPct(data.taux_occupation_pct), color: "blue", sub: `${data.occupees}/${total} chambres` },
    { label: "Arrivees auj.", value: data.arrivees_today, color: "", sub: "Check-in attendus" },
    { label: "Departs auj.", value: data.departs_today, color: data.departs_today > 0 ? "amber" : "", sub: "Check-out prevus" },
    { label: "RevPAR", value: fmt(data.revpar), color: "", sub: "XOF / chambre" },
    { label: "Solde impaye", value: fmt(data.solde_total_impaye), color: data.solde_total_impaye > 0 ? "red" : "green", sub: "Total en attente" },
  ];

  return (
    <div className="vh-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="vh-kpi-cell">
          <div className="vh-kpi-lbl">{kpi.label}</div>
          <div className={`vh-kpi-val ${kpi.color ? `vh-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          <div className="vh-kpi-sub">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}
