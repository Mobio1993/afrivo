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
    match: /^\/hotel-admin\/dashboard$/,
    title: "Dashboard hotel",
    subtitle: "Pilotage global, KPIs et activite en temps reel.",
    eyebrow: "Hotel admin",
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
    match: /^\/smart-rooms$/,
    title: "Chambres intelligentes",
    subtitle: "Suivi en temps reel - presence, capteurs, alertes, energie.",
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
    match: /^\/operations\/bookings$/,
    title: "Reservations",
    subtitle: "Liste, recherche et suivi des reservations.",
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
    match: /^\/reservation-planning$/,
    title: "Planning des reservations",
    subtitle: "Vue d'ensemble des chambres.",
    eyebrow: "Front office",
    modules: ["operations"],
  },
  {
    match: /^\/payments$/,
    title: "Paiements",
    subtitle: "Encaissements, moyens de paiement, remboursements et suivi caisse.",
    eyebrow: "Caisse",
    modules: ["payments"],
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
    match: /^\/settings$/,
    title: "Parametres",
    subtitle: "Configuration hotel, facturation, securite et apparence.",
    eyebrow: "Administration",
    modules: ["settings"],
  },
  {
    match: /^\/history\/activity-logs$/,
    title: "Journal d'activite",
    subtitle: "Suivi multi-tenant des actions utilisateurs, changements sensibles et evenements operationnels.",
    eyebrow: "Audit log",
    modules: ["history"],
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
    match: /^\/platform\/modules$/,
    title: "Modules plateforme",
    subtitle: "Catalogue des modules activables et configuration SaaS.",
    eyebrow: "Platform admin",
    modules: ["platform_modules"],
  },
  {
    match: /^\/platform\/licenses$/,
    title: "Licences",
    subtitle: "Controle des droits d'acces modules par organisation et hotel.",
    eyebrow: "Platform admin",
    modules: ["platform_licenses"],
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
    title: "Utilisateurs & acces POS",
    subtitle: "Population admin plateforme, admins hotel et acces POS Restaurant.",
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
  {
    match: /^\/super-root$/,
    title: "Console super root",
    subtitle: "Supervision globale de la plateforme AFRIVO.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/dashboard$/,
    title: "Console super root",
    subtitle: "Supervision globale de la plateforme AFRIVO.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/platforms$/,
    title: "Plateformes",
    subtitle: "Supervision globale des plateformes, modules et etats systeme.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/organizations$/,
    title: "Organisations",
    subtitle: "Portefeuille client, parc hotels et readiness commerciale.",
    eyebrow: "Super root",
    modules: ["platform_organizations"],
  },
  {
    match: /^\/super-root\/hotels$/,
    title: "Hotels abonnes",
    subtitle: "Vue portefeuille du parc hotelier et des etats d'abonnement.",
    eyebrow: "Super root",
    modules: ["platform_hotels"],
  },
  {
    match: /^\/super-root\/modules$/,
    title: "Modules plateforme",
    subtitle: "Catalogue des modules activables et configuration SaaS.",
    eyebrow: "Super root",
    modules: ["platform_modules"],
  },
  {
    match: /^\/super-root\/licenses$/,
    title: "Licences",
    subtitle: "Controle des droits d'acces modules par organisation et hotel.",
    eyebrow: "Super root",
    modules: ["platform_licenses"],
  },
  {
    match: /^\/super-root\/(?:roles|permissions)$/,
    title: "Roles & permissions",
    subtitle: "Lecture des roles IAM, permissions et frontieres d'administration.",
    eyebrow: "Super root",
    modules: ["platform_users"],
  },
  {
    match: /^\/super-root\/users$/,
    title: "Utilisateurs & acces POS",
    subtitle: "Population admin plateforme, admins hotel et acces POS Restaurant.",
    eyebrow: "Super root",
    modules: ["platform_users"],
  },
  {
    match: /^\/super-root\/security$/,
    title: "Securite plateforme",
    subtitle: "Journal des evenements sensibles, audit et supervision globale.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/audit-logs$/,
    title: "Audit logs",
    subtitle: "Journal global des actions sensibles et evenements plateforme.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/security-alerts$/,
    title: "Alertes securite",
    subtitle: "Signaux de securite, comptes sensibles et alertes systeme.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/settings$/,
    title: "Parametres systeme",
    subtitle: "Configuration systeme non sensible et readiness technique.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/maintenance$/,
    title: "Maintenance systeme",
    subtitle: "Readiness, healthcheck et actions techniques reservees.",
    eyebrow: "Super root",
    modules: ["platform_security"],
  },
  {
    match: /^\/super-root\/backups$/,
    title: "Backups",
    subtitle: "Facade de sauvegarde et statut d'infrastructure backup.",
    eyebrow: "Super root",
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

function SplitTitle({ text }) {
  return (
    <>
      {[...text].map((char, i) => (
        <span
          key={i}
          className="topbar-title-char"
          style={{ animationDelay: `${Math.min(i * 20, 220)}ms` }}
          aria-hidden="true"
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </>
  );
}

export function Topbar({ user, actions, onMenuClick, isSidebarOpen = false }) {
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
          <strong key={location.pathname} className="topbar-title" aria-label={currentPage.title}>
            <SplitTitle text={currentPage.title} />
          </strong>
          <span className="topbar-subtitle">{currentPage.subtitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {actions ? <div className="topbar-custom-actions">{actions}</div> : null}
        {isReadOnly ? <div className="topbar-readonly-chip">Lecture seule</div> : null}
        <div className="topbar-date-chip">
          <CalendarIcon />
          {formatDate(now)}
        </div>
      </div>
    </header>
  );
}
