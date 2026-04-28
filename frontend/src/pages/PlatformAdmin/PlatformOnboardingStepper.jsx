import { useState } from "react";

import { AppSelect } from "../../components/AppSelect";
import { DateTimePicker } from "../../components/DateTimePicker";
import { slugify } from "../../utils/slugify";

const STEPS = [
  { id: 1, label: "Organisation" },
  { id: 2, label: "Hotel" },
  { id: 3, label: "Admin" },
  { id: 4, label: "Abonnement" },
];

const SUBSCRIPTION_STATUSES = [
  { value: "trial",     label: "Essai" },
  { value: "active",    label: "Actif" },
  { value: "draft",     label: "Brouillon" },
  { value: "suspended", label: "Suspendu" },
];

const BILLING_CYCLES = [
  { value: "monthly", label: "Mensuel" },
  { value: "yearly",  label: "Annuel" },
  { value: "custom",  label: "Personnalise" },
];

const INITIAL_FORM = {
  organization_id:    "",
  organization_name:  "",
  organization_slug:  "",
  hotel_name:         "",
  hotel_code:         "",
  hotel_slug:         "",
  country:            "",
  city:               "",
  timezone_name:      "Atlantic/Reykjavik",
  currency:           "XOF",
  admin_username:     "",
  admin_password:     "",
  admin_first_name:   "",
  admin_last_name:    "",
  admin_email:        "",
  admin_phone:        "",
  plan_id:            "",
  subscription_status:"trial",
  starts_at:          "",
  ends_at:            "",
  trial_ends_at:      "",
  billing_cycle:      "monthly",
  subscription_notes: "",
};

function StepHeader({ currentStep }) {
  return (
    <div className="pa-stepper-header">
      {STEPS.map((step, idx) => {
        const isDone   = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="pa-stepper-step">
            <div
              className={[
                "pa-stepper-bubble",
                isActive ? "pa-stepper-bubble--active" : "",
                isDone   ? "pa-stepper-bubble--done"   : "",
              ].filter(Boolean).join(" ")}
            >
              {isDone ? (
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="2 7 5.5 10.5 12 3" />
                </svg>
              ) : step.id}
            </div>
            <span className={`pa-stepper-label${isActive ? " pa-stepper-label--active" : ""}${isDone ? " pa-stepper-label--done" : ""}`}>
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`pa-stepper-connector${isDone ? " pa-stepper-connector--done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepTitle({ title, subtitle }) {
  return (
    <div className="pa-stepper-step-title">
      <h4>{title}</h4>
      <p>{subtitle}</p>
    </div>
  );
}

export function PlatformOnboardingStepper({ organizations, plans, onSubmit, submitting }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(() => ({
    ...INITIAL_FORM,
    plan_id: String(plans[0]?.id || ""),
  }));
  const [showPass, setShowPass] = useState(false);

  const isExistingOrg = Boolean(form.organization_id);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((cur) => {
      const next = { ...cur, [name]: value };
      if (name === "organization_id" && value) {
        next.organization_name = "";
        next.organization_slug = "";
      }
      if (name === "organization_name" && !isExistingOrg) {
        next.organization_slug = slugify(value);
      }
      if (name === "subscription_status" && value !== "trial") {
        next.trial_ends_at = "";
      }
      return next;
    });
  }

  function canAdvance() {
    if (step === 1) {
      return isExistingOrg || (form.organization_name.trim() && form.organization_slug.trim());
    }
    if (step === 2) {
      return form.hotel_name.trim() && form.hotel_code.trim() && form.hotel_slug.trim();
    }
    if (step === 3) {
      return form.admin_username.trim() && form.admin_password.trim();
    }
    return true;
  }

  function goBack()  { if (step > 1) setStep((s) => s - 1); }
  function goNext()  { if (canAdvance() && step < 4) setStep((s) => s + 1); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!submitting) onSubmit(form);
  }

  const selectedOrg = organizations.find((o) => String(o.id) === form.organization_id);

  return (
    <form className="pa-stepper" onSubmit={handleSubmit}>
      <StepHeader currentStep={step} />

      <div className="pa-stepper-body">

        {/* ── Étape 1 : Organisation ─────────────────── */}
        {step === 1 && (
          <div className="pa-stepper-fields">
            <StepTitle
              title="Organisation"
              subtitle="Rattachez cet hotel a une organisation existante ou creez-en une nouvelle."
            />
            <AppSelect name="organization_id" value={form.organization_id} onChange={handleChange} disabled={submitting}>
              <option value="">Nouvelle organisation</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </AppSelect>

            {isExistingOrg ? (
              <div className="pa-stepper-info-pill">
                Organisation selectionnee&nbsp;: <strong>{selectedOrg?.name}</strong>
              </div>
            ) : (
              <>
                <input
                  className="filter-input"
                  name="organization_name"
                  placeholder="Nom de l'organisation *"
                  value={form.organization_name}
                  onChange={handleChange}
                  disabled={submitting}
                  required
                />
                <div className="pa-stepper-field-group">
                  <input
                    className="filter-input"
                    name="organization_slug"
                    placeholder="Slug organisation *"
                    value={form.organization_slug}
                    onChange={handleChange}
                    disabled={submitting}
                    required
                  />
                  <span className="pa-stepper-hint">
                    Utilise dans l'URL (ex : afrivo.com/hotel-emmanuella)
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Étape 2 : Hôtel ───────────────────────── */}
        {step === 2 && (
          <div className="pa-stepper-fields">
            <StepTitle
              title="Hotel"
              subtitle="Informations de l'etablissement a creer sur la plateforme."
            />
            <div className="pa-stepper-row">
              <input className="filter-input" name="hotel_name" placeholder="Nom de l'hotel *" value={form.hotel_name} onChange={handleChange} disabled={submitting} required />
              <input className="filter-input" name="hotel_code" placeholder="Code hotel *"      value={form.hotel_code} onChange={handleChange} disabled={submitting} required />
            </div>
            <input className="filter-input" name="hotel_slug" placeholder="Slug hotel *" value={form.hotel_slug} onChange={handleChange} disabled={submitting} required />
            <div className="pa-stepper-row">
              <input className="filter-input" name="country"  placeholder="Pays"   value={form.country}  onChange={handleChange} disabled={submitting} />
              <input className="filter-input" name="city"     placeholder="Ville"  value={form.city}     onChange={handleChange} disabled={submitting} />
            </div>
            <div className="pa-stepper-row">
              <input className="filter-input" name="timezone_name" placeholder="Fuseau horaire" value={form.timezone_name} onChange={handleChange} disabled={submitting} />
              <input className="filter-input" name="currency"      placeholder="Devise"         value={form.currency}      onChange={handleChange} disabled={submitting} />
            </div>
          </div>
        )}

        {/* ── Étape 3 : Administrateur ──────────────── */}
        {step === 3 && (
          <div className="pa-stepper-fields">
            <StepTitle
              title="Administrateur"
              subtitle="Compte admin hotel qui sera cree et rattache a l'etablissement."
            />
            <div className="pa-stepper-row">
              <input className="filter-input" name="admin_first_name" placeholder="Prenom"        value={form.admin_first_name} onChange={handleChange} disabled={submitting} />
              <input className="filter-input" name="admin_last_name"  placeholder="Nom de famille" value={form.admin_last_name}  onChange={handleChange} disabled={submitting} />
            </div>
            <input className="filter-input" name="admin_username" placeholder="Username *" value={form.admin_username} onChange={handleChange} disabled={submitting} required />
            <div className="pa-stepper-field-group">
              <div className="pa-stepper-password-wrap">
                <input
                  type={showPass ? "text" : "password"}
                  className="filter-input"
                  name="admin_password"
                  placeholder="Mot de passe *"
                  value={form.admin_password}
                  onChange={handleChange}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="pa-stepper-eye"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? "Masquer" : "Afficher"}
                >
                  {showPass ? (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"/><circle cx="10" cy="10" r="2.5"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"/><circle cx="10" cy="10" r="2.5"/></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="pa-stepper-row">
              <input type="email" className="filter-input" name="admin_email" placeholder="Email" value={form.admin_email} onChange={handleChange} disabled={submitting} />
              <input className="filter-input" name="admin_phone" placeholder="Telephone" value={form.admin_phone} onChange={handleChange} disabled={submitting} />
            </div>
          </div>
        )}

        {/* ── Étape 4 : Abonnement ──────────────────── */}
        {step === 4 && (
          <div className="pa-stepper-fields">
            <StepTitle
              title="Abonnement"
              subtitle="Plan tarifaire et parametres contractuels de l'hotel."
            />
            <div className="pa-stepper-row">
              <AppSelect name="plan_id" value={form.plan_id} onChange={handleChange} disabled={submitting}>
                <option value="">Choisir un plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </AppSelect>
              <AppSelect name="subscription_status" value={form.subscription_status} onChange={handleChange} disabled={submitting}>
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </AppSelect>
              <AppSelect name="billing_cycle" value={form.billing_cycle} onChange={handleChange} disabled={submitting}>
                {BILLING_CYCLES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </AppSelect>
            </div>
            <div className="pa-stepper-row">
              <div className="pa-stepper-field-group">
                <label className="pa-stepper-date-label">Date de debut</label>
                <DateTimePicker name="starts_at" value={form.starts_at} onChange={handleChange} />
              </div>
              {form.subscription_status === "trial" && (
                <div className="pa-stepper-field-group">
                  <label className="pa-stepper-date-label">Fin d'essai</label>
                  <DateTimePicker name="trial_ends_at" value={form.trial_ends_at} onChange={handleChange} />
                </div>
              )}
              <div className="pa-stepper-field-group">
                <label className="pa-stepper-date-label">Date de fin</label>
                <DateTimePicker name="ends_at" value={form.ends_at} onChange={handleChange} />
              </div>
            </div>
            <textarea
              className="filter-input platform-admin-textarea"
              name="subscription_notes"
              placeholder="Notes commerciales"
              value={form.subscription_notes}
              onChange={handleChange}
              disabled={submitting}
            />

            {/* Récapitulatif compact */}
            <div className="pa-stepper-recap">
              <span className="pa-stepper-recap-item"><strong>Org</strong>{selectedOrg?.name || form.organization_name || "—"}</span>
              <span className="pa-stepper-recap-item"><strong>Hotel</strong>{form.hotel_name || "—"}</span>
              <span className="pa-stepper-recap-item"><strong>Admin</strong>{form.admin_username || "—"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="pa-stepper-nav">
        <div className="pa-stepper-nav-left">
          {step > 1 && (
            <button type="button" className="secondary-button" onClick={goBack} disabled={submitting}>
              ← Precedent
            </button>
          )}
        </div>
        <span className="pa-stepper-progress">Etape {step} sur {STEPS.length}</span>
        <div className="pa-stepper-nav-right">
          {step < STEPS.length ? (
            <button
              type="button"
              className="primary-button"
              onClick={goNext}
              disabled={!canAdvance() || submitting}
            >
              Suivant →
            </button>
          ) : (
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "Onboarding en cours..." : "Lancer l'onboarding"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
