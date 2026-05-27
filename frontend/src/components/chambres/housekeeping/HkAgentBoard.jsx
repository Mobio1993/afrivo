export default function HkAgentBoard({ agents = [] }) {
  if (!agents.length) return <div className="hk-empty">Aucun agent sur la file du jour</div>;

  return (
    <div className="hk-agent-board">
      {agents.map((agent, index) => (
        <div key={`${agent.nom}-${index}`} className="hk-agent-row">
          <div className={`hk-agent-avatar ${agent.statut === "actif" ? "hk-av-actif" : agent.statut === "a_assigner" ? "hk-av-warn" : "hk-av-inactif"}`}>{agent.initiales}</div>
          <div className="hk-agent-info">
            <div className="hk-agent-name">{agent.nom}</div>
            <div className="hk-agent-tasks">
              {agent.statut === "a_assigner"
                ? `${agent.taches_total} tache(s) sans agent${agent.detail ? ` - ${agent.detail}` : ""}`
                : `${agent.taches_total} taches - ${agent.taches_terminees} terminees${agent.tache_en_cours ? ` - En cours : ${agent.tache_en_cours}` : ""}`}
            </div>
          </div>
          <div className="hk-agent-progress-wrap">
            <div className="hk-agent-bar-track">
              <div className="hk-agent-bar-fill" style={{ width: `${agent.progression_pct}%`, background: agent.statut === "a_assigner" ? "#E24B4A" : "#1D9E75" }} />
            </div>
            <div className="hk-agent-pct">{agent.progression_pct}%</div>
          </div>
          <span className={`hk-pill ${agent.statut === "actif" ? "hk-pill-b" : agent.statut === "a_assigner" ? "hk-pill-r" : "hk-pill-gr"}`}>
            {agent.statut === "actif" ? "Actif" : agent.statut === "a_assigner" ? "A assigner" : "Inactif"}
          </span>
        </div>
      ))}
    </div>
  );
}
