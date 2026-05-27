import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import "./SuperRootLoginPage.css";

const DASHBOARD_PATH = "/super-root/dashboard";
const LOGIN_PATH = "/super-root/login";

export function SuperRootMfaPage() {
  const { completeTwoFactorLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const challenge = location.state?.challenge;
  const [code, setCode] = useState(challenge?.otp || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!challenge?.challenge_id) {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  if (!isLoading && isAuthenticated) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (code.trim().length !== 6) {
      setError("Saisissez le code a 6 chiffres.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await completeTwoFactorLogin({
        challengeId: challenge.challenge_id,
        code: code.trim(),
      });
      navigate(DASHBOARD_PATH, { replace: true });
    } catch (requestError) {
      setError(requestError?.payload?.detail || "Code 2FA invalide ou expire.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="srl-page srl-page-mfa">
      <section className="srl-panel srl-panel-centered">
        <form className="srl-card srl-card-mfa" onSubmit={handleSubmit} noValidate>
          <div className="srl-card-head">
            <span className="srl-status-dot" aria-hidden="true" />
            <div>
              <h2>Verification Super Root</h2>
              <p>Ce compte sensible demande une verification supplementaire.</p>
            </div>
          </div>

          {error ? <div className="srl-alert" role="alert">{error}</div> : null}

          <div className="srl-field">
            <label htmlFor="super-root-mfa-code">Code 2FA</label>
            <div className="srl-input-wrap">
              <i className="ti ti-shield-lock" aria-hidden="true" />
              <input
                id="super-root-mfa-code"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={submitting}
              />
            </div>
          </div>

          <button type="submit" className="srl-submit" disabled={submitting || code.length !== 6}>
            {submitting ? "Verification..." : "Valider le code"}
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="srl-secondary"
            disabled={submitting}
            onClick={() => navigate(LOGIN_PATH, { replace: true })}
          >
            Revenir a la connexion
          </button>
        </form>
      </section>
    </main>
  );
}
