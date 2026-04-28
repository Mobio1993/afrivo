import { NavLink } from "react-router-dom";

import { hasPermission } from "../../../auth/permissions";
import "./Sidebar.css";

const Icons = {
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
    </svg>
  ),
  Clients: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="8" r="3" />
      <path d="M22 20c0-2.8-2-5-5-5" />
    </svg>
  ),
  Rooms: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" />
      <path d="M3 13h18" />
      <path d="M9 21v-4h6v4" />
      <path d="M7 9h.01" />
      <path d="M17 9h.01" />
    </svg>
  ),
  Exploitation: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  Operations: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1.5" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  Reports: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V6l7-3z" />
      <path d="M9.5 12.5l1.7 1.7L15 10.3" />
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M8 7h.01" />
      <path d="M8 11h.01" />
      <path d="M8 15h.01" />
      <path d="M12 7h.01" />
      <path d="M12 11h.01" />
      <path d="M12 15h.01" />
      <path d="M10 21v-3h2v3" />
    </svg>
  ),
  CreditCard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Hotel: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" />
    </svg>
  ),
};

const navigationItems = [
  { to: "/dashboard", label: "Dashboard", Icon: Icons.Dashboard, end: true, permissions: [["dashboard", "view"]] },
  { to: "/clients", label: "Clients", Icon: Icons.Clients, permissions: [["clients", "view"]] },
  { to: "/rooms", label: "Chambres", Icon: Icons.Rooms, permissions: [["rooms", "view"], ["operations", "view"]] },
  { to: "/exploitation", label: "Exploitation", Icon: Icons.Exploitation, permissions: [["operations", "view"]] },
  { to: "/operations", label: "Operations", Icon: Icons.Operations, badge: "·", permissions: [["operations", "view"]] },
  { to: "/reports", label: "Rapports", Icon: Icons.Reports, permissions: [["reports", "view"]] },
  { to: "/users", label: "Utilisateurs", Icon: Icons.Users, permissions: [["users", "view"]] },
];

const platformNavigationItems = [
  { to: "/platform", label: "Vue plateforme", Icon: Icons.Shield, end: true, permissions: [["platform_security", "view"]] },
  { to: "/platform/organizations", label: "Organisations", Icon: Icons.Building, permissions: [["platform_organizations", "view"]] },
  { to: "/platform/hotels", label: "Hotels", Icon: Icons.Rooms, permissions: [["platform_hotels", "view"]] },
  { to: "/platform/subscriptions", label: "Abonnements", Icon: Icons.CreditCard, permissions: [["platform_subscriptions", "view"]] },
  { to: "/platform/users", label: "Admins", Icon: Icons.Users, permissions: [["platform_users", "view"]] },
  { to: "/platform/security", label: "Securite", Icon: Icons.Shield, permissions: [["platform_security", "view"]] },
];

function buildInitials(user) {
  if (!user) return "?";
  const first = user.first_name?.[0] || "";
  const last = user.last_name?.[0] || "";
  return (first + last).toUpperCase() || (user.username?.[0] || "U").toUpperCase();
}

function formatRole(role) {
  if (!role) return "Utilisateur";
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPlatformAdmin(user) {
  return Boolean(
    user
    && (
      user.is_platform_admin === true
      || user.role === "platform_admin"
      || user.role_code === "platform_admin"
    )
  );
}

export function Sidebar({ user, onLogout, isDrawer = false, onClose }) {
  const hotelName = user?.hotel_name || import.meta.env.VITE_HOTEL_NAME || "Hotel";
  const visibleNavigationItems = navigationItems.filter((item) =>
    item.permissions.some(([module, action]) => hasPermission(user, module, action)),
  );
  const visiblePlatformNavigationItems = isPlatformAdmin(user)
    ? platformNavigationItems.filter((item) =>
        item.permissions.some(([module, action]) => hasPermission(user, module, action)),
      )
    : [];

  return (
    <aside
      className={`sidebar ${isDrawer ? "sidebar-drawer" : ""}`}
      id={isDrawer ? "mobile-sidebar-drawer" : undefined}
    >
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <div className="brand-block">
            <div className="brand-logo-row">
              <div className="brand-logo-mark">
                <Icons.Hotel />
              </div>

              <div className="brand-wordmark">
                <span className="brand-name">AFRIVO</span>
                <span className="brand-tagline">Hotel Management</span>
              </div>
            </div>

            <div className="brand-hotel-pill">
              <span className="brand-hotel-dot" aria-hidden="true" />
              <span className="brand-hotel-name">{hotelName}</span>
            </div>
          </div>

          <button
            type="button"
            className="ghost-button sidebar-close-button"
            onClick={onClose}
            aria-label="Fermer le menu"
          >
            <Icons.Close />
          </button>
        </div>

        <div className="sidebar-nav-region">
          <span className="nav-section-label">Navigation</span>
          <nav className="nav-list" aria-label="Navigation principale">
            {visibleNavigationItems.map(({ to, label, Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="nav-link"
                onClick={isDrawer ? onClose : undefined}
              >
                <span className="nav-link-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="nav-link-label">{label}</span>
                {badge ? <span className="nav-link-badge">{badge}</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>

        {visiblePlatformNavigationItems.length ? (
          <div className="sidebar-nav-region">
            <span className="nav-section-label">Plateforme</span>
            <nav className="nav-list" aria-label="Navigation plateforme">
              {visiblePlatformNavigationItems.map(({ to, label, Icon, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="nav-link"
                  onClick={isDrawer ? onClose : undefined}
                >
                  <span className="nav-link-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="nav-link-label">{label}</span>
                  {badge ? <span className="nav-link-badge">{badge}</span> : null}
                </NavLink>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {buildInitials(user)}
            </div>
            <div className="sidebar-user-info">
              <strong>{user?.first_name || user?.username || "Utilisateur"}</strong>
              <span>{formatRole(user?.role)}</span>
            </div>
          </div>

          <div className="sidebar-footer-actions">
            <button
              type="button"
              className="sidebar-logout-button"
              onClick={onLogout}
            >
              <Icons.LogOut />
              Se deconnecter
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
