import { useState } from "react";

export default function HkProblemModal({ chambre, onClose, onSubmit }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    await onSubmit(message.trim());
    setLoading(false);
  };

  return (
    <div className="hk-modal-overlay">
      <div className="hk-modal">
        <div className="hk-modal-head">
          <span className="hk-modal-title">Signaler un probleme - Ch. {chambre}</span>
          <button type="button" className="hk-modal-close" onClick={onClose}>x</button>
        </div>
        <textarea className="hk-modal-textarea" rows={4} placeholder="Decrivez le probleme constate..." value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="hk-modal-footer">
          <button type="button" className="hk-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="hk-btn hk-btn-red" onClick={handleSubmit} disabled={loading || !message.trim()}>
            {loading ? "Envoi..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
