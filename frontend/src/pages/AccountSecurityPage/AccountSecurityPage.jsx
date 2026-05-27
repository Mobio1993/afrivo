import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import {
  changeOwnPassword,
  disableTwoFactor,
  listAuthSessions,
  prepareTwoFactor,
  revokeAllAuthSessions,
  revokeAuthSession,
  verifyTwoFactor,
} from "../../services/authSecurityService";
import "./AccountSecurityPage.css";

const MODULE_LABELS = {
  dashboard: "Dashboard",
  clients: "Clients",
  rooms: "Chambres",
  operations: "Operations",
  billing: "Facturation",
  payments: "Paiements",
  reports: "Rapports",
  history: "Historique",
  users: "Utilisateurs",
  settings: "Parametres",
  satisfaction: "Satisfaction",
  platform_organizations: "Clients SaaS",
  platform_hotels: "Hotels plateforme",
  platform_modules: "Modules plateforme",
  platform_licenses: "Licences plateforme",
  platform_subscriptions: "Abonnements",
  platform_users: "Admins plateforme",
  platform_security: "Securite plateforme",
};

const ACTION_LABELS = {
  view: "Voir",
  create: "Creer",
  update: "Modifier",
  delete: "Supprimer",
  manage: "Gerer",
};

const PASSWORD_INITIAL = {
  current_password: "",
  new_password: "",
  new_password_confirm: "",
};

const WEAK_PASSWORD_TERMS = ["password", "admin", "afrivo", "123456"];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPermissionRows(permissions) {
  return Object.entries(permissions || {})
    .map(([module, actions]) => {
      const enabledActions = Object.entries(actions || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([action]) => action);
      return {
        module,
        label: MODULE_LABELS[module] || module,
        actions: enabledActions,
      };
    })
    .filter((row) => row.actions.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildPasswordChecks(password, username) {
  const value = String(password || "");
  const lowerValue = value.toLowerCase();
  const lowerUsername = String(username || "").toLowerCase();

  return [
    {
      id: "length",
      label: "8 caracteres minimum",
      valid: value.length >= 8,
    },
    {
      id: "uppercase",
      label: "Au moins 1 majuscule",
      valid: /[A-Z]/.test(value),
    },
    {
      id: "lowercase",
      label: "Au moins 1 minuscule",
      valid: /[a-z]/.test(value),
    },
    {
      id: "digit",
      label: "Au moins 1 chiffre",
      valid: /\d/.test(value),
    },
    {
      id: "special",
      label: "Au moins 1 caractere special",
      valid: /[^A-Za-z0-9]/.test(value),
    },
    {
      id: "username",
      label: "Ne contient pas le username",
      valid: !lowerUsername || !lowerValue.includes(lowerUsername),
    },
    {
      id: "weak",
      label: "Pas de mot faible: password, admin, afrivo, 123456",
      valid: !WEAK_PASSWORD_TERMS.some((term) => lowerValue.includes(term)),
    },
  ];
}

function SessionCard({ session, busy, onRevoke }) {
  return (
    <article className={`iam-session-card ${session.is_active ? "on" : "off"}`}>
      <div className="iam-session-icon" aria-hidden="true">
        <i className="ti ti-device-laptop" />
      </div>
      <div className="iam-session-main">
        <div className="iam-session-title">
          <strong>{session.device_name || "Appareil inconnu"}</strong>
          <span>{session.is_active ? "Active" : "Revoquee"}</span>
        </div>
        <p>{session.ip_address || "IP inconnue"}</p>
        <small>Derniere activite : {formatDateTime(session.last_activity)}</small>
      </div>
      <button
        type="button"
        className="iam-session-revoke"
        onClick={() => onRevoke(session.id)}
        disabled={busy || !session.is_active}
      >
        <i className="ti ti-logout" aria-hidden="true" />
        Revoquer
      </button>
    </article>
  );
}

export function AccountSecurityPage() {
  const { user, logout, refreshSession } = useAuth();
  const { permissions } = usePermissions();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorPrepared, setTwoFactorPrepared] = useState(false);
  const [passwordForm, setPasswordForm] = useState(PASSWORD_INITIAL);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const permissionRows = useMemo(() => buildPermissionRows(permissions), [permissions]);
  const passwordChecks = useMemo(
    () => buildPasswordChecks(passwordForm.new_password, user?.username),
    [passwordForm.new_password, user?.username],
  );
  const passwordIsStrong = passwordChecks.every((check) => check.valid);
  const passwordConfirmationOk =
    Boolean(passwordForm.new_password) && passwordForm.new_password === passwordForm.new_password_confirm;
  const passwordCanSubmit =
    Boolean(passwordForm.current_password) && passwordIsStrong && passwordConfirmationOk && !passwordBusy;
  const activeSessions = sessions.filter((session) => session.is_active).length;

  function setPasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  async function loadSessions() {
    setLoading(true);
    setError("");
    try {
      const payload = await listAuthSessions();
      setSessions(payload.results || []);
    } catch (requestError) {
      setError(requestError.message || "Impossible de charger les sessions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleRevokeSession(sessionId) {
    setBusyId(sessionId);
    setError("");
    setNotice("");
    try {
      await revokeAuthSession(sessionId);
      setNotice("Session revoquee.");
      await loadSessions();
    } catch (requestError) {
      setError(requestError.message || "Impossible de revoquer cette session.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeAll() {
    const confirmed = window.confirm(
      "Cette action deconnecte tous les appareils, y compris cette session. Continuer ?",
    );
    if (!confirmed) return;

    setBusyId("all");
    setError("");
    setNotice("");
    try {
      await revokeAllAuthSessions();
      await logout();
    } catch (requestError) {
      setError(requestError.message || "Impossible de revoquer les sessions.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePrepareTwoFactor() {
    setTwoFactorBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await prepareTwoFactor();
      setTwoFactorPrepared(true);
      setTwoFactorCode(payload.otp || "");
      setNotice("Code 2FA prepare. Saisissez le code recu pour activer la verification.");
    } catch (requestError) {
      setError(requestError.message || "Impossible de preparer la 2FA.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleVerifyTwoFactor() {
    if (twoFactorCode.trim().length !== 6) {
      setError("Le code 2FA doit contenir 6 chiffres.");
      return;
    }
    setTwoFactorBusy(true);
    setError("");
    setNotice("");
    try {
      await verifyTwoFactor(twoFactorCode.trim());
      setTwoFactorPrepared(false);
      setTwoFactorCode("");
      await refreshSession();
      setNotice("2FA activee sur ce compte.");
    } catch (requestError) {
      setError(requestError.message || "Code 2FA invalide.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleDisableTwoFactor() {
    setTwoFactorBusy(true);
    setError("");
    setNotice("");
    try {
      await disableTwoFactor();
      setTwoFactorPrepared(false);
      setTwoFactorCode("");
      await refreshSession();
      setNotice("2FA desactivee sur ce compte.");
    } catch (requestError) {
      setError(requestError.message || "Impossible de desactiver la 2FA.");
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!passwordForm.current_password) {
      setError("Le mot de passe actuel est obligatoire.");
      return;
    }
    if (!passwordIsStrong) {
      setError("Le nouveau mot de passe ne respecte pas toutes les exigences de securite.");
      return;
    }
    if (!passwordConfirmationOk) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setPasswordBusy(true);
    try {
      await changeOwnPassword(passwordForm);
      setPasswordForm(PASSWORD_INITIAL);
      setNotice("Mot de passe modifie. Vous allez etre redirige vers la connexion.");
      window.setTimeout(() => {
        logout();
      }, 1200);
    } catch (requestError) {
      const apiErrors = requestError.payload?.errors;
      const message = Array.isArray(apiErrors)
        ? apiErrors.join(" ")
        : requestError.payload?.detail || requestError.message || "Impossible de modifier le mot de passe.";
      setError(message);
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <main className="account-security-page">
      <header className="account-security-header">
        <div>
          <span className="account-security-eyebrow">IAM AFRIVO</span>
          <h1>Securite du compte</h1>
          <p>Sessions actives, droits utilisateur et contexte d'acces.</p>
        </div>
        <button
          type="button"
          className="account-security-danger"
          onClick={handleRevokeAll}
          disabled={busyId === "all" || activeSessions === 0}
        >
          <i className="ti ti-power" aria-hidden="true" />
          Tout deconnecter
        </button>
      </header>

      {error ? <div className="iam-alert error">{error}</div> : null}
      {notice ? <div className="iam-alert success">{notice}</div> : null}

      <section className="iam-summary-grid">
        <article>
          <span>Utilisateur</span>
          <strong>{user?.first_name || user?.username || "Compte AFRIVO"}</strong>
          <p>{user?.email || "Email non renseigne"}</p>
        </article>
        <article>
          <span>Role</span>
          <strong>{user?.role || user?.role_code || "Utilisateur"}</strong>
          <p>{user?.is_platform_admin ? "Console plateforme" : user?.hotel_name || "Hotel courant"}</p>
        </article>
        <article>
          <span>Sessions actives</span>
          <strong>{activeSessions}</strong>
          <p>{sessions.length} session(s) suivie(s)</p>
        </article>
        <article>
          <span>Double facteur</span>
          <strong>{user?.two_factor_enabled ? "Actif" : user?.two_factor_required ? "Requis" : "Inactif"}</strong>
          <p>{user?.two_factor_required ? "Compte sensible" : "Optionnel"}</p>
        </article>
      </section>

      <section className="iam-layout">
        <div className="iam-panel">
          <div className="iam-panel-head">
            <div>
              <h2>Sessions actives</h2>
              <p>Chaque appareil connecte possede un refresh token suivi et revocable.</p>
            </div>
            <button type="button" onClick={loadSessions} disabled={loading}>
              <i className="ti ti-refresh" aria-hidden="true" />
              Actualiser
            </button>
          </div>

          <div className="iam-session-list">
            {loading ? (
              <div className="iam-empty">Chargement des sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="iam-empty">Aucune session active trouvee.</div>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  busy={busyId === session.id}
                  onRevoke={handleRevokeSession}
                />
              ))
            )}
          </div>
        </div>

        <aside className="iam-panel">
          <form className="iam-password-box" onSubmit={handlePasswordChange}>
            <div className="iam-panel-head inline">
              <div>
                <h2>Modifier mon mot de passe</h2>
                <p>Une modification revoque les sessions et impose une reconnexion.</p>
              </div>
            </div>

            <div className="iam-password-form">
              <label>
                <span>Mot de passe actuel</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={(event) => setPasswordField("current_password", event.target.value)}
                  disabled={passwordBusy}
                />
              </label>
              <label>
                <span>Nouveau mot de passe</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordField("new_password", event.target.value)}
                  disabled={passwordBusy}
                />
              </label>
              <label>
                <span>Confirmation</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.new_password_confirm}
                  onChange={(event) => setPasswordField("new_password_confirm", event.target.value)}
                  disabled={passwordBusy}
                />
              </label>

              <div className="iam-password-policy" aria-live="polite">
                <div className="iam-password-policy-head">
                  <span>Force du mot de passe</span>
                  <strong className={passwordIsStrong && passwordConfirmationOk ? "strong" : "weak"}>
                    {passwordIsStrong && passwordConfirmationOk ? "Fort" : "A renforcer"}
                  </strong>
                </div>
                <div className="iam-password-checks">
                  {passwordChecks.map((check) => (
                    <span className={check.valid ? "valid" : ""} key={check.id}>
                      <i className={`ti ${check.valid ? "ti-circle-check" : "ti-circle"}`} aria-hidden="true" />
                      {check.label}
                    </span>
                  ))}
                  <span className={passwordConfirmationOk ? "valid" : ""}>
                    <i className={`ti ${passwordConfirmationOk ? "ti-circle-check" : "ti-circle"}`} aria-hidden="true" />
                    Confirmation identique
                  </span>
                </div>
              </div>

              <button type="submit" className="iam-password-submit" disabled={!passwordCanSubmit}>
                {passwordBusy ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </div>
          </form>

          <div className="iam-panel-head">
            <div>
              <h2>Verification 2FA</h2>
              <p>Renforcez l'acces avec un code email temporaire.</p>
            </div>
          </div>
          <div className="iam-two-factor-box">
            <strong>{user?.two_factor_enabled ? "2FA activee" : "2FA non activee"}</strong>
            <p>
              {user?.two_factor_required
                ? "Ce compte est considere sensible. Une verification 2FA est exigee a la connexion."
                : "Activez la 2FA pour proteger les operations sensibles."}
            </p>
            {twoFactorPrepared ? (
              <div className="iam-two-factor-form">
                <input
                  type="text"
                  inputMode="numeric"
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Code 2FA"
                  disabled={twoFactorBusy}
                />
                <button type="button" onClick={handleVerifyTwoFactor} disabled={twoFactorBusy}>
                  Valider
                </button>
              </div>
            ) : null}
            <div className="iam-two-factor-actions">
              <button type="button" onClick={handlePrepareTwoFactor} disabled={twoFactorBusy}>
                {user?.two_factor_enabled ? "Regenerer un code" : "Activer la 2FA"}
              </button>
              {user?.two_factor_enabled ? (
                <button type="button" className="danger" onClick={handleDisableTwoFactor} disabled={twoFactorBusy}>
                  Desactiver
                </button>
              ) : null}
            </div>
          </div>

          <div className="iam-panel-head">
            <div>
              <h2>Permissions utilisateur</h2>
              <p>Lecture claire des modules et actions autorisees.</p>
            </div>
          </div>

          <div className="iam-permission-list">
            {permissionRows.length === 0 ? (
              <div className="iam-empty">Aucune permission active.</div>
            ) : (
              permissionRows.map((row) => (
                <article className="iam-permission-row" key={row.module}>
                  <strong>{row.label}</strong>
                  <div>
                    {row.actions.map((action) => (
                      <span key={action}>{ACTION_LABELS[action] || action}</span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
