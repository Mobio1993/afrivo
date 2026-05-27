const PRIORITY_COLORS = { urgent: "hk-urgence-haute", high: "hk-urgence-haute", normal: "hk-urgence-norm", low: "hk-urgence-basse" };
const STATUS_PILL = { pending: "hk-pill-a", in_progress: "hk-pill-b", completed: "hk-pill-g", cancelled: "hk-pill-gr" };

export default function HkKanbanCard({ task, onSelect }) {
  const isEnCours = task.statut === "in_progress";
  const isRetard = task.est_en_retard;

  return (
    <div className={`hk-k-card ${isRetard ? "hk-k-card-retard" : ""} ${isEnCours ? "hk-k-card-encours" : ""}`} onClick={() => onSelect?.(task)}>
      <div className="hk-k-card-header">
        <span className="hk-k-num">Ch. {task.chambre_numero}</span>
        <div className="hk-k-dots">
          {isRetard && <span className="hk-k-retard-badge">Retard</span>}
          <div className={`hk-urgence-dot ${PRIORITY_COLORS[task.priorite] || ""}`} />
        </div>
      </div>
      <div className="hk-k-type">{task.type_tache_display}</div>
      <div className="hk-k-meta">
        <span className={`hk-pill ${STATUS_PILL[task.statut] || "hk-pill-r"}`}>{task.statut_display}</span>
        {task.agent_nom && <span className="hk-k-agent-dot" title={task.agent_nom}>{task.agent_nom.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>}
        {isEnCours && <span className="hk-k-timer">{task.duree_ecoulee_min}min</span>}
        {task.statut === "pending" && task.attente_min > 0 && <span className="hk-k-timer">Attente {task.attente_min}min</span>}
      </div>
      {isEnCours && (
        <div className="hk-k-progress">
          <div className="hk-k-progress-fill" style={{ width: `${task.progression_pct}%`, background: task.est_en_retard ? "#E24B4A" : "#1D9E75" }} />
        </div>
      )}
    </div>
  );
}
