function Delta({ value, unit = "%" }) {
  if (value === 0 || value === null || value === undefined) {
    return <span className="rp-delta rp-delta-neu">— Stable</span>;
  }
  const up = Number(value) > 0;
  return (
    <span className={`rp-delta ${up ? "rp-delta-up" : "rp-delta-dn"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{value}{unit}
    </span>
  );
}

const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const fmtPct = (value) => `${Number(value || 0).toFixed(1)}%`;

export default function RpKpiGrid({ data }) {
  const kpis = [
    {
      label: "Encaissements periode",
      value: fmt(data.encaissements_total),
      sub: "XOF",
      delta: data.delta_encaissements,
      unit: "%",
    },
    {
      label: "Occupation actuelle",
      value: fmtPct(data.occupation_rate),
      sub: "Lecture parc hotelier",
      delta: data.delta_occupation,
      unit: " pts",
      color: "blue",
    },
    {
      label: "Day use crees",
      value: data.day_use_count,
      sub: "Activite flux courts",
      delta: data.delta_day_use,
      unit: "",
    },
    {
      label: "Taux recouvrement",
      value: fmtPct(data.taux_recouvrement),
      sub: "Paiements valides vs attente",
      delta: data.delta_taux_recouvrement,
      unit: " pts",
      color: "green",
    },
    {
      label: "RevPAR",
      value: fmt(data.revpar),
      sub: "Revenu par chambre disponible",
      delta: data.delta_revpar,
      unit: "%",
    },
    {
      label: "Ticket moyen",
      value: fmt(data.ticket_moyen),
      sub: "Par paiement valide",
      delta: null,
    },
  ];

  return (
    <div className="rp-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rp-kpi-card">
          <div className="rp-kpi-lbl">{kpi.label}</div>
          <div className={`rp-kpi-val ${kpi.color ? `rp-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          <div className="rp-kpi-sub">{kpi.sub}</div>
          {kpi.delta !== null && kpi.delta !== undefined && <Delta value={kpi.delta} unit={kpi.unit} />}
        </div>
      ))}
    </div>
  );
}
