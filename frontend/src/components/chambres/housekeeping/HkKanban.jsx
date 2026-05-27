import HkKanbanCard from "./HkKanbanCard";

const COLUMNS = [
  { key: "kanban_a_nettoyer", label: "A nettoyer", color: "#633806", countKey: "a_nettoyer_count" },
  { key: "kanban_en_cours", label: "En cours", color: "#185FA5", countKey: "en_cours_count" },
  { key: "kanban_termine", label: "Termine", color: "#0F6E56", countKey: "termine_count" },
  { key: "kanban_probleme", label: "Probleme", color: "#A32D2D", countKey: null },
];

export default function HkKanban({ data, onSelectTask }) {
  return (
    <div className="hk-kanban">
      {COLUMNS.map((column) => {
        const tasks = data[column.key] || [];
        const display = column.key === "kanban_termine" ? tasks.slice(-3) : tasks;
        const count = column.countKey ? data[column.countKey] : tasks.length;
        return (
          <div key={column.key} className="hk-k-col">
            <div className="hk-k-col-head">
              <span className="hk-k-col-title">{column.label}</span>
              <span className="hk-k-count" style={{ color: column.color }}>{count}</span>
            </div>
            {display.map((task) => <HkKanbanCard key={task.id} task={task} onSelect={onSelectTask} />)}
            {column.key === "kanban_termine" && tasks.length > 3 && <div className="hk-k-more">+{tasks.length - 3} autres terminees</div>}
            {!tasks.length && <div className="hk-k-empty">Aucune tache</div>}
          </div>
        );
      })}
    </div>
  );
}
