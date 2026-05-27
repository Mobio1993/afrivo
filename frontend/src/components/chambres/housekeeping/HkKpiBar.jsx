export default function HkKpiBar({ data }) {
  const kpis = [
    { label: "A nettoyer", value: data.a_nettoyer_count, color: data.a_nettoyer_count > 0 ? "amber" : "green", sub: "File en attente" },
    { label: "En cours", value: data.en_cours_count, color: "blue", sub: "Agents actifs" },
    { label: "Terminees", value: data.termine_count, color: "green", sub: "Aujourd'hui" },
    { label: "Duree moyenne", value: `${data.duree_moyenne_min} min`, color: "", sub: "Par tache" },
    { label: "En retard", value: data.en_retard_count, color: data.en_retard_count > 0 ? "red" : "green", sub: "Depassements" },
    { label: "Agents actifs", value: data.agents_actifs_count, color: "", sub: "Sur le terrain" },
    { label: "Non attribuees", value: data.non_attribuees_count, color: data.non_attribuees_count > 0 ? "amber" : "green", sub: "Sans agent" },
  ];

  return (
    <div className="hk-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="hk-kpi-cell">
          <div className="hk-kpi-lbl">{kpi.label}</div>
          <div className={`hk-kpi-val ${kpi.color ? `hk-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          <div className="hk-kpi-sub">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}
