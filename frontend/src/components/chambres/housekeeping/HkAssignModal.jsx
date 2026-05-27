import { useEffect, useState } from "react";

import { fetchJson } from "../../../api/client";

export default function HkAssignModal({ chambre, onClose, onSubmit }) {
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchJson("/api/users/?role=housekeeping")
      .then((payload) => {
        if (!alive) return;
        setAgents(Array.isArray(payload) ? payload : payload.results || []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    await onSubmit(selected);
    setLoading(false);
  };

  return (
    <div className="hk-modal-overlay">
      <div className="hk-modal">
        <div className="hk-modal-head">
          <span className="hk-modal-title">Assigner un agent - Ch. {chambre}</span>
          <button type="button" className="hk-modal-close" onClick={onClose}>x</button>
        </div>
        <select className="hk-modal-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choisir un agent...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {[agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.username || agent.email}
            </option>
          ))}
        </select>
        <div className="hk-modal-footer">
          <button type="button" className="hk-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="hk-btn hk-btn-green" onClick={handleSubmit} disabled={loading || !selected}>
            {loading ? "Assignation..." : "Assigner"}
          </button>
        </div>
      </div>
    </div>
  );
}
