export default function HkStats({ data }) {
  const types = Object.values(data.stats_par_type || {});
  const agents = data.stats_duree_par_agent || [];
  const colors = ["#1D9E75", "#378ADD", "#7F77DD", "#E24B4A", "#EF9F27"];

  return (
    <div className="hk-stats-row">
      <div className="hk-stat-box">
        <div className="hk-stat-title">Taches par type</div>
        {types.length ? types.map((type, index) => (
          <div key={type.label} className="hk-sb-row">
            <span className="hk-sb-lbl">{type.label}</span>
            <div className="hk-sb-track"><div className="hk-sb-fill" style={{ width: `${type.pct}%`, background: colors[index % colors.length] }} /></div>
            <span className="hk-sb-val">{type.count} ({type.pct}%)</span>
          </div>
        )) : <div className="hk-empty">Aucune tache aujourd'hui</div>}
      </div>

      <div className="hk-stat-box">
        <div className="hk-stat-title">Duree moyenne par agent</div>
        {agents.length ? agents.map((agent) => (
          <div key={agent.nom} className="hk-sb-row">
            <span className="hk-sb-lbl">{agent.nom.split(" ")[0]}</span>
            <div className="hk-sb-track"><div className="hk-sb-fill" style={{ width: `${agent.pct}%`, background: "#1D9E75" }} /></div>
            <span className="hk-sb-val">{agent.duree_moy_min} min</span>
          </div>
        )) : <div className="hk-empty">Pas encore de durees agent</div>}
        <div className="hk-sb-row">
          <span className="hk-sb-lbl">Moyenne</span>
          <div className="hk-sb-track"><div className="hk-sb-fill" style={{ width: "80%", background: "#888" }} /></div>
          <span className="hk-sb-val">{data.stats_duree_moyenne} min</span>
        </div>
      </div>
    </div>
  );
}
