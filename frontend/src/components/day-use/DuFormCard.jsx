import { useEffect, useState } from "react";

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 16);
}

export default function DuFormCard({ dayUse, patchDayUse, onSuccess, canEdit = false }) {
  const [form, setForm] = useState({
    formule: dayUse.formule || "",
    depassement: dayUse.depassement || "",
    supplement: dayUse.supplement || "0",
    entree_prevue: toDateTimeLocal(dayUse.entree_prevue),
    notes_internes: dayUse.notes_internes || "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm({
      formule: dayUse.formule || "",
      depassement: dayUse.depassement || "",
      supplement: dayUse.supplement || "0",
      entree_prevue: toDateTimeLocal(dayUse.entree_prevue),
      notes_internes: dayUse.notes_internes || "",
    });
  }, [dayUse.id, dayUse.formule, dayUse.depassement, dayUse.supplement, dayUse.entree_prevue, dayUse.notes_internes]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await patchDayUse(form);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: "success", msg: "Modifications enregistrees." });
      onSuccess();
    } else {
      setFeedback({ type: "error", msg: result.error || "Erreur lors de la mise a jour." });
    }
  };

  const total = (Number.parseFloat(form.formule) || 0) + (Number.parseFloat(form.supplement) || 0);

  return (
    <div className="du-card du-form-card">
      <div className="du-sec-label">Modifier le day use</div>

      <div className="du-form-grid">
        <div className="du-fg">
          <label className="du-form-lbl" htmlFor="du-formule">Formule (XOF)</label>
          <input id="du-formule" type="number" value={form.formule} onChange={(event) => set("formule", event.target.value)} />
        </div>
        <div className="du-fg">
          <label className="du-form-lbl" htmlFor="du-supplement">Supplement</label>
          <input id="du-supplement" type="number" value={form.supplement} onChange={(event) => set("supplement", event.target.value)} />
        </div>
        <div className="du-fg">
          <label className="du-form-lbl" htmlFor="du-depassement">Depassement</label>
          <select id="du-depassement" value={form.depassement} onChange={(event) => set("depassement", event.target.value)}>
            <option value="">Aucun depassement</option>
            <option value="30min">30 minutes</option>
            <option value="1h">1 heure</option>
            <option value="2h">2 heures</option>
          </select>
        </div>
        <div className="du-fg">
          <label className="du-form-lbl" htmlFor="du-entree">Entree prevue</label>
          <input id="du-entree" type="datetime-local" value={form.entree_prevue} onChange={(event) => set("entree_prevue", event.target.value)} />
        </div>
      </div>

      <div className="du-fg du-notes-field">
        <label className="du-form-lbl" htmlFor="du-notes">Notes internes</label>
        <textarea
          id="du-notes"
          rows={3}
          value={form.notes_internes}
          onChange={(event) => set("notes_internes", event.target.value)}
          placeholder="Consigne utile pour l'equipe..."
        />
      </div>

      <div className="du-verif">
        <div className="du-verif-row">
          <span className="du-vdot du-vdot-green" />
          <span className="du-vk">Formule</span>
          <span className="du-vv">{Number(form.formule || 0).toLocaleString("fr-FR")} XOF</span>
        </div>
        <div className="du-verif-row">
          <span className={`du-vdot ${form.entree_prevue ? "du-vdot-green" : "du-vdot-amber"}`} />
          <span className="du-vk">Entree prevue</span>
          <span className="du-vv">{form.entree_prevue || "A completer"}</span>
        </div>
        <div className="du-verif-row">
          <span className="du-vdot du-vdot-green" />
          <span className="du-vk">Total estime</span>
          <span className="du-vv">{total.toLocaleString("fr-FR")} XOF</span>
        </div>
      </div>

      {feedback && <div className={`du-feedback du-feedback-${feedback.type}`}>{feedback.msg}</div>}

        <button className="du-btn-submit" onClick={handleSubmit} disabled={!canEdit || saving} type="button">
        {saving ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>
    </div>
  );
}
