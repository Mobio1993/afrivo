import { useMemo, useState } from "react";

import ModalShell from "./ModalShell";
import { ROLE_OPTIONS, getUserFullName } from "./roleMeta";

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts.at(-1) };
}

function buildInitialForm(user) {
  return {
    fullName: user ? getUserFullName(user) : "",
    username: user?.username || "",
    email: user?.email || "",
    role: user?.role || "reception",
    is_active: user?.is_active ?? true,
    password: "",
    confirmPassword: "",
  };
}

export default function UserForm({ user, mode = "create", saving, apiErrors = {}, onClose, onSubmit }) {
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [errors, setErrors] = useState({});
  const isCreateMode = mode === "create";

  const title = useMemo(() => (
    isCreateMode ? "Nouvel utilisateur" : "Modifier le profil"
  ), [isCreateMode]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Le nom complet est requis.";
    if (!form.username.trim()) nextErrors.username = "Le username est requis.";
    if (/\s/.test(form.username) || form.username !== form.username.toLowerCase()) {
      nextErrors.username = "Le username doit etre en minuscules, sans espaces.";
    }
    if (isCreateMode && form.password.length < 8) {
      nextErrors.password = "Le mot de passe doit contenir au moins 8 caracteres.";
    }
    if (isCreateMode && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Les mots de passe ne correspondent pas.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    const name = splitName(form.fullName);
    await onSubmit({
      username: form.username.trim(),
      first_name: name.first_name,
      last_name: name.last_name,
      email: form.email.trim(),
      role: form.role,
      is_active: form.is_active,
      ...(isCreateMode ? { password: form.password } : {}),
    });
  }

  function renderError(name) {
    const value = errors[name] || apiErrors[name]?.join?.(" ") || apiErrors[name];
    return value ? <small className="um-field-error">{value}</small> : null;
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <form className="um-form" onSubmit={handleSubmit}>
        <header className="um-modal-header">
          <div>
            <strong>{title}</strong>
            <span>{isCreateMode ? "Creation d'un compte hotel." : "Mise a jour des informations utilisateur."}</span>
          </div>
          <button type="button" className="um-icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="um-form-grid">
          <label className="um-field">
            <span>Nom complet</span>
            <input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} />
            {renderError("fullName")}
          </label>

          <label className="um-field">
            <span>Username</span>
            <input
              value={form.username}
              disabled={!isCreateMode}
              onChange={(event) => setField("username", event.target.value.toLowerCase().replace(/\s+/g, ""))}
            />
            {renderError("username")}
          </label>

          <label className="um-field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
            {renderError("email")}
          </label>

          <label className="um-field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => setField("role", event.target.value)}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            {renderError("role")}
          </label>

          <label className="um-switch-field">
            <span>Statut</span>
            <button
              type="button"
              className={`um-switch${form.is_active ? " is-on" : ""}`}
              onClick={() => setField("is_active", !form.is_active)}
              aria-pressed={form.is_active}
            >
              <i />
              {form.is_active ? "Actif" : "Inactif"}
            </button>
          </label>

          {isCreateMode ? (
            <>
              <label className="um-field">
                <span>Mot de passe</span>
                <input type="password" value={form.password} onChange={(event) => setField("password", event.target.value)} />
                {renderError("password")}
              </label>
              <label className="um-field">
                <span>Confirmer mot de passe</span>
                <input type="password" value={form.confirmPassword} onChange={(event) => setField("confirmPassword", event.target.value)} />
                {renderError("confirmPassword")}
              </label>
            </>
          ) : null}
        </div>

        {apiErrors.detail ? <div className="um-inline-error">{apiErrors.detail}</div> : null}

        <footer className="um-modal-footer">
          <button type="button" className="um-outline-btn" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="submit" className="um-primary-btn" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
