import { useState } from "react";

export default function VoidModal({ item, onClose, onSubmit }) {
  const [reasonId, setReasonId] = useState("");
  return (
    <div className="pos-modal-overlay">
      <div className="pos-modal">
        <div className="pos-modal-head">
          <span className="pos-modal-title">Annuler un article</span>
          <button className="pos-modal-close" type="button" onClick={onClose}>x</button>
        </div>
        <p className="pos-muted">{item?.item_nom || "Article"} - raison obligatoire.</p>
        <input className="pos-input" placeholder="ID raison" value={reasonId} onChange={(event) => setReasonId(event.target.value)} />
        <div className="pos-modal-footer">
          <button className="pos-btn" type="button" onClick={onClose}>Fermer</button>
          <button className="pos-btn pos-btn-danger" type="button" disabled={!reasonId} onClick={() => onSubmit?.(reasonId)}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
