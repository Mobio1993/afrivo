import { useEffect, useState } from "react";

const STATUT_OPTIONS = ["paid", "pending", "cancelled", "refunded"];
const MODE_OPTIONS = ["cash", "card", "transfer", "mobile_money", "cheque", "other"];
const TYPE_OPTIONS = [
  "invoice_payment",
  "advance",
  "deposit",
  "credit_topup",
  "day_use_prepayment",
  "partial",
  "full",
  "refund",
  "adjustment",
];

function buildInitialForm(payment) {
  return {
    statut: payment.statut || payment.status || "",
    mode_paiement: payment.mode_paiement || payment.method || "",
    type_paiement: payment.type_paiement || payment.payment_type || "",
    montant: payment.montant ?? payment.amount ?? "",
    devise: payment.devise || payment.currency || "XOF",
    date: payment.date || payment.paid_at || "",
    origine: payment.origine || payment.source || "",
    reference_externe: payment.reference_externe || payment.external_reference || "",
    notes_internes: payment.notes_internes || payment.notes || "",
  };
}

export default function PayTabCorrection({ payment, patchPayment, onSuccess }) {
  const [form, setForm] = useState(() => buildInitialForm(payment));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm(buildInitialForm(payment));
    setFeedback(null);
  }, [payment]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const result = await patchPayment(form);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: "success", msg: "Modifications enregistrees avec succes." });
      await onSuccess();
      return;
    }
    setFeedback({ type: "error", msg: "Erreur lors de la mise a jour. Verifiez les champs." });
  }

  return (
    <form className="pay-correction-form" onSubmit={handleSubmit}>
      <div className="pay-two-col">
        <div>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Statut</span>
            <select value={form.statut} onChange={(event) => set("statut", event.target.value)}>
              {STATUT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Mode de paiement</span>
            <select value={form.mode_paiement} onChange={(event) => set("mode_paiement", event.target.value)}>
              {MODE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Type de paiement</span>
            <select value={form.type_paiement} onChange={(event) => set("type_paiement", event.target.value)}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Montant</span>
            <input type="number" step="0.01" value={form.montant} onChange={(event) => set("montant", event.target.value)} />
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Devise</span>
            <input type="text" value={form.devise} onChange={(event) => set("devise", event.target.value)} />
          </label>
        </div>
        <div>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Date</span>
            <input type="datetime-local" value={String(form.date || "").slice(0, 16)} onChange={(event) => set("date", event.target.value)} />
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Origine</span>
            <input type="text" value={form.origine} onChange={(event) => set("origine", event.target.value)} />
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Reference externe</span>
            <input type="text" value={form.reference_externe} onChange={(event) => set("reference_externe", event.target.value)} />
          </label>
          <label className="pay-form-group">
            <span className="pay-form-lbl">Notes internes</span>
            <textarea rows={4} value={form.notes_internes} onChange={(event) => set("notes_internes", event.target.value)} />
          </label>
        </div>
      </div>

      {feedback ? <div className={`pay-feedback pay-feedback-${feedback.type}`}>{feedback.msg}</div> : null}

      <button className="pay-btn-submit" type="submit" disabled={saving}>
        {saving ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>
    </form>
  );
}
