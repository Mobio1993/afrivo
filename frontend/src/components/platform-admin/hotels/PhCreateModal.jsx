import { useEffect, useState } from "react";

import { slugify } from "../../../utils/slugify";

const STEPS = ["Organisation", "Identite", "Admin & acces"];

const INITIAL_FORM = {
  organization_id: "",
  name: "",
  code: "",
  slug: "",
  is_active: true,
  country: "Cote d'Ivoire",
  city: "",
  timezone: "Africa/Abidjan",
  currency: "XOF",
  admin_username: "",
  admin_password: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone: "",
};

export default function PhCreateModal({ organizations = [], onClose, onCreate, onSuccess }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [slugEdited, setSlugEdited] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (slugEdited) return;
    setForm((current) => ({ ...current, slug: slugify(current.name) }));
  }, [form.name, slugEdited]);

  const validateStep = () => {
    const nextErrors = {};
    if (step === 0 && !form.organization_id) nextErrors.organization_id = "Organisation requise";
    if (step === 1) {
      if (!form.name.trim()) nextErrors.name = "Nom de l'hotel requis";
      if (!form.code.trim()) nextErrors.code = "Code hotel requis";
      if (!form.slug.trim()) nextErrors.slug = "Slug requis";
    }
    if (step === 2 && (form.admin_username.trim() || form.admin_password) && (!form.admin_username.trim() || !form.admin_password)) {
      nextErrors.admin = "Username et mot de passe sont requis pour creer l'admin.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    const result = await onCreate(form);
    setSaving(false);
    if (result.success) {
      onSuccess();
    } else {
      setFeedback({ type: "error", msg: result.error || "Erreur lors de la creation." });
    }
  };

  return (
    <div className="ph-modal-overlay">
      <div className="ph-modal">
        <div className="ph-modal-head">
          <span className="ph-modal-title">Creer un hotel</span>
          <button className="ph-modal-close" onClick={onClose} aria-label="Fermer">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="ph-stepper">
          {STEPS.map((label, index) => (
            <div key={label} className={`ph-step ${index < step ? "done" : index === step ? "active" : "pending"}`}>
              <div className="ph-step-dot">{index < step ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</div>
              <span className="ph-step-lbl">{label}</span>
            </div>
          ))}
        </div>

        <div className="ph-modal-body">
          {feedback && <div className={`ph-detail-feedback ph-feedback-${feedback.type}`}>{feedback.msg}</div>}

          {step === 0 && (
            <div className="ph-form-grid">
              <div className="ph-fg ph-fg-full">
                <label className="ph-form-lbl">Organisation parente *</label>
                <select
                  className={`ph-form-input ${errors.organization_id ? "ph-input-err" : ""}`}
                  value={form.organization_id}
                  onChange={(event) => set("organization_id", event.target.value)}
                >
                  <option value="">Choisir une organisation...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                {errors.organization_id && <div className="ph-field-err">{errors.organization_id}</div>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="ph-form-grid">
              <div className="ph-fg">
                <label className="ph-form-lbl">Nom de l'hotel *</label>
                <input className={`ph-form-input ${errors.name ? "ph-input-err" : ""}`} value={form.name} onChange={(event) => set("name", event.target.value)} />
                {errors.name && <div className="ph-field-err">{errors.name}</div>}
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Code hotel *</label>
                <input className={`ph-form-input ${errors.code ? "ph-input-err" : ""}`} value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} />
                {errors.code && <div className="ph-field-err">{errors.code}</div>}
              </div>
              <div className="ph-fg ph-fg-full">
                <label className="ph-form-lbl">Slug *</label>
                <input
                  className={`ph-form-input ${errors.slug ? "ph-input-err" : ""}`}
                  value={form.slug}
                  onChange={(event) => { setSlugEdited(true); set("slug", event.target.value); }}
                />
                {errors.slug && <div className="ph-field-err">{errors.slug}</div>}
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Pays</label>
                <input className="ph-form-input" value={form.country} onChange={(event) => set("country", event.target.value)} />
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Ville</label>
                <input className="ph-form-input" value={form.city} onChange={(event) => set("city", event.target.value)} />
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Fuseau horaire</label>
                <select className="ph-form-input" value={form.timezone} onChange={(event) => set("timezone", event.target.value)}>
                  <option value="Africa/Abidjan">Africa/Abidjan</option>
                  <option value="Africa/Lagos">Africa/Lagos</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Atlantic/Reykjavik">Atlantic/Reykjavik</option>
                </select>
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Devise</label>
                <select className="ph-form-input" value={form.currency} onChange={(event) => set("currency", event.target.value)}>
                  <option value="XOF">XOF</option>
                  <option value="XAF">XAF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ph-form-grid">
              {errors.admin && <div className="ph-field-err ph-fg-full">{errors.admin}</div>}
              <div className="ph-fg">
                <label className="ph-form-lbl">Username admin</label>
                <input className="ph-form-input" value={form.admin_username} onChange={(event) => set("admin_username", event.target.value)} />
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Mot de passe</label>
                <input className="ph-form-input" type="password" value={form.admin_password} onChange={(event) => set("admin_password", event.target.value)} />
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Prenom</label>
                <input className="ph-form-input" value={form.admin_first_name} onChange={(event) => set("admin_first_name", event.target.value)} />
              </div>
              <div className="ph-fg">
                <label className="ph-form-lbl">Nom</label>
                <input className="ph-form-input" value={form.admin_last_name} onChange={(event) => set("admin_last_name", event.target.value)} />
              </div>
              <div className="ph-fg ph-fg-full">
                <label className="ph-form-lbl">Email</label>
                <input className="ph-form-input" type="email" value={form.admin_email} onChange={(event) => set("admin_email", event.target.value)} />
              </div>
              <div className="ph-step-note ph-fg-full">
                <i className="ti ti-info-circle" aria-hidden="true" />
                L'admin hotel est optionnel. Laissez ces champs vides pour le creer plus tard depuis la fiche hotel.
              </div>
            </div>
          )}
        </div>

        <div className="ph-modal-footer">
          {step > 0 && <button className="ph-btn-outline" onClick={() => setStep((current) => current - 1)}>Precedent</button>}
          <button className="ph-btn-outline" onClick={onClose} style={{ marginLeft: "auto" }}>Annuler</button>
          {step < STEPS.length - 1 ? (
            <button className="ph-btn-primary" onClick={() => { if (validateStep()) setStep((current) => current + 1); }}>Suivant</button>
          ) : (
            <button className="ph-btn-primary" onClick={submit} disabled={saving}>{saving ? "Creation..." : "Creer l'hotel"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
