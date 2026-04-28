import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import "./LoginPage.css";

function resolveTargetPath(locationState) {
  if (!locationState?.from) {
    return "/dashboard";
  }

  if (typeof locationState.from === "string") {
    if (locationState.from === "/login") {
      return "/dashboard";
    }
    return locationState.from;
  }

  if (typeof locationState.from === "object" && locationState.from.pathname) {
    if (locationState.from.pathname === "/login") {
      return "/dashboard";
    }
    return `${locationState.from.pathname}${locationState.from.search || ""}${locationState.from.hash || ""}`;
  }

  return "/dashboard";
}

function getWelcomeMessage() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return {
      title: "Bonjour",
      subtitle: "Ouvrez votre session et retrouvez un pilotage clair de la réception.",
    };
  }

  if (hour < 18) {
    return {
      title: "Bon après-midi",
      subtitle: "Reconnectez-vous pour suivre l'activité, les clients et les opérations.",
    };
  }

  return {
    title: "Bonsoir",
    subtitle: "Accédez à AFRIVO et terminez la journée avec une vision nette de l'hôtel.",
  };
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {open ? (
        <>
          <path
            d="M2 12C4.6 7.9 8 5.8 12 5.8S19.4 7.9 22 12c-2.6 4.1-6 6.2-10 6.2S4.6 16.1 2 12Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : (
        <>
          <path
            d="M3 3l18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M10.5 6.1c.5-.1 1-.2 1.5-.2 4 0 7.4 2.1 10 6.2-.9 1.4-1.9 2.6-3 3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.7 7.5C5 8.6 3.5 10.1 2 12c2.6 4.1 6 6.2 10 6.2 1.8 0 3.5-.4 5-1.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

function Spinner() {
  return <span className="login-spinner" aria-hidden="true" />;
}

function validateForm(username, password) {
  const errors = {};
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername) {
    errors.username = "Renseignez votre identifiant ou votre email.";
  } else if (trimmedUsername.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUsername)) {
    errors.username = "L'adresse email saisie est invalide.";
  }

  if (!trimmedPassword) {
    errors.password = "Le mot de passe est obligatoire.";
  }

  return errors;
}

function extractBackendError(requestError) {
  const payload = requestError?.payload;

  if (payload?.detail) {
    return payload.detail;
  }

  if (payload?.errors?.non_field_errors?.length) {
    return payload.errors.non_field_errors.join(" ");
  }

  if (payload?.errors && typeof payload.errors === "object") {
    const firstEntry = Object.values(payload.errors).find(Boolean);

    if (Array.isArray(firstEntry)) {
      return firstEntry.join(" ");
    }

    if (typeof firstEntry === "string") {
      return firstEntry;
    }
  }

  return requestError?.message || "Connexion impossible. Vérifiez vos identifiants puis réessayez.";
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameInputRef = useRef(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    remember_me: false,
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const welcome = useMemo(() => getWelcomeMessage(), []);
  const targetPath = useMemo(() => resolveTargetPath(location.state), [location.state]);

  const validationErrors = useMemo(
    () => validateForm(form.username, form.password),
    [form.username, form.password],
  );

  const isBusy = submitting || isLoading;
  const canSubmit = Object.keys(validationErrors).length === 0 && !isBusy;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      usernameInputRef.current?.focus();
    }
  }, [isLoading, isAuthenticated]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={targetPath} replace />;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");

    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Corrigez les informations manquantes avant de continuer.");
      return;
    }

    setFieldErrors({});
    setError("");
    setSubmitting(true);

    try {
      await login({
        username: form.username.trim(),
        password: form.password,
        remember_me: form.remember_me,
      });

      navigate(targetPath, { replace: true });
    } catch (requestError) {
      setError(extractBackendError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const mergedUsernameError = fieldErrors.username || validationErrors.username;
  const mergedPasswordError = fieldErrors.password || validationErrors.password;

  return (
    <div className="login-page login-shell login-shell-luxury">
      <div className="login-background-orb login-background-orb-a" aria-hidden="true" />
      <div className="login-background-orb login-background-orb-b" aria-hidden="true" />
      <div className="login-background-orb login-background-orb-c" aria-hidden="true" />
      <div className="login-luxury-grid-lines" aria-hidden="true" />
      <div className="login-noise-layer" aria-hidden="true" />

      <div className="login-luxury-layout">
        <section className="login-luxury-hero">
          <span className="eyebrow dark login-reveal login-reveal-1">
            AFRIVO Hospitality Suite
          </span>

          <div className="login-brand-row login-luxury-brand-row login-reveal login-reveal-2">
            <div className="login-brand-mark" aria-hidden="true">
              <span>A</span>
            </div>

            <div className="login-brand-copy">
              <strong>AFRIVO</strong>
              <span>Gestion hôtelière moderne</span>
            </div>
          </div>

          <div className="login-luxury-copy">
            <div className="login-copy-badge login-reveal login-reveal-3">
              <strong>{welcome.title}</strong>
              <span>{welcome.subtitle}</span>
            </div>

            <h1 className="login-reveal login-reveal-4">
              La plateforme qui donne à votre hôtel une longueur d'avance.
            </h1>

            <p className="login-reveal login-reveal-5">
              Gérez la réception, les clients, les opérations et le pilotage
              quotidien depuis un seul espace clair, rapide et professionnel.
            </p>
          </div>

          <div className="login-luxury-metrics">
            <article className="login-luxury-metric-card login-reveal login-reveal-6">
              <strong>Réception</strong>
              <span>Réservations, check-in et check-out centralisés en temps réel</span>
            </article>

            <article className="login-luxury-metric-card login-reveal login-reveal-7">
              <strong>Clients</strong>
              <span>Fiches complètes, historiques de séjours et préférences enregistrées</span>
            </article>

            <article className="login-luxury-metric-card login-reveal login-reveal-8">
              <strong>Pilotage</strong>
              <span>KPIs, alertes et rapports d'activité accessibles en un coup d'œil</span>
            </article>
          </div>

          <div className="login-luxury-footer-note login-reveal login-reveal-9">
            <strong>Conçu pour les hôteliers africains</strong>
            <p>
              Une solution SaaS multi-établissements pensée pour les réalités
              terrain, avec un niveau de finition digne des meilleures adresses.
            </p>
          </div>
        </section>

        <section className="login-panel login-panel-luxury login-reveal login-reveal-4">
          <div className="login-panel-luxury-glow" aria-hidden="true" />
          <div className="login-panel-shine" aria-hidden="true" />

          <div className="login-panel-luxury-inner">
            <div className="login-panel-head login-panel-luxury-head login-reveal login-reveal-5">
              <span className="eyebrow login-panel-badge">Connexion sécurisée</span>
              <h2>Accédez à votre espace</h2>
              <p>
                Identifiez-vous pour reprendre votre activité là où vous l'avez laissée.
              </p>
            </div>

            {isLoading ? (
              <div className="status-box login-reveal login-reveal-6" aria-live="polite">
                Vérification de la session en cours...
              </div>
            ) : null}

            {error ? (
              <div className="alert-box login-reveal login-reveal-6" role="alert" aria-live="polite">
                {error}
              </div>
            ) : null}

            <form className="login-form login-form-luxury" onSubmit={handleSubmit} noValidate>
              <label className="login-field login-reveal login-reveal-6">
                <span>Identifiant ou email</span>
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  autoComplete="username"
                  placeholder="Exemple : admin ou nom@afrivo.com"
                  disabled={isBusy}
                  aria-invalid={Boolean(mergedUsernameError)}
                  required
                />
                <small>Utilisez vos accès professionnels pour ouvrir votre session.</small>
                {mergedUsernameError ? (
                  <em className="field-error">{mergedUsernameError}</em>
                ) : null}
              </label>

              <label className="login-field login-reveal login-reveal-7">
                <span>Mot de passe</span>

                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    autoComplete="current-password"
                    placeholder="Saisis ton mot de passe"
                    disabled={isBusy}
                    aria-invalid={Boolean(mergedPasswordError)}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isBusy}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={showPassword}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                <small>Votre mot de passe reste protégé pendant toute la session.</small>
                {mergedPasswordError ? (
                  <em className="field-error">{mergedPasswordError}</em>
                ) : null}
              </label>

              <div className="login-row login-reveal login-reveal-8">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.remember_me}
                    onChange={(event) => updateField("remember_me", event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Se souvenir de moi</span>
                </label>

                <span className="login-helper-text">Session sécurisée · AFRIVO</span>
              </div>

              <button
                type="submit"
                className="primary-button login-submit-button login-reveal login-reveal-9"
                disabled={!canSubmit}
              >
                {isBusy ? (
                  <>
                    <Spinner />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <span>Se connecter</span>
                )}
              </button>
            </form>

            <div className="login-luxury-trust login-reveal login-reveal-10">
              <div className="login-luxury-trust-item">
                <strong>Accès multi-établissements</strong>
                <span>Un seul compte pour gérer plusieurs hôtels depuis n'importe quel poste</span>
              </div>

              <div className="login-luxury-trust-item">
                <strong>Données protégées</strong>
                <span>Authentification sécurisée — vos informations restent strictement privées</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}