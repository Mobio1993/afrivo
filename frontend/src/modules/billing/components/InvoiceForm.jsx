import { useEffect, useState } from "react";

import { InvoiceLineEditor } from "./InvoiceLineEditor";
import { getEligibleConsumptions } from "../services/billingService";
import { fetchJson } from "../../../api/client";

function buildInitialForm(invoice) {
  if (!invoice) {
    return {
      client: "",
      stay: "",
      reservation: "",
      discount_amount: "0.00",
      tax_amount: "0.00",
      currency: "XOF",
      notes: "",
      source: "manual",
      items: [],
    };
  }
  return {
    client: invoice.client || "",
    stay: invoice.stay || "",
    reservation: invoice.reservation || "",
    discount_amount: invoice.discount_amount || "0.00",
    tax_amount: invoice.tax_amount || "0.00",
    currency: invoice.currency || "XOF",
    notes: invoice.notes || "",
    source: invoice.source || "manual",
    items: (invoice.items || []).map((item) => ({
      label: item.label || "",
      description: item.description || "",
      quantity: item.quantity || "1.00",
      unit_price: item.unit_price || "0.00",
      line_total: item.line_total || "0.00",
      notes: item.notes || "",
      service_date: item.service_date || null,
      consumption: item.consumption || null,
      service_department: item.service_department || null,
      room: item.room || null,
    })),
  };
}

export function InvoiceForm({ invoice, onSave, onCancel, loading = false }) {
  const isEdit = Boolean(invoice);
  const [form, setForm] = useState(() => buildInitialForm(invoice));
  const [errors, setErrors] = useState({});
  const [clients, setClients] = useState([]);
  const [eligibleConsumptions, setEligibleConsumptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    fetchJson("/api/clients/?page_size=100")
      .then((data) => setClients(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.client) return;
    getEligibleConsumptions({ client: form.client, stay: form.stay || "" })
      .then((data) => setEligibleConsumptions(data.results || []))
      .catch(() => setEligibleConsumptions([]));
  }, [form.client, form.stay]);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate() {
    const errs = {};
    if (!form.client) errs.client = "Le client est obligatoire.";
    if (form.items.length === 0) errs.items = "Ajoutez au moins une ligne.";
    form.items.forEach((item, i) => {
      if (!item.label.trim()) errs[`item_${i}_label`] = "Libellé requis.";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setGlobalError("");
    setSubmitting(true);
    try {
      const payload = {
        client: parseInt(form.client, 10),
        stay: form.stay ? parseInt(form.stay, 10) : null,
        reservation: form.reservation ? parseInt(form.reservation, 10) : null,
        discount_amount: form.discount_amount || "0.00",
        tax_amount: form.tax_amount || "0.00",
        currency: form.currency,
        notes: form.notes,
        source: form.source,
        items: form.items.map((item) => ({
          label: item.label,
          description: item.description || "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || "",
          ...(item.service_date ? { service_date: item.service_date } : {}),
          ...(item.consumption ? { consumption: item.consumption } : {}),
          ...(item.service_department ? { service_department: item.service_department } : {}),
          ...(item.room ? { room: item.room } : {}),
        })),
      };
      await onSave(payload, isEdit);
    } catch (err) {
      const payload = err?.payload || {};
      if (typeof payload === "object" && !Array.isArray(payload)) {
        const fieldErrors = {};
        for (const [key, val] of Object.entries(payload)) {
          fieldErrors[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        } else {
          setGlobalError(err?.message || "Erreur lors de l'enregistrement.");
        }
      } else {
        setGlobalError(err?.message || "Erreur lors de l'enregistrement.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function addConsumptionLine(consumption) {
    const already = form.items.some((i) => i.consumption === consumption.id);
    if (already) return;
    const newLine = {
      label: consumption.label,
      description: "",
      quantity: "1.00",
      unit_price: String(parseFloat(consumption.total_amount) || 0),
      line_total: String(parseFloat(consumption.total_amount) || 0),
      notes: "",
      service_date: consumption.consumed_at || null,
      consumption: consumption.id,
      service_department: null,
      room: null,
    };
    setField("items", [...form.items, newLine]);
  }

  return (
    <form className="billing-invoice-form" onSubmit={handleSubmit}>
      <div className="billing-form-section">
        <strong className="billing-form-section-title">Informations générales</strong>
        <div className="billing-form-grid">
          <div className="form-field">
            <label className="form-label">Client *</label>
            <select
              className={`form-input${errors.client ? " form-input--error" : ""}`}
              value={form.client}
              onChange={(e) => setField("client", e.target.value)}
              disabled={isEdit}
            >
              <option value="">Sélectionner un client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
            {errors.client && <span className="form-error">{errors.client}</span>}
          </div>

          <div className="form-field">
            <label className="form-label">Devise</label>
            <select className="form-input" value={form.currency} onChange={(e) => setField("currency", e.target.value)}>
              <option value="XOF">XOF (FCFA)</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Remise globale</label>
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              value={form.discount_amount}
              onChange={(e) => setField("discount_amount", e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Taxes</label>
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              value={form.tax_amount}
              onChange={(e) => setField("tax_amount", e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            rows={2}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Notes internes ou pour le client..."
          />
        </div>
      </div>

      {eligibleConsumptions.length > 0 && (
        <div className="billing-form-section">
          <strong className="billing-form-section-title">
            Consommations disponibles ({eligibleConsumptions.length})
          </strong>
          <div className="billing-consumptions-list">
            {eligibleConsumptions.map((c) => {
              const already = form.items.some((i) => i.consumption === c.id);
              return (
                <div key={c.id} className={`billing-consumption-item${already ? " already-added" : ""}`}>
                  <div>
                    <span className="billing-consumption-label">{c.label}</span>
                    <span className="billing-consumption-service"> · {c.service}</span>
                  </div>
                  <div className="billing-consumption-right">
                    <span className="billing-consumption-amount">
                      {parseFloat(c.total_amount).toLocaleString("fr-FR")} XOF
                    </span>
                    {!already ? (
                      <button
                        type="button"
                        className="secondary-button billing-add-consumption-btn"
                        onClick={() => addConsumptionLine(c)}
                      >
                        Ajouter
                      </button>
                    ) : (
                      <span className="billing-consumption-added">Ajoutée</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="billing-form-section">
        {errors.items && <div className="form-error billing-items-error">{errors.items}</div>}
        <InvoiceLineEditor
          lines={form.items}
          onChange={(lines) => setField("items", lines)}
        />
      </div>

      {globalError && (
        <div className="billing-form-error-box">{globalError}</div>
      )}

      <div className="billing-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="primary-button" disabled={submitting || loading}>
          {submitting ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Créer la facture"}
        </button>
      </div>
    </form>
  );
}
