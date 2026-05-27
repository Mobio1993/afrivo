import { useState } from "react";

const STEPS = ["Identite", "Tarif & desc."];

const INITIAL = {
  name: "",
  code: "",
  is_active: true,
  monthly_license_price: "0.00",
  description: "",
};

function codeFromName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function MpCreateForm({ onCreate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  const set = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name") next.code = codeFromName(value);
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validateStep = () => {
    const nextErrors = {};
    if (step === 0) {
      if (!form.name.trim()) nextErrors.name = "Nom obligatoire";
      if (!form.code.trim()) nextErrors.code = "Code obligatoire";
    }
    if (step === 1) {
      const price = parseFloat(form.monthly_license_price);
      if (Number.isNaN(price) || price < 0) nextErrors.monthly_license_price = "Prix invalide";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const prev = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toLowerCase(),
      is_active: form.is_active,
      monthly_license_price: parseFloat(form.monthly_license_price) || 0,
      description: form.description.trim(),
    };

    const result = await onCreate(payload);
    setSaving(false);

    if (result.success) {
      setForm(INITIAL);
      setStep(0);
      setFeedback({ type: "success", msg: "Module cree." });
    } else {
      setFeedback({ type: "error", msg: result.error });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="mp-card">
      <div className="mp-card-head">
        <span className="mp-card-title">Nouveau module</span>
        <span className="mp-pill mp-pill-blue">
          Etape {step + 1}/{STEPS.length}
        </span>
      </div>

      <div className="mp-stepper">
        {STEPS.map((item, index) => (
          <div key={item} className={`mp-step ${index < step ? "done" : index === step ? "active" : "pending"}`}>
            <div className="mp-step-dot">
              {index < step ? <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true"></i> : index + 1}
            </div>
            <span className="mp-step-lbl">{item}</span>
          </div>
        ))}
      </div>

      <div className="mp-create-body">
        {feedback && <div className={`mp-fb mp-fb-${feedback.type}`}>{feedback.msg}</div>}

        {step === 0 && (
          <div className="mp-form-grid">
            <div className="mp-fg mp-fg-full">
              <label className="mp-form-lbl">Nom du module *</label>
              <input
                className={`mp-form-input ${errors.name ? "mp-input-err" : ""}`}
                type="text"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="ex. POS Restaurant"
              />
              {errors.name && <div className="mp-field-err">{errors.name}</div>}
            </div>
            <div className="mp-fg mp-fg-full">
              <label className="mp-form-lbl">Code *</label>
              <input
                className={`mp-form-input ${errors.code ? "mp-input-err" : ""}`}
                type="text"
                value={form.code}
                onChange={(event) => set("code", event.target.value)}
                placeholder="ex. pos-restaurant"
              />
              {errors.code && <div className="mp-field-err">{errors.code}</div>}
            </div>
            <div className="mp-fg mp-fg-full">
              <label className="mp-form-lbl">Statut initial</label>
              <label className="mp-toggle-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => set("is_active", event.target.checked)}
                  style={{ width: 14, height: 14, accentColor: "#1D9E75" }}
                />
                <span className="mp-toggle-txt">
                  {form.is_active ? "Module actif - visible dans le catalogue" : "Module inactif"}
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mp-form-grid">
            <div className="mp-fg mp-fg-full">
              <label className="mp-form-lbl">Prix mensuel (XOF)</label>
              <input
                className={`mp-form-input ${errors.monthly_license_price ? "mp-input-err" : ""}`}
                type="number"
                min="0"
                step="100"
                value={form.monthly_license_price}
                onChange={(event) => set("monthly_license_price", event.target.value)}
                placeholder="0.00"
              />
              {errors.monthly_license_price && <div className="mp-field-err">{errors.monthly_license_price}</div>}
            </div>
            <div className="mp-fg mp-fg-full">
              <label className="mp-form-lbl">Description</label>
              <textarea
                className="mp-form-input mp-form-textarea"
                rows={3}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Decrivez les fonctionnalites de ce module..."
              />
            </div>
          </div>
        )}
      </div>

      <div className="mp-create-footer">
        {step > 0 && (
          <button className="mp-btn-outline" onClick={prev} type="button">
            Precedent
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="mp-btn-primary" onClick={next} style={{ marginLeft: "auto" }} type="button">
            Suivant <i className="ti ti-arrow-right" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
        ) : (
          <button className="mp-btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginLeft: "auto" }} type="button">
            {saving ? "Creation..." : "Creer le module"}
          </button>
        )}
      </div>
    </div>
  );
}
