import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { hasHierarchyAccess, hasPermission } from "../../../auth/permissions";
import HotelBadge from "./HotelBadge";
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
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5l3 2" />
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
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
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.06A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.06A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.42.14.76.35 1 .6.28.29.43.68.4 1.1V11a2 2 0 1 1 0 4h-.06a1.7 1.7 0 0 0-1.34.6z" />
    </svg>
  ),
  SmartRooms: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M9 7V4" /><path d="M12 7V4" /><path d="M15 7V4" />
      <path d="M9 20v-3" /><path d="M12 20v-3" /><path d="M15 20v-3" />
      <path d="M7 9H4" /><path d="M7 12H4" /><path d="M7 15H4" />
      <path d="M20 9h-3" /><path d="M20 12h-3" /><path d="M20 15h-3" />
    </svg>
  ),
  Planning: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="7" y1="14" x2="13" y2="14" />
      <line x1="7" y1="18" x2="11" y2="18" />
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

const BillingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M7 15h2" />
    <path d="M12 15h5" />
  </svg>
);

const navigationItems = [
  { to: "/dashboard", label: "Dashboard", Icon: Icons.Dashboard, end: true, permissions: [["dashboard", "view"]] },
  { to: "/clients", label: "Clients", Icon: Icons.Clients, permissions: [["clients", "view"]] },
  { to: "/rooms", label: "Chambres", Icon: Icons.Rooms, permissions: [["rooms", "view"], ["operations", "view"]] },
  { to: "/smart-rooms", label: "Chambres intelligentes", Icon: Icons.SmartRooms, permissions: [["rooms", "view"], ["operations", "view"]] },
  { to: "/exploitation", label: "Exploitation", Icon: Icons.Exploitation, permissions: [["operations", "view"]] },
  { to: "/day-use", label: "Day Use", Icon: Icons.Operations, permissions: [["operations", "view"]] },
  { to: "/operations", label: "Operations", Icon: Icons.Operations, end: true, badge: "·", permissions: [["operations", "view"]] },
  { to: "/operations/all", label: "Toutes operations", Icon: Icons.Operations, permissions: [["operations", "view"]] },
  { to: "/operations/bookings", label: "Reservations", Icon: Icons.Planning, permissions: [["operations", "view"]] },
  { to: "/reservation-planning", label: "Planning réservations", Icon: Icons.Planning, permissions: [["operations", "view"]] },
  { to: "/billing", label: "Facturation", Icon: BillingIcon, permissions: [["billing", "view"]] },
  { to: "/payments", label: "Paiements", Icon: Icons.CreditCard, permissions: [["payments", "view"]] },
  { to: "/pos-restaurant/dashboard", label: "POS Restaurant", Icon: Icons.Exploitation, permissions: [] },
  { to: "/reports", label: "Rapports", Icon: Icons.Reports, permissions: [["reports", "view"]] },
  { to: "/history/activity-logs", label: "Journal d'activite", Icon: Icons.History, permissions: [["history", "view"]] },
  { to: "/account/security", label: "Securite du compte", Icon: Icons.Shield, permissions: [] },
  { to: "/users", label: "Utilisateurs", Icon: Icons.Users, permissions: [["users", "view"]] },
  { to: "/settings", label: "Parametres", Icon: Icons.Settings, permissions: [["settings", "view"]] },
];

const platformNavigationItems = [
  { to: "/platform", label: "Vue plateforme", Icon: Icons.Shield, end: true, permissions: [["platform_security", "view"]] },
  { to: "/platform/organizations", label: "Clients SaaS", Icon: Icons.Building, permissions: [["platform_organizations", "view"]] },
  { to: "/platform/hotels", label: "Hotels", Icon: Icons.Rooms, permissions: [["platform_hotels", "view"]] },
  { to: "/platform/modules", label: "Modules", Icon: Icons.Operations, permissions: [["platform_modules", "view"]] },
  { to: "/platform/licenses", label: "Licences", Icon: Icons.CreditCard, permissions: [["platform_licenses", "view"]] },
  { to: "/platform/subscriptions", label: "Abonnements", Icon: Icons.CreditCard, permissions: [["platform_subscriptions", "view"]] },
  { to: "/platform/users", label: "Utilisateurs & acces POS", Icon: Icons.Users, permissions: [["platform_users", "view"]] },
  { to: "/platform/security", label: "Securite", Icon: Icons.Shield, permissions: [["platform_security", "view"]] },
  { to: "/account/security", label: "Mon compte", Icon: Icons.Shield, permissions: [] },
];

const superRootNavigationItems = [
  { to: "/super-root/dashboard", label: "Vue systeme", Icon: Icons.Shield, end: true, permissions: [["platform_security", "view"]] },
  { to: "/super-root/platforms", label: "Plateformes", Icon: Icons.Shield, permissions: [["platform_security", "view"]] },
  { to: "/super-root/organizations", label: "Organisations", Icon: Icons.Building, permissions: [["platform_organizations", "view"]] },
  { to: "/super-root/hotels", label: "Hotels", Icon: Icons.Rooms, permissions: [["platform_hotels", "view"]] },
  { to: "/super-root/users", label: "Utilisateurs", Icon: Icons.Users, permissions: [["platform_users", "view"]] },
  { to: "/super-root/roles-permissions", label: "Roles & permissions", Icon: Icons.Users, permissions: [["platform_users", "view"]] },
  { to: "/super-root/licenses", label: "Licences", Icon: Icons.CreditCard, permissions: [["platform_licenses", "view"]] },
  { to: "/super-root/modules", label: "Modules", Icon: Icons.Operations, permissions: [["platform_modules", "view"]] },
  { to: "/super-root/audit-logs", label: "Audit logs", Icon: Icons.History, permissions: [["platform_security", "view"]] },
  { to: "/super-root/monitoring", label: "Monitoring", Icon: Icons.Reports, permissions: [["platform_security", "view"]] },
  { to: "/super-root/infrastructure", label: "Infrastructure", Icon: Icons.Settings, permissions: [["platform_security", "view"]] },
  { to: "/super-root/notifications", label: "Notifications", Icon: Icons.History, permissions: [["platform_security", "view"]] },
  { to: "/super-root/ai-automation", label: "AI & Automation", Icon: Icons.Operations, permissions: [["platform_security", "view"]] },
  { to: "/super-root/security", label: "Securite", Icon: Icons.Shield, permissions: [["platform_security", "view"]] },
  { to: "/super-root/developer-center", label: "Developer Center", Icon: Icons.Settings, permissions: [["platform_security", "view"]] },
  { to: "/super-root/settings", label: "Parametres systeme", Icon: Icons.Settings, permissions: [["platform_security", "view"]] },
  { to: "/super-root/maintenance", label: "Maintenance", Icon: Icons.Settings, permissions: [["platform_security", "view"]] },
  { to: "/super-root/backups", label: "Backups", Icon: Icons.CreditCard, permissions: [["platform_security", "view"]] },
  { to: "/account/security", label: "Mon compte", Icon: Icons.Shield, permissions: [] },
];

function NavWithPill({ items, isDrawer, onClose, ariaLabel }) {
  const location = useLocation();
  const navRef = useRef(null);
  const isFirst = useRef(true);
  const [pill, setPill] = useState({ top: 0, height: 0, opacity: 0, instant: true });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector(".nav-link.active");
    if (!active) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = active.getBoundingClientRect();
    const top = Math.round(linkRect.top - navRect.top);
    const height = Math.round(linkRect.height);

    if (isFirst.current) {
      isFirst.current = false;
      setPill({ top, height, opacity: 1, instant: true });
      requestAnimationFrame(() => setPill((p) => ({ ...p, instant: false })));
    } else {
      setPill({ top, height, opacity: 1, instant: false });
    }
  }, [location.pathname]);

  return (
    <nav ref={navRef} className="nav-list" aria-label={ariaLabel}>
      <span
        className="nav-active-pill"
        style={{
          top: pill.top,
          height: pill.height,
          opacity: pill.opacity,
          transition: pill.instant ? "none" : undefined,
        }}
        aria-hidden="true"
      />
      {items.map(({ to, label, Icon, end, badge }) => (
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
  );
}

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

export function Sidebar({ user, onLogout, isDrawer = false, onClose }) {
  const hotelName = user?.hotel_name || import.meta.env.VITE_HOTEL_NAME || "Hotel";
  const workspaceName = user?.organization_name || hotelName;
  const currentHotel = {
    name: hotelName,
    logo_url: user?.hotel_logo_url || user?.hotel?.logo_url || "",
    status: user?.hotel_status || user?.hotel?.status || "active",
  };
  const currentOrganization = {
    name: workspaceName,
    logo_url: user?.organization_logo_url || user?.organization?.logo_url || "",
    status: user?.organization_status || user?.organization?.status || "active",
  };
  const userIsSuperRoot = hasHierarchyAccess(user, "super-root");
  const userIsPlatformAdmin = hasHierarchyAccess(user, "platform-admin") && !userIsSuperRoot;
  const visibleNavigationItems = userIsPlatformAdmin || userIsSuperRoot
    ? []
    : navigationItems.filter((item) =>
        item.permissions.length === 0 || item.permissions.some(([module, action]) => hasPermission(user, module, action)),
      );
  const visiblePlatformNavigationItems = userIsPlatformAdmin
    ? platformNavigationItems.filter((item) =>
        item.permissions.length === 0 || item.permissions.some(([module, action]) => hasPermission(user, module, action)),
      )
    : [];
  const visibleSuperRootNavigationItems = userIsSuperRoot
    ? superRootNavigationItems.filter((item) =>
        item.permissions.length === 0 || item.permissions.some(([module, action]) => hasPermission(user, module, action)),
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

            {!userIsPlatformAdmin && !userIsSuperRoot ? (
              <HotelBadge
                hotel={currentHotel}
                organization={currentOrganization}
              />
            ) : null}
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

        {visibleNavigationItems.length ? (
          <div className="sidebar-nav-region">
            <span className="nav-section-label">Navigation</span>
            <NavWithPill
              items={visibleNavigationItems}
              isDrawer={isDrawer}
              onClose={onClose}
              ariaLabel="Navigation principale"
            />
          </div>
        ) : null}

        {visibleSuperRootNavigationItems.length ? (
          <div className="sidebar-nav-region">
            <span className="nav-section-label">Super Root</span>
            <NavWithPill
              items={visibleSuperRootNavigationItems}
              isDrawer={isDrawer}
              onClose={onClose}
              ariaLabel="Navigation super root"
            />
          </div>
        ) : null}

        {visiblePlatformNavigationItems.length ? (
          <div className="sidebar-nav-region">
            <span className="nav-section-label">Plateforme</span>
            <NavWithPill
              items={visiblePlatformNavigationItems}
              isDrawer={isDrawer}
              onClose={onClose}
              ariaLabel="Navigation plateforme"
            />
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
