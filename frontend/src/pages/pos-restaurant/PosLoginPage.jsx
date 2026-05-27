import { Navigate, useLocation, useNavigate } from "react-router-dom";

import PlAnimatedBackground from "../../components/pos-restaurant/PlAnimatedBackground";
import PlModuleCard from "../../components/pos-restaurant/PlModuleCard";
import { hasPosAccess } from "../../components/pos-restaurant/RequirePosAccess";
import { useAuth } from "../../auth/AuthContext";
import { usePosLogin } from "../../hooks/usePosLogin";
import "../../styles/pos-login.css";

const MODULES = [
  {
    icon: "ti-layout-grid",
    tag: "Tables",
    name: "Service autonome",
    description: "Gestion des tables et commandes",
    color: "#5DCAA5",
    active: true,
  },
  {
    icon: "ti-tool-kitchen-2",
    tag: "Cuisine",
    name: "Suivi temps reel",
    description: "Tickets et preparation cuisine",
    color: "#85B7EB",
    active: false,
  },
  {
    icon: "ti-building",
    tag: "Hotel",
    name: "Lie a AFRIVO",
    description: "Facturation chambre integree",
    color: "#AFA9EC",
    active: false,
  },
];

const STATS = [
  { value: "24/7", label: "Disponible" },
  { value: "100%", label: "Securise" },
  { value: "Multi", label: "Etablissements" },
];

const PILLS = [
  { icon: "ti-layout-grid", label: "Tables", active: true },
  { icon: "ti-tool-kitchen-2", label: "Cuisine", active: true },
  { icon: "ti-receipt", label: "Caisse", active: false },
  { icon: "ti-building", label: "Hotel", active: false },
];

function resolveTarget(location) {
  const candidate = location.state?.from?.pathname || "/pos-restaurant/tables";
  if (!candidate.startsWith("/pos-restaurant") || candidate === "/pos-restaurant/login") {
    return "/pos-restaurant/tables";
  }
  return candidate;
}

export function PosLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const {
    identifiant,
    setIdentifiant,
    password,
    setPassword,
    remember,
    setRemember,
    showPassword,
    setShowPassword,
    loading,
    error,
    setError,
    challengeId,
    otpCode,
    setOtpCode,
    handleSubmit,
  } = usePosLogin();

  const targetPath = resolveTarget(location);

  if (!isLoading && isAuthenticated && hasPosAccess(user)) {
    return <Navigate to={targetPath} replace />;
  }

  const onSubmit = (event) => {
    handleSubmit(event, navigate, targetPath);
  };

  return (
    <div className="pl-page">
      <PlAnimatedBackground />

      <div className="pl-left">
        <nav className="pl-nav">
          <div className="pl-brand">
            <div className="pl-brand-ico">POS</div>
            <span className="pl-brand-name">AFRIVO Restaurant</span>
          </div>
          <span className="pl-suite-badge">AFRIVO Hospitality Suite</span>
        </nav>

        <div className="pl-hero">
          <div className="pl-eyebrow">
            <div className="pl-eyebrow-line" />
            Point de vente - Hotel Management
          </div>
          <h1 className="pl-headline">
            Gerez votre service
            <br />
            avec une <span className="pl-headline-accent">longueur d'avance.</span>
          </h1>
          <p className="pl-headline-sub">
            La plateforme pensee pour les restaurateurs
            <br />
            et hoteliers africains modernes.
          </p>
          <div className="pl-pills">
            {PILLS.map((pill) => (
              <span key={pill.label} className={`pl-pill ${pill.active ? "pl-pill-active" : ""}`}>
                <i className={`ti ${pill.icon}`} aria-hidden="true" />
                {pill.label}
              </span>
            ))}
          </div>
        </div>

        <div className="pl-stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="pl-stat">
              <span className="pl-stat-val">{stat.value}</span>
              <span className="pl-stat-lbl">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pl-right">
        <form className="pl-form" onSubmit={onSubmit} noValidate>
          <div className="pl-greeting">
            <div className="pl-greeting-dot" />
            Bonjour
          </div>
          <h2 className="pl-form-title">Accedez au POS</h2>
          <p className="pl-form-sub">Identifiez-vous pour reprendre votre activite.</p>

          {error && (
            <div className="pl-error-banner" role="alert">
              <i className="ti ti-alert-circle" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {!challengeId ? (
            <>
              <div className="pl-fg">
                <label className="pl-lbl" htmlFor="pos-login-id">
                  Identifiant ou email
                </label>
                <div className="pl-input-wrap">
                  <i className="ti ti-user pl-input-ico" aria-hidden="true" />
                  <input
                    id="pos-login-id"
                    className={`pl-input ${error && !identifiant ? "pl-input-err" : ""}`}
                    type="text"
                    autoComplete="username"
                    placeholder="admin ou nom@afrivo.com"
                    value={identifiant}
                    onChange={(event) => {
                      setIdentifiant(event.target.value);
                      setError(null);
                    }}
                    disabled={loading}
                  />
                </div>
                <span className="pl-hint">Utilisez vos acces professionnels pour ouvrir votre session.</span>
              </div>

              <div className="pl-fg">
                <label className="pl-lbl" htmlFor="pos-login-pw">
                  Mot de passe
                </label>
                <div className="pl-input-wrap">
                  <i className="ti ti-lock pl-input-ico" aria-hidden="true" />
                  <input
                    id="pos-login-pw"
                    className={`pl-input ${error && !password ? "pl-input-err" : ""}`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="pl-pw-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    disabled={loading}
                  >
                    <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} aria-hidden="true" />
                  </button>
                </div>
                <span className="pl-hint">Votre mot de passe reste protege pendant toute la session.</span>
              </div>

              <label className="pl-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={loading}
                />
                <span>Maintenir la session POS ouverte - Session securisee AFRIVO</span>
              </label>
            </>
          ) : (
            <div className="pl-fg">
              <label className="pl-lbl" htmlFor="pos-login-otp">
                Code de securite
              </label>
              <div className="pl-input-wrap">
                <i className="ti ti-shield-lock pl-input-ico" aria-hidden="true" />
                <input
                  id="pos-login-otp"
                  className={`pl-input ${error && !otpCode ? "pl-input-err" : ""}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code a 6 chiffres"
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                />
              </div>
              <span className="pl-hint">Entrez le code de validation de votre compte AFRIVO.</span>
            </div>
          )}

          <button type="submit" className="pl-btn" disabled={loading}>
            {loading ? (
              <>
                <i className="ti ti-loader pl-spin" aria-hidden="true" />
                Connexion en cours...
              </>
            ) : (
              <>
                {challengeId ? "Valider le code" : "Se connecter au POS"}
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>

          <div className="pl-modules-section">
            <div className="pl-modules-lbl">Acces direct par role</div>
            <div className="pl-modules-list">
              {MODULES.map((module) => (
                <PlModuleCard key={module.tag} {...module} />
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PosLoginPage;

