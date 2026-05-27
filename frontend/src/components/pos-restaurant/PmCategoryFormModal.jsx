import { useState } from "react";

export default function PmCategoryFormModal({ onClose, onSubmit }) {
  const [nom, setNom] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!nom.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ nom: nom.trim(), ordre: 0 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pm-modal-overlay">
      <div className="pm-modal pm-modal-sm">
        <div className="pm-modal-head">
          <span className="pm-modal-title">Nouvelle categorie</span>
          <button type="button" className="pm-modal-close" onClick={onClose}>x</button>
        </div>
        <div className="pm-modal-body">
          <div className="pm-fg">
            <label className="pm-form-lbl">Nom de la categorie *</label>
            <input className={`pm-form-input ${error ? "pm-input-error" : ""}`} value={nom} onChange={(event) => { setNom(event.target.value); setError(""); }} autoFocus />
            {error ? <div className="pm-field-error">{error}</div> : null}
          </div>
        </div>
        <div className="pm-modal-footer">
          <button type="button" className="pm-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="pm-btn pm-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creation..." : "Creer la categorie"}
          </button>
        </div>
      </div>
    </div>
  );
}
