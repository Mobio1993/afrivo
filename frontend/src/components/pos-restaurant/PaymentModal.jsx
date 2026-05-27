import { useState } from "react";

const MODES = [
  { key: "especes", label: "Especes" },
  { key: "carte", label: "Carte bancaire" },
  { key: "mobile_money", label: "Mobile Money" },
  { key: "chambre", label: "Ajouter a la chambre" },
];

export default function PaymentModal({ bill, onClose, onSuccess, processPayment }) {
  const [mode, setMode] = useState("especes");
  const [montant, setMontant] = useState(bill?.total || 0);
  const [sejourId, setSejourId] = useState("");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      await processPayment({ bill_id: bill.id, mode, montant, reference_externe: ref, sejour_id: sejourId || undefined });
      onSuccess?.();
    } catch (err) {
      setError(err.payload?.error || err.message || "Erreur de paiement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pos-modal-overlay">
      <div className="pos-modal">
        <div className="pos-modal-head">
          <span className="pos-modal-title">Encaisser {Number(bill?.total || 0).toLocaleString("fr-FR")} XOF</span>
          <button className="pos-modal-close" type="button" onClick={onClose}>x</button>
        </div>
        <div className="pos-mode-grid">
          {MODES.map((item) => (
            <button key={item.key} type="button" className={`pos-mode-btn ${mode === item.key ? "active" : ""}`} onClick={() => setMode(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <input className="pos-input" type="number" min="0" value={montant} onChange={(event) => setMontant(event.target.value)} />
        {mode === "chambre" ? <input className="pos-input" placeholder="ID sejour" value={sejourId} onChange={(event) => setSejourId(event.target.value)} /> : null}
        {mode === "carte" || mode === "mobile_money" ? <input className="pos-input" placeholder="Reference transaction" value={ref} onChange={(event) => setRef(event.target.value)} /> : null}
        {error ? <div className="pos-error">{error}</div> : null}
        <div className="pos-modal-footer">
          <button className="pos-btn" type="button" onClick={onClose}>Annuler</button>
          <button className="pos-btn pos-btn-primary" type="button" disabled={loading} onClick={handleSubmit}>
            {loading ? "Traitement..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
