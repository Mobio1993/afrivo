import { useState } from "react";

import { slugify } from "../../../utils/slugify";

const STEPS = ["Identite", "Hotel", "Abonnement"];

const INITIAL = {
  nom: "",
  slug: "",
  statut: "active",
  hotel_nom: "",
  hotel_code: "",
  hotel_ville: "",
  plan: "starter",
};

export default function CsCreateForm({ onCreate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  const set = (key, value) => {
    setForm((current) => {
      if (key === "nom") {
        return { ...current, nom: value, slug: slugify(value) };
      }
      return { ...current, [key]: value };
    });
  };

  const validateStep = () => {
    const nextErrors = {};
    if (step === 0) {
      if (!form.nom.trim()) nextErrors.nom = "Nom obligatoire";
      if (!form.slug.trim()) nextErrors.slug = "Slug obligatoire";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(current + 1, 2));
  };
  const prev = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    const result = await onCreate(form);
    setSaving(false);
    if (result.success) {
      setForm(INITIAL);
      setStep(0);
      setFeedback({ type: "success", msg: "Client cree." });
    } else {
      setFeedback({ type: "error", msg: result.error });
    }
    window.setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="cs-card cs-create-card">
      <div className="cs-card-head">
        <span className="cs-card-title">Nouveau client SaaS</span>
        <span className="cs-pill cs-pill-blue">Etape {step + 1}/{STEPS.length}</span>
      </div>

      <div className="cs-stepper">
        {STEPS.map((label, index) => (
          <div key={label} className={`cs-step ${index < step ? "done" : index === step ? "active" : "pending"}`}>
            <div className="cs-step-dot">
              {index < step ? <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true"></i> : index + 1}
            </div>
            <span className="cs-step-lbl">{label}</span>
          </div>
        ))}
      </div>

      <div className="cs-create-body">
        {feedback ? <div className={`cs-fb cs-fb-${feedback.type}`}>{feedback.msg}</div> : null}

        {step === 0 ? (
          <div className="cs-form-grid">
            <div className="cs-fg cs-fg-full">
              <label className="cs-form-lbl">Nom *</label>
              <input
                className={`cs-form-input ${errors.nom ? "cs-input-err" : ""}`}
                type="text"
                value={form.nom}
                onChange={(e) => set("nom", e.target.value)}
                placeholder="Nom du client SaaS"
              />
              {errors.nom ? <div className="cs-field-err">{errors.nom}</div> : null}
            </div>
            <div className="cs-fg cs-fg-full">
              <label className="cs-form-lbl">Slug *</label>
              <input
                className={`cs-form-input ${errors.slug ? "cs-input-err" : ""}`}
                type="text"
                value={form.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                placeholder="slug-auto-genere"
              />
              {errors.slug ? <div className="cs-field-err">{errors.slug}</div> : null}
            </div>
            <div className="cs-fg cs-fg-full">
              <label className="cs-form-lbl">Etat initial</label>
              <select className="cs-form-input" value={form.statut} onChange={(e) => set("statut", e.target.value)}>
                <option value="active">Active</option>
                <option value="suspended">Suspendue</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="cs-form-grid">
            <div className="cs-fg cs-fg-full">
              <label className="cs-form-lbl">Nom de l'hotel</label>
              <input className="cs-form-input" type="text" value={form.hotel_nom} onChange={(e) => set("hotel_nom", e.target.value)} placeholder="ex. Grand Hotel Abidjan" />
            </div>
            <div className="cs-fg">
              <label className="cs-form-lbl">Code hotel</label>
              <input className="cs-form-input" type="text" value={form.hotel_code} onChange={(e) => set("hotel_code", e.target.value.toUpperCase())} placeholder="ex. GHA" />
            </div>
            <div className="cs-fg">
              <label className="cs-form-lbl">Ville</label>
              <input className="cs-form-input" type="text" value={form.hotel_ville} onChange={(e) => set("hotel_ville", e.target.value)} placeholder="ex. Abidjan" />
            </div>
            <div className="cs-step-note cs-fg-full">
              <i className="ti ti-info-circle" style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true"></i>
              L'hotel peut etre cree plus tard depuis la page Hotels.
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="cs-form-grid">
            <div className="cs-fg cs-fg-full">
              <label className="cs-form-lbl">Plan d'abonnement</label>
              <select className="cs-form-input" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="sans_limite">Sans limite</option>
              </select>
            </div>
            <div className="cs-step-note cs-fg-full">
              <i className="ti ti-info-circle" style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true"></i>
              L'abonnement peut etre configure depuis la page Abonnements.
            </div>
          </div>
        ) : null}
      </div>

      <div className="cs-create-footer">
        {step > 0 ? <button className="cs-btn-outline" onClick={prev}>Precedent</button> : null}
        {step < STEPS.length - 1 ? (
          <button className="cs-btn-primary" onClick={next} style={{ marginLeft: "auto" }}>
            Suivant <i className="ti ti-arrow-right" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
        ) : (
          <button className="cs-btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginLeft: "auto" }}>
            {saving ? "Creation..." : "Creer le client SaaS"}
          </button>
        )}
      </div>
    </div>
  );
}
