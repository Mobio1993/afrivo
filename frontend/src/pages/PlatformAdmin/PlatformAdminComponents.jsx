/**
 * AFRIVO — Platform Admin Shared UI Components
 *
 * Exports:
 *   PlatformNavTabs     — tab-bar navigation (#1)
 *   PlatformBadge       — compact status badge with dot (#2)
 *   PlatformKpiCard     — KPI summary card with icon + trend (#3)
 *   PlatformEntityCell  — avatar + name/sub cell for tables (#4)
 *   PlatformEmptyState  — icon + message + optional CTA (#6)
 */

import { NavLink } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   #1  PLATFORM NAV TABS
   Remplace les <div className="platform-admin-page-links">
   dupliqués dans chaque page par un composant centralisé.

   Usage:
     <PlatformNavTabs links={PLATFORM_LINKS} />

   où PLATFORM_LINKS = [{ to: "/platform", label: "Vue plateforme" }, ...]
   ───────────────────────────────────────────────────────────── */

export const PLATFORM_LINKS_ALL = [
  { to: "/platform",               label: "Vue plateforme", end: true },
  { to: "/platform/organizations", label: "Clients SaaS" },
  { to: "/platform/hotels",        label: "Hôtels" },
  { to: "/platform/modules",       label: "Modules" },
  { to: "/platform/licenses",      label: "Licences" },
  { to: "/platform/subscriptions", label: "Abonnements" },
  { to: "/platform/users",         label: "Utilisateurs & acces POS" },
  { to: "/platform/security",      label: "Sécurité" },
];

export function PlatformNavTabs({ links = PLATFORM_LINKS_ALL }) {
  return (
    <nav className="platform-admin-page-links" aria-label="Navigation plateforme">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end ?? link.to === "/platform"}
          className={({ isActive }) =>
            `platform-admin-page-link${isActive ? " active" : ""}`
          }
        >
          {link.icon && (
            <span style={{ width: 15, height: 15, display: "inline-flex", alignItems: "center" }}>
              {link.icon}
            </span>
          )}
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   #2  PLATFORM BADGE
   Remplace les <span className="platform-admin-badge platform-admin-badge--{status}">
   avec une API plus claire.

   Usage:
     <PlatformBadge status="active" label="Actif" />
     <PlatformBadge status="trial"  label="Essai" />
   ───────────────────────────────────────────────────────────── */

const STATUS_LABEL_MAP = {
  active:    "Actif",
  inactive:  "Inactif",
  trial:     "Essai",
  suspended: "Suspendu",
  expired:   "Expiré",
  cancelled: "Annulé",
  draft:     "Brouillon",
  online:    "En ligne",
  platform:  "Plateforme",
  critical:  "Critique",
  warning:   "Attention",
  unlimited: "Illimité",
  neutral:   "—",
};

export function PlatformBadge({ status, label, className = "" }) {
  const normalized = String(status || "neutral").toLowerCase();
  const displayLabel = label ?? STATUS_LABEL_MAP[normalized] ?? normalized;
  return (
    <span
      className={`platform-admin-badge platform-admin-badge--${normalized} ${className}`.trim()}
    >
      {displayLabel}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   #3  PLATFORM KPI CARD
   Remplace les <article className="info-card"> par un composant
   enrichi avec icône colorée + valeur + tendance.

   Usage:
     <PlatformKpiCard
       icon={<HotelIcon />}
       iconVariant="teal"
       label="Hôtels actifs"
       value={24}
       trend="+3 ce mois"
       trendVariant="up"
     />

   iconVariant: "teal" | "blue" | "amber" | "rose" | "slate"
   trendVariant: "up" | "down" | "neutral"
   ───────────────────────────────────────────────────────────── */

export function PlatformKpiCard({
  icon,
  iconVariant = "teal",
  label,
  value,
  trend,
  trendVariant = "neutral",
  meta,
}) {
  return (
    <article className="platform-admin-kpi-card">
      <div className="platform-admin-kpi-header">
        <div>
          <div className="platform-admin-kpi-label">{label}</div>
        </div>
        {icon && (
          <div className={`platform-admin-kpi-icon platform-admin-kpi-icon--${iconVariant}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="platform-admin-kpi-value">{value ?? "—"}</div>

      {(trend || meta) && (
        <div className={`platform-admin-kpi-trend platform-admin-kpi-trend--${trendVariant}`}>
          {trendVariant === "up"   && <TrendArrow dir="up" />}
          {trendVariant === "down" && <TrendArrow dir="down" />}
          {trend || meta}
        </div>
      )}
    </article>
  );
}

function TrendArrow({ dir }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {dir === "up" ? (
        <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   #4  PLATFORM ENTITY CELL
   Injecte un avatar initiales coloré dans une <td> de table.

   Usage (dans un <tr>):
     <td>
       <PlatformEntityCell
         name={item.name}
         sub={item.code}
         status={item.subscription_status || (item.is_active ? "active" : "inactive")}
       />
     </td>

   L'avatar prend les 2 premières lettres du nom et se colorise
   selon le statut (active = vert, trial = amber, etc.)
   ───────────────────────────────────────────────────────────── */

function getInitials(name = "") {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function PlatformEntityCell({ name, sub, status = "neutral" }) {
  const normalized = String(status || "neutral").toLowerCase();
  const initials = getInitials(name);

  return (
    <div className="platform-admin-entity-cell">
      <div className={`platform-admin-avatar platform-admin-avatar--${normalized}`}>
        {initials}
      </div>
      <div className="platform-admin-row-title">
        <strong>{name || "—"}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   #6  PLATFORM EMPTY STATE
   Remplace les <div className="platform-admin-empty-state">
   avec un affichage enrichi : icône + titre + description + CTA.

   Usage:
     <PlatformEmptyState
       icon={<HotelIcon />}
       title="Aucun hôtel trouvé"
       description="Ajustez le filtre ou créez votre premier établissement."
       action={{ label: "Créer un hôtel", onClick: handleCreate }}
     />
   ───────────────────────────────────────────────────────────── */

export function PlatformEmptyState({ icon, title, description, action }) {
  return (
    <div className="platform-admin-empty-state">
      {icon && (
        <div className="platform-admin-empty-icon">
          {icon}
        </div>
      )}
      {title && <strong>{title}</strong>}
      {description && <p>{description}</p>}
      {action && (
        <button
          type="button"
          className="ghost-button"
          onClick={action.onClick}
          style={{ marginTop: 4 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SVG ICONS — légers, inline, réutilisables dans tout le module
   ───────────────────────────────────────────────────────────── */

export function IconHotel() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 16V11h6v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 2v4M6 4h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconOrg() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 15.5c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSubscription() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 11h2M10 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2.5 16c0-3 2.91-5 6.5-5s6.5 2 6.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSecurity() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L3 4.5v4.75c0 3.25 2.5 6 6 7 3.5-1 6-3.75 6-7V4.5L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 9l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconEmpty() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 9h8M7 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2 9h18" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

export function IconEmptyUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 20c0-4 3.58-6.5 8-6.5s8 2.5 8 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconEmptyHotel() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="8" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 20V14h8v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M11 2v6M7 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconEmptyEvent() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 2v4M15 2v4M2 10h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  );
}
