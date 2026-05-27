import { useEffect, useRef, useState } from "react";

const MODE_OPTIONS = [
  { value: "cash", label: "Especes" },
  { value: "card", label: "Carte" },
  { value: "bank_transfer", label: "Virement" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cheque", label: "Cheque" },
];

export default function DuPaiementModal({ onClose, onSuccess, ajouterPaiement }) {
  const dateInputRef = useRef(null);
  const [form, setForm] = useState({
    statut: "paye",
    mode_paiement: "cash",
    type_paiement: "paiement_complet",
    montant: "",
    date: "",
    reference_externe: "",
    devise: "XOF",
    notes_paiement: "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const closeNativeDatePicker = (event) => {
      const dateInput = dateInputRef.current;
      if (!dateInput || document.activeElement !== dateInput) {
        return;
      }
      if (event.target !== dateInput) {
        dateInput.blur();
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && document.activeElement === dateInputRef.current) {
        dateInputRef.current.blur();
      }
    };

    document.addEventListener("pointerdown", closeNativeDatePicker, true);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeNativeDatePicker, true);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, []);

  const handleSubmit = async () => {
    if (!form.montant || Number.parseFloat(form.montant) <= 0) {
      setFeedback({ type: "error", msg: "Le montant doit etre strictement positif." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const result = await ajouterPaiement(form);
    setSaving(false);
    if (result.success) {
      onSuccess();
    } else {
      setFeedback({ type: "error", msg: result.error || "Erreur lors de l'ajout du paiement." });
    }
  };

  return (
    <div className="du-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="du-modal-title">
      <div className="du-modal">
        <div className="du-modal-head">
          <span className="du-modal-title" id="du-modal-title">Ajouter un encaissement</span>
          <button className="du-modal-close" onClick={onClose} type="button" aria-label="Fermer">×</button>
        </div>

        <div className="du-form-grid">
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-status">Statut</label>
            <select id="du-pay-status" value={form.statut} onChange={(event) => set("statut", event.target.value)}>
              <option value="paye">Paye</option>
              <option value="en_attente">En attente</option>
            </select>
          </div>
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-mode">Mode de paiement</label>
            <select id="du-pay-mode" value={form.mode_paiement} onChange={(event) => set("mode_paiement", event.target.value)}>
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-amount">Montant *</label>
            <input id="du-pay-amount" type="number" step="0.01" min="0" value={form.montant} onChange={(event) => set("montant", event.target.value)} />
          </div>
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-date">Date et heure</label>
            <input
              id="du-pay-date"
              ref={dateInputRef}
              type="datetime-local"
              value={form.date}
              onChange={(event) => {
                set("date", event.target.value);
                event.currentTarget.blur();
              }}
            />
          </div>
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-ref">Reference externe</label>
            <input id="du-pay-ref" type="text" value={form.reference_externe} onChange={(event) => set("reference_externe", event.target.value)} />
          </div>
          <div className="du-fg">
            <label className="du-form-lbl" htmlFor="du-pay-currency">Devise</label>
            <input id="du-pay-currency" type="text" value={form.devise} onChange={(event) => set("devise", event.target.value)} />
          </div>
        </div>

        <div className="du-fg du-notes-field">
          <label className="du-form-lbl" htmlFor="du-pay-notes">Notes de paiement</label>
          <textarea id="du-pay-notes" rows={2} value={form.notes_paiement} onChange={(event) => set("notes_paiement", event.target.value)} />
        </div>

        {feedback && <div className={`du-feedback du-feedback-${feedback.type}`}>{feedback.msg}</div>}

        <div className="du-modal-footer">
          <button className="du-btn" onClick={onClose} type="button">Annuler</button>
          <button className="du-btn-submit du-btn-submit-sm" onClick={handleSubmit} disabled={saving} type="button">
            {saving ? "Enregistrement..." : "Ajouter le paiement"}
          </button>
        </div>
      </div>
    </div>
  );
}
