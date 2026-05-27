export default function PriorityQueues({
  tasks = [],
  canStartHousekeeping = false,
  canAssignHousekeeping = false,
  canResolveMaintenance = false,
  onStartHousekeeping,
  onAssignHousekeeping,
  onResolveMaintenance,
  onDetail,
}) {
  return (
    <section className="hv-panel">
      <div className="hv-panel-title">Files prioritaires</div>
      <div className="hv-priority-list">
        {tasks.length ? tasks.map((task) => (
          <article key={`${task.kind}-${task.id}`} className={`hv-priority hv-priority-${task.kind}`}>
            <div>
              <strong>Ch. {task.room}</strong>
              <span>{task.title}</span>
            </div>
            <div className="hv-priority-meta">
              <span>{task.urgency}</span>
              <span>{task.agent}</span>
              <span>{task.wait}</span>
            </div>
            <div className="hv-priority-actions">
              {task.kind === "housekeeping" && canStartHousekeeping && <button type="button" onClick={() => onStartHousekeeping?.(task.raw)}>Demarrer</button>}
              {task.kind === "housekeeping" && canAssignHousekeeping && <button type="button" onClick={() => onAssignHousekeeping?.(task.raw)}>Assigner</button>}
              {task.kind === "maintenance" && canResolveMaintenance && <button type="button" onClick={() => onResolveMaintenance?.(task.raw)}>Resoudre</button>}
              <button type="button" onClick={() => onDetail?.(task)}>Voir detail</button>
            </div>
          </article>
        )) : <div className="hv-empty">Aucune file prioritaire</div>}
      </div>
    </section>
  );
}
