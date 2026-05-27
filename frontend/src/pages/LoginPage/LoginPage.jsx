import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import NetworkAnimation from "./NetworkAnimation";
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

  if (requestError?.status === 429) {
    return "Trop de tentatives de connexion. Reessayez dans quelques minutes.";
  }

  if (requestError?.status >= 500) {
    return "Le serveur AFRIVO ne repond pas correctement. Reessayez dans un instant.";
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

  return requestError?.message || "Connexion impossible. Verifiez vos identifiants puis reessayez.";
}

export function LoginPage() {
  const { login, completeTwoFactorLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState({
    username: "",
    password: "",
    remember_me: false,
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

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

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

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
      if (validationErrors.username) {
        usernameInputRef.current?.focus();
      } else if (validationErrors.password) {
        passwordInputRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
    setError("");
    setSubmitting(true);

    try {
      const payload = await login({
        username: form.username.trim(),
        password: form.password,
        remember_me: form.remember_me,
      });

      if (!mountedRef.current) return;
      if (payload?.two_factor_required) {
        setTwoFactorChallenge(payload);
        setTwoFactorCode(payload.otp || "");
        setError("Verification 2FA requise. Saisissez le code envoye par email.");
        return;
      }
      navigate(targetPath, { replace: true });
    } catch (requestError) {
      if (mountedRef.current) {
        setError(extractBackendError(requestError));
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  async function handleTwoFactorSubmit(event) {
    event.preventDefault();
    if (!twoFactorChallenge?.challenge_id || twoFactorCode.trim().length !== 6) {
      setError("Saisissez le code 2FA a 6 chiffres pour continuer.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await completeTwoFactorLogin({
        challengeId: twoFactorChallenge.challenge_id,
        code: twoFactorCode.trim(),
      });
      if (!mountedRef.current) return;
      navigate(targetPath, { replace: true });
    } catch (requestError) {
      if (mountedRef.current) {
        setError(extractBackendError(requestError));
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  const mergedUsernameError = fieldErrors.username || validationErrors.username;
  const mergedPasswordError = fieldErrors.password || validationErrors.password;

  return (
    <div className="login-page login-shell login-shell-luxury">
      <div className="login-luxury-layout">

        {/* ─── Colonne gauche : hero visuel ──────────────────────────────────── */}
        <section className="login-visual-panel" aria-hidden="true">
          <div className="login-visual-pattern" />
          <NetworkAnimation />

          <div className="login-visual-topbar">
            <div className="login-visual-topbar-brand">
              <div className="login-visual-brand-mark">AF</div>
              <span className="login-visual-brand-name">AFRIVO</span>
            </div>
            <span className="login-visual-brand-badge">AFRIVO Hospitality Suite</span>
          </div>

          <div className="login-gradient" aria-hidden="true" />

          <div className="login-visual-content">
            <div className="login-tag">
              <i className="ti ti-hotel" aria-hidden="true" />
              Hotel Management
            </div>
            <h2 className="login-title">
              Gérez votre hôtel<br />
              avec une{" "}
              <span className="login-title-accent">
                longueur<br />d'avance.
              </span>
            </h2>
            <p className="login-desc">
              La plateforme pensée pour les hôteliers africains modernes.
            </p>
            <div className="login-stats">
              <div className="login-stat">
                <div className="login-stat-value">24/7</div>
                <div className="login-stat-label">Disponible</div>
              </div>
              <div className="login-stat-divider" />
              <div className="login-stat">
                <div className="login-stat-value">100%</div>
                <div className="login-stat-label">Sécurisé</div>
              </div>
              <div className="login-stat-divider" />
              <div className="login-stat">
                <div className="login-stat-value">Multi</div>
                <div className="login-stat-label">Établissements</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Colonne droite : formulaire ───────────────────────────────────── */}
        <section className="login-form-panel">

          {/* Mobile brand — masqué sur desktop, visible sur ≤ 1024px */}
          <div className="login-mobile-brand" aria-hidden="false">
            <div className="login-visual-brand-mark">A</div>
            <div>
              <div className="login-mobile-brand-name">AFRIVO</div>
              <div className="login-mobile-brand-sub">Gestion hôtelière moderne</div>
            </div>
          </div>

          {/* En-tête formulaire */}
          <div className="login-form-header login-reveal login-reveal-1">
            <div className="login-time-greeting">
              <span className="login-time-dot" aria-hidden="true" />
              <span>{welcome.title}</span>
            </div>
            <h2>Accédez à votre espace</h2>
            <p>Identifiez-vous pour reprendre votre activité.</p>
          </div>

          {/* Status boxes */}
          {isLoading ? (
            <div className="status-box login-reveal login-reveal-2" aria-live="polite">
              Vérification de la session en cours...
            </div>
          ) : null}

          {error ? (
            <div className="alert-box login-reveal login-reveal-2" role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}

          {/* Formulaire */}
          <form className="login-form" onSubmit={twoFactorChallenge ? handleTwoFactorSubmit : handleSubmit} noValidate>

            {/* Champ identifiant */}
            <div className="login-input-field login-reveal login-reveal-3">
              <label htmlFor="login-username">Identifiant ou email</label>
              <div
                className="login-input-box"
                aria-invalid={Boolean(mergedUsernameError) || undefined}
              >
                <span className="login-input-prefix">
                  <i className="ti ti-user" aria-hidden="true"></i>
                </span>
                <input
                  id="login-username"
                  className="login-input-native"
                  ref={usernameInputRef}
                  type="text"
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  autoComplete="username"
                  placeholder="admin ou nom@afrivo.com"
                  disabled={isBusy}
                  aria-invalid={Boolean(mergedUsernameError)}
                  required
                />
              </div>
              <small>Utilisez vos accès professionnels pour ouvrir votre session.</small>
              {mergedUsernameError ? (
                <em className="field-error">{mergedUsernameError}</em>
              ) : null}
            </div>

            {/* Champ mot de passe */}
            <div className="login-input-field login-reveal login-reveal-4">
              <label htmlFor="login-password">Mot de passe</label>
              <div
                className="login-input-box"
                aria-invalid={Boolean(mergedPasswordError) || undefined}
              >
                <span className="login-input-prefix">
                  <i className="ti ti-lock" aria-hidden="true"></i>
                </span>
                <input
                  id="login-password"
                  className="login-input-native"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
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
            </div>

            {/* Remember me */}
            <div className="login-row login-reveal login-reveal-5">
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

            {twoFactorChallenge ? (
              <div className="login-input-field login-reveal login-reveal-5">
                <label htmlFor="login-2fa-code">Code de verification 2FA</label>
                <div className="login-input-box">
                  <span className="login-input-prefix">
                    <i className="ti ti-shield-lock" aria-hidden="true"></i>
                  </span>
                  <input
                    id="login-2fa-code"
                    className="login-input-native"
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    disabled={isBusy}
                    required
                  />
                </div>
                <small>Ce compte est sensible. Une verification supplementaire est obligatoire.</small>
              </div>
            ) : null}

            {/* Bouton submit */}
            <button
              type="submit"
              className="primary-button login-submit-button login-reveal login-reveal-6"
              disabled={twoFactorChallenge ? isBusy || twoFactorCode.trim().length !== 6 : !canSubmit}
            >
              {isBusy ? (
                <>
                  <Spinner />
                  <span>{twoFactorChallenge ? "Verification..." : "Connexion en cours..."}</span>
                </>
              ) : (
                <span>{twoFactorChallenge ? "Valider le code" : "Se connecter"}</span>
              )}
            </button>
            {twoFactorChallenge ? (
              <button
                type="button"
                className="secondary-button login-submit-button"
                disabled={isBusy}
                onClick={() => {
                  setTwoFactorChallenge(null);
                  setTwoFactorCode("");
                  setError("");
                }}
              >
                Revenir a la connexion
              </button>
            ) : null}
          </form>

          <div className="login-form-divider" />

          {/* Trust footer */}
          <div className="login-footer-trust">
            {[
              { icon: "ti-shield-check", label: "Connexion sécurisée" },
              { icon: "ti-building-community", label: "Multi-établissements" },
              { icon: "ti-clock", label: "Disponible 24/7" },
            ].map((item, i) => (
              <div
                key={item.label}
                className="login-footer-trust-item login-trust-stagger"
                style={{ animationDelay: `${0.34 + i * 0.12}s` }}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
