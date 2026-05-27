import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { isSuperRootUser } from "../../../auth/permissions";
import { superRootAuthApi } from "./superRootAuthApi";
import "./SuperRootLoginPage.css";

const DASHBOARD_PATH = "/super-root/dashboard";
const MFA_PATH = "/super-root/mfa";

function getErrorMessage(error) {
  if (error?.payload?.detail) return error.payload.detail;
  if (error?.status === 403) return "Acces refuse. Ce portail est reserve au Super Root.";
  if (error?.status === 401 || error?.status === 400) return "Identifiant ou mot de passe incorrect.";
  return error?.message || "Connexion Super Root impossible. Reessayez dans un instant.";
}

function validate(form) {
  const errors = {};
  if (!form.username.trim()) errors.username = "Renseignez votre identifiant ou email.";
  if (!form.password) errors.password = "Le mot de passe est obligatoire.";
  return errors;
}

export function SuperRootLoginPage() {
  const { user, isAuthenticated, isLoading, refreshSession } = useAuth();
  const navigate = useNavigate();
  const usernameRef = useRef(null);
  const [form, setForm] = useState({ username: "", password: "", remember_me: true });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validationErrors = useMemo(() => validate(form), [form]);
  const isBusy = isLoading || submitting;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      usernameRef.current?.focus();
    }
  }, [isAuthenticated, isLoading]);

  if (!isLoading && isAuthenticated && isSuperRootUser(user)) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Corrigez les champs requis avant de continuer.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = await superRootAuthApi.login({
        username: form.username.trim(),
        password: form.password,
        remember_me: form.remember_me,
      });

      if (payload?.two_factor_required) {
        navigate(MFA_PATH, { replace: true, state: { challenge: payload } });
        return;
      }

      await refreshSession();
      navigate(DASHBOARD_PATH, { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="srl-page">
      <section className="srl-hero" aria-hidden="true">
        <div className="srl-brand">
          <span className="srl-brand-mark">SR</span>
          <div>
            <strong>AFRIVO</strong>
            <span>Super Root Console</span>
          </div>
        </div>
        <div className="srl-hero-copy">
          <span className="srl-eyebrow">Acces technique reserve</span>
          <h1>Centre de controle global AFRIVO.</h1>
          <p>Supervision systeme, securite, plateformes, licences et maintenance.</p>
        </div>
      </section>

      <section className="srl-panel">
        <form className="srl-card" onSubmit={handleSubmit} noValidate>
          <div className="srl-card-head">
            <span className="srl-status-dot" aria-hidden="true" />
            <div>
              <h2>Connexion Super Root</h2>
              <p>Utilisez uniquement un compte Super Root autorise.</p>
            </div>
          </div>

          {error ? <div className="srl-alert" role="alert">{error}</div> : null}

          <div className="srl-field">
            <label htmlFor="super-root-username">Identifiant ou email</label>
            <div className="srl-input-wrap">
              <i className="ti ti-user" aria-hidden="true" />
              <input
                id="super-root-username"
                ref={usernameRef}
                type="text"
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                autoComplete="username"
                placeholder="super-root@afrivo.com"
                disabled={isBusy}
              />
            </div>
            {fieldErrors.username ? <em>{fieldErrors.username}</em> : null}
          </div>

          <div className="srl-field">
            <label htmlFor="super-root-password">Mot de passe</label>
            <div className="srl-input-wrap">
              <i className="ti ti-lock" aria-hidden="true" />
              <input
                id="super-root-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                autoComplete="current-password"
                placeholder="Mot de passe"
                disabled={isBusy}
              />
              <button
                type="button"
                className="srl-eye"
                onClick={() => setShowPassword((current) => !current)}
                disabled={isBusy}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} aria-hidden="true" />
              </button>
            </div>
            {fieldErrors.password ? <em>{fieldErrors.password}</em> : null}
          </div>

          <label className="srl-check">
            <input
              type="checkbox"
              checked={form.remember_me}
              onChange={(event) => updateField("remember_me", event.target.checked)}
              disabled={isBusy}
            />
            Maintenir la session Super Root ouverte
          </label>

          <button type="submit" className="srl-submit" disabled={isBusy}>
            {isBusy ? "Connexion en cours..." : "Entrer dans Super Root"}
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
