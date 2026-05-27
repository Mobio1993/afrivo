import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { hasPosAccess } from "../../components/pos-restaurant/RequirePosAccess";
import "../../styles/pos-restaurant.css";

function resolveTarget(location) {
  const candidate = location.state?.from?.pathname || "/pos-restaurant/dashboard";
  if (!candidate.startsWith("/pos-restaurant") || candidate === "/pos-restaurant/login") {
    return "/pos-restaurant/dashboard";
  }
  return candidate;
}

function getErrorMessage(error) {
  if (error?.payload?.detail) return error.payload.detail;
  if (error?.payload?.error) return error.payload.error;
  if (error?.message) return error.message;
  return "Connexion impossible. Verifiez vos identifiants.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const target = useMemo(() => resolveTarget(location), [location]);
  const { user, isAuthenticated, isLoading, login, completeTwoFactorLogin } = useAuth();

  const [credentials, setCredentials] = useState({ username: "", password: "", remember_me: true });
  const [challengeId, setChallengeId] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated && hasPosAccess(user)) {
    return <Navigate to={target} replace />;
  }

  const setField = (key, value) => {
    setCredentials((current) => ({ ...current, [key]: value }));
  };

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = await login(credentials);
      if (payload.two_factor_required) {
        setChallengeId(payload.challenge_id);
        return;
      }
      if (!hasPosAccess(payload.user)) {
        setError("Ce compte est connecte, mais il n'a pas acces a l'espace POS Restaurant.");
        return;
      }
      navigate(target, { replace: true });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactor(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = await completeTwoFactorLogin({ challengeId, code: otpCode });
      if (!hasPosAccess(payload.user)) {
        setError("Ce compte est connecte, mais il n'a pas acces a l'espace POS Restaurant.");
        return;
      }
      navigate(target, { replace: true });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pos-login-shell">
      <section className="pos-login-card" aria-labelledby="pos-login-title">
        <div className="pos-login-brand">
          <span className="pos-nav-mark">POS</span>
          <span>AFRIVO Restaurant</span>
        </div>

        <h1 id="pos-login-title" className="pos-login-title">
          Connexion restaurant
        </h1>
        <p className="pos-login-subtitle">
          Espace autonome pour les tables, les commandes, la cuisine et les encaissements.
        </p>

        {error && <div className="pos-login-error">{error}</div>}

        {!challengeId ? (
          <form className="pos-login-form" onSubmit={handleLogin}>
            <label className="pos-login-field">
              <span className="pos-login-label">Identifiant</span>
              <input
                className="pos-login-input"
                type="text"
                autoComplete="username"
                value={credentials.username}
                onChange={(event) => setField("username", event.target.value)}
                required
              />
            </label>
            <label className="pos-login-field">
              <span className="pos-login-label">Mot de passe</span>
              <input
                className="pos-login-input"
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(event) => setField("password", event.target.value)}
                required
              />
            </label>
            <label className="pos-login-check">
              <input
                type="checkbox"
                checked={credentials.remember_me}
                onChange={(event) => setField("remember_me", event.target.checked)}
              />
              <span>Maintenir la session POS ouverte</span>
            </label>
            <button className="pos-btn pos-btn-primary pos-login-submit" type="submit" disabled={submitting}>
              {submitting ? "Connexion en cours..." : "Se connecter au POS"}
            </button>
          </form>
        ) : (
          <form className="pos-login-form" onSubmit={handleTwoFactor}>
            <label className="pos-login-field">
              <span className="pos-login-label">Code de securite</span>
              <input
                className="pos-login-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                required
              />
            </label>
            <button className="pos-btn pos-btn-primary pos-login-submit" type="submit" disabled={submitting}>
              {submitting ? "Verification..." : "Valider le code"}
            </button>
          </form>
        )}
      </section>

      <aside className="pos-login-side" aria-label="Synthese POS">
        <div className="pos-login-stat">
          <span>Tables</span>
          <strong>Service autonome</strong>
        </div>
        <div className="pos-login-stat">
          <span>Cuisine</span>
          <strong>Suivi temps reel</strong>
        </div>
        <div className="pos-login-stat">
          <span>Hotel</span>
          <strong>Lie a AFRIVO</strong>
        </div>
      </aside>
    </div>
  );
}
