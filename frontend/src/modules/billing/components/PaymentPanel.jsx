import { useEffect, useRef, useState } from "react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte bancaire" },
  { value: "transfer", label: "Virement" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Chèque" },
  { value: "other", label: "Autre" },
];

function fmt(value) {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

function methodLabel(method) {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
}

function StatusPill({ status }) {
  const map = {
    paid: { label: "Confirmé", cls: "pill--paid" },
    pending: { label: "En attente", cls: "pill--pending" },
    cancelled: { label: "Annulé", cls: "pill--cancelled" },
    refunded: { label: "Remboursé", cls: "pill--refunded" },
  };
  const c = map[status] || { label: status, cls: "" };
  return <span className={`pay-pill ${c.cls}`}>{c.label}</span>;
}

export function PaymentPanel({
  invoice,
  onAddPayment,
  loading = false,
  canCreate = false,
  openSignal = 0,
}) {
  const panelRef = useRef(null);
  const lastOpenSignal = useRef(openSignal);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    method: "cash",
    external_reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const payments = invoice?.payments || [];
  const currency = invoice?.currency || "XOF";
  const balanceDue = parseFloat(invoice?.balance_due || 0);
  const canPay = invoice && !["cancelled", "paid"].includes(invoice.status);

  function openPaymentForm() {
    setError("");
    setForm((f) => ({ ...f, amount: balanceDue > 0 ? String(balanceDue) : "" }));
    setOpen(true);
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => {
    if (openSignal === lastOpenSignal.current) return;
    if (!canCreate || !canPay) return;
    lastOpenSignal.current = openSignal;
    openPaymentForm();
  }, [openSignal, canCreate, canPay, balanceDue]);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      setError("Le montant doit être positif.");
      return;
    }
    if (balanceDue > 0 && amount > balanceDue) {
      setError("Le montant ne peut pas depasser le solde restant.");
      return;
    }
    setSubmitting(true);
    try {
      await onAddPayment({
        amount: form.amount,
        method: form.method,
        payment_type: balanceDue > 0 && amount >= balanceDue ? "full" : "partial",
        external_reference: form.external_reference,
        notes: form.notes,
      });
      setForm({ amount: "", method: "cash", external_reference: "", notes: "" });
      setOpen(false);
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Erreur lors du paiement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="billing-payment-panel" ref={panelRef}>
      <div className="billing-payment-head">
        <div>
          <strong>Paiements</strong>
          {balanceDue > 0 && (
            <span className="billing-payment-balance">
              Solde a encaisser : {fmt(balanceDue)} {currency}
            </span>
          )}
        </div>
        {canCreate && canPay && !open && (
          <button
            type="button"
            className="secondary-button billing-pay-btn"
            onClick={openPaymentForm}
          >
            + Ajouter un paiement
          </button>
        )}
      </div>

      {open && (
        <form className="billing-payment-form" onSubmit={handleSubmit}>
          <div className="billing-payment-form-grid">
            <div className="form-field">
              <label className="form-label">Montant *</label>
              <input
                type="number"
                className="form-input"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder={balanceDue > 0 ? `Solde : ${fmt(balanceDue)}` : "Montant"}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Mode de paiement *</label>
              <select
                className="form-input"
                value={form.method}
                onChange={(e) => handleChange("method", e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Référence externe</label>
              <input
                type="text"
                className="form-input"
                value={form.external_reference}
                onChange={(e) => handleChange("external_reference", e.target.value)}
                placeholder="N° chèque, réf. virement..."
              />
            </div>
            <div className="form-field">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>
          {error && <div className="billing-payment-error">{error}</div>}
          <div className="billing-payment-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => { setOpen(false); setError(""); }}
              disabled={submitting}
            >
              Annuler
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer le paiement"}
            </button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <div className="billing-payment-empty">Aucun paiement enregistré.</div>
      ) : (
        <div className="billing-payment-list">
          {payments.map((p) => (
            <div key={p.id} className="billing-payment-row">
              <div className="billing-payment-row-left">
                <span className="billing-payment-row-ref">{p.reference}</span>
                <span className="billing-payment-row-method">{methodLabel(p.method)}</span>
                {p.external_reference && (
                  <span className="billing-payment-row-extref">Réf : {p.external_reference}</span>
                )}
                {p.recorded_by_name && (
                  <span className="billing-payment-row-by">Par {p.recorded_by_name}</span>
                )}
              </div>
              <div className="billing-payment-row-right">
                <span className="billing-payment-row-amount">
                  {fmt(p.amount)} {currency}
                </span>
                <StatusPill status={p.status} />
                <span className="billing-payment-row-date">{fmtDate(p.paid_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
