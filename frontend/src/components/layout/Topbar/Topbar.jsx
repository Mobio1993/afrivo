import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { canWriteModule, hasPermission } from "../../../auth/permissions";
import "./Topbar.css";

const pageMeta = [
  {
    match: /^\/$/,
    title: "Accueil",
    subtitle: "Vue d'ensemble de votre etablissement.",
    eyebrow: "Espace de travail",
    modules: ["dashboard"],
  },
  {
    match: /^\/dashboard$/,
    title: "Dashboard",
    subtitle: "Pilotage global, KPIs et activite en temps reel.",
    eyebrow: "Direction",
    modules: ["dashboard"],
  },
  {
    match: /^\/clients$/,
    title: "Clients",
    subtitle: "Base clients, historique sejours et fidelisation.",
    eyebrow: "Relation client",
    modules: ["clients"],
  },
  {
    match: /^\/rooms$/,
    title: "Chambres",
    subtitle: "Inventaire, housekeeping, maintenance et pilotage temps reel.",
    eyebrow: "Rooms intelligence",
    modules: ["rooms", "operations"],
  },
  {
    match: /^\/exploitation$/,
    title: "Exploitation",
    subtitle: "Suivi superviseur des files et priorites terrain.",
    eyebrow: "Operations",
    modules: ["operations"],
  },
  {
    match: /^\/operations$/,
    title: "Operations",
    subtitle: "Poste de travail reception et creation des flux metier.",
    eyebrow: "Front office",
    modules: ["operations"],
  },
  {
    match: /^\/operations\/.+/,
    title: "Detail operation",
    subtitle: "Consultation et actions detaillees sur un flux.",
    eyebrow: "Front office",
    modules: ["operations"],
  },
  {
    match: /^\/reports$/,
    title: "Rapports",
    subtitle: "Lecture analytique et reporting metier.",
    eyebrow: "Analytique",
    modules: ["reports"],
  },
  {
    match: /^\/users$/,
    title: "Utilisateurs",
    subtitle: "Gestion des comptes internes et des roles metier.",
    eyebrow: "Administration",
    modules: ["users"],
  },
  {
    match: /^\/platform$/,
    title: "Console plateforme",
    subtitle: "Supervision globale des hotels, abonnements et admins AFRIVO.",
    eyebrow: "Platform admin",
    modules: ["platform_security"],
  },
  {
    match: /^\/platform\/organizations$/,
    title: "Organisations",
    subtitle: "Portefeuille client, parc hotels et readiness commerciale.",
    eyebrow: "Platform admin",
    modules: ["platform_organizations"],
  },
  {
    match: /^\/platform\/hotels$/,
    title: "Hotels abonnes",
    subtitle: "Vue portefeuille du parc hotelier et des etats d'abonnement.",
    eyebrow: "Platform admin",
    modules: ["platform_hotels"],
  },
  {
    match: /^\/platform\/subscriptions$/,
    title: "Abonnements",
    subtitle: "Lecture des plans, essais, suspensions et echeances.",
    eyebrow: "Platform admin",
    modules: ["platform_subscriptions"],
  },
  {
    match: /^\/platform\/users$/,
    title: "Admins plateforme",
    subtitle: "Population admin plateforme et admins hotel.",
    eyebrow: "Platform admin",
    modules: ["platform_users"],
  },
  {
    match: /^\/platform\/security$/,
    title: "Securite plateforme",
    subtitle: "Journal des evenements sensibles, audit et supervision globale.",
    eyebrow: "Platform admin",
    modules: ["platform_security"],
  },
];

function resolvePageMeta(pathname) {
  return (
    pageMeta.find((item) => item.match.test(pathname)) || {
      title: "AFRIVO",
      subtitle: "Espace de travail premium.",
      eyebrow: "Workspace",
      modules: [],
    }
  );
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export function Topbar({ user, onMenuClick, isSidebarOpen = false }) {
  const location = useLocation();
  const currentPage = resolvePageMeta(location.pathname);
  const [now, setNow] = useState(new Date());
  const visibleModules = (currentPage.modules || []).filter((module) => hasPermission(user, module, "view"));
  const isReadOnly = visibleModules.length > 0 && !visibleModules.some((module) => canWriteModule(user, module));

  useEffect(() => {
    const msUntilMidnight = () => {
      const time = new Date();
      return (
        (23 - time.getHours()) * 3600000
        + (59 - time.getMinutes()) * 60000
        + (60 - time.getSeconds()) * 1000
      );
    };

    const timeout = setTimeout(() => {
      setNow(new Date());
    }, msUntilMidnight());

    return () => clearTimeout(timeout);
  }, [now]);

  return (
    <header className="topbar">
      <div className="topbar-layout">
        <button
          type="button"
          className="ghost-button topbar-menu-button"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          aria-expanded={isSidebarOpen}
          aria-controls="mobile-sidebar-drawer"
        >
          <span className="topbar-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="topbar-copy">
          <div className="topbar-eyebrow">
            <span className="topbar-eyebrow-dot" aria-hidden="true" />
            {currentPage.eyebrow}
          </div>
          <strong className="topbar-title">{currentPage.title}</strong>
          <span className="topbar-subtitle">{currentPage.subtitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {isReadOnly ? <div className="topbar-readonly-chip">Lecture seule</div> : null}
        <div className="topbar-date-chip">
          <CalendarIcon />
          {formatDate(now)}
        </div>
      </div>
    </header>
  );
}
