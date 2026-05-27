export default function VhPriorityQueue({ tasks = [], onDemarrer, onTerminer, onAssigner }) {
  const delayed = tasks.filter((task) => task.en_retard).length;

  return (
    <div className="vh-priority-queue">
      <div className="vh-sec-label">
        Files prioritaires
        {delayed ? <span className="vh-badge-count">{delayed} en retard</span> : null}
      </div>
      {tasks.length === 0 ? <div className="vh-empty">Aucune tache housekeeping en cours ou en attente</div> : null}
      {tasks.map((task) => (
        <div
          key={task.task_id}
          className={`vh-pq-row ${
            task.en_retard && task.statut === "en_cours" ? "vh-pq-retard" :
            task.en_retard ? "vh-pq-warn" :
            task.statut === "en_cours" ? "vh-pq-encours" : "vh-pq-attente"
          }`}
        >
          <div className={`vh-pq-room ${task.en_retard ? "vh-pq-room-r" : task.statut === "en_cours" ? "vh-pq-room-b" : "vh-pq-room-a"}`}>
            {task.chambre_numero}
          </div>
          <div className="vh-pq-info">
            <div className="vh-pq-name">{task.type_tache_display} - {task.priorite_display}</div>
            <div className="vh-pq-sub">
              {task.statut === "en_cours"
                ? `En cours ${task.elapsed_min}/${task.temps_estime} min${task.agent_nom ? ` · ${task.agent_nom}` : ""}`
                : `Attente ${task.attente_min} min · ${task.agent_nom || "Agent non attribue"}`}
            </div>
            {task.statut === "en_cours" ? (
              <div className="vh-pq-progress">
                <div className="vh-pq-track">
                  <div className="vh-pq-fill" style={{ width: `${task.progression_pct}%`, background: task.en_retard ? "#E24B4A" : "#1D9E75" }} />
                </div>
                <span className="vh-pq-pct">{task.progression_pct}%</span>
              </div>
            ) : null}
          </div>
          <span className={`vh-pill ${task.en_retard ? "vh-pill-r" : task.statut === "en_cours" ? "vh-pill-b" : "vh-pill-a"}`}>
            {task.en_retard ? "Retard" : task.statut === "en_cours" ? "En cours" : "Attente"}
          </span>
          <div className="vh-pq-actions">
            {task.statut === "a_nettoyer" ? <button type="button" className="vh-btn-xs vh-btn-g" onClick={() => onDemarrer?.(task.task_id)}>Demarrer</button> : null}
            <button type="button" className="vh-btn-xs vh-btn-g" onClick={() => onTerminer?.(task.task_id)}>Terminer</button>
            {!task.agent_nom ? <button type="button" className="vh-btn-xs" onClick={() => onAssigner?.(task.task_id)}>Assigner</button> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
