import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import "./SuperRootLayout.css";

const NAV_ITEMS = [
  { to: "/super-root/dashboard", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
  { to: "/super-root/platforms", label: "Plateformes", icon: "ti-server" },
  { to: "/super-root/organizations", label: "Organisations", icon: "ti-building-community" },
  { to: "/super-root/hotels", label: "Hotels", icon: "ti-building-skyscraper" },
  { to: "/super-root/users", label: "Utilisateurs", icon: "ti-users" },
  { to: "/super-root/roles-permissions", label: "Roles & permissions", icon: "ti-shield-check" },
  { to: "/super-root/licenses", label: "Licences", icon: "ti-certificate" },
  { to: "/super-root/modules", label: "Modules", icon: "ti-apps" },
  { to: "/super-root/audit-logs", label: "Audit logs", icon: "ti-clipboard-list" },
  { to: "/super-root/monitoring", label: "Monitoring", icon: "ti-activity" },
  { to: "/super-root/infrastructure", label: "Infrastructure", icon: "ti-cloud-cog" },
  { to: "/super-root/notifications", label: "Notifications", icon: "ti-bell" },
  { to: "/super-root/ai-automation", label: "AI & Automation", icon: "ti-robot" },
  { to: "/super-root/security", label: "Securite", icon: "ti-alert-triangle" },
  { to: "/super-root/developer-center", label: "Developer Center", icon: "ti-code" },
  { to: "/super-root/settings", label: "Parametres", icon: "ti-settings" },
  { to: "/super-root/maintenance", label: "Maintenance", icon: "ti-tool" },
  { to: "/super-root/backups", label: "Backups", icon: "ti-database-export" },
];

function buildInitials(user) {
  const first = user?.first_name?.[0] || "";
  const last = user?.last_name?.[0] || "";
  return (first + last).toUpperCase() || (user?.username?.[0] || "S").toUpperCase();
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function SuperRootLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.warn("Erreur logout super root ignoree:", error);
    } finally {
      navigate("/super-root/login", { replace: true });
    }
  }

  return (
    <div className="sr-layout">
      <aside className="sr-sidebar">
        <div className="sr-brand">
          <div className="sr-brand-mark">SR</div>
          <div>
            <div className="sr-brand-name">AFRIVO</div>
            <div className="sr-brand-sub">Super Root Console</div>
          </div>
        </div>

        <nav className="sr-nav" aria-label="Navigation Super Root">
          <div className="sr-nav-label">Systeme</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sr-nav-link ${isActive ? "active" : ""}`}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sr-sidebar-footer">
          <div className="sr-user-card">
            <div className="sr-user-avatar" aria-hidden="true">{buildInitials(user)}</div>
            <div className="sr-user-info">
              <strong>{user?.first_name || user?.username || "Super Root"}</strong>
              <span>{user?.role || "super_root"}</span>
            </div>
          </div>
          <button type="button" className="sr-logout" onClick={handleLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            Se deconnecter
          </button>
        </div>
      </aside>

      <div className="sr-main">
        <header className="sr-topbar">
          <div>
            <div className="sr-eyebrow">
              <span className="sr-eyebrow-dot" aria-hidden="true" />
              SUPER ROOT
            </div>
            <h1 className="sr-title">Console systeme AFRIVO</h1>
            <p className="sr-subtitle">
              Supervision globale, securite, plateformes et maintenance.
            </p>
          </div>

          <div className="sr-topbar-actions">
            <span className="sr-date-chip">
              <i className="ti ti-calendar" aria-hidden="true" />
              {formatDate(new Date())}
            </span>
            <button type="button" className="sr-logout sr-logout-top" onClick={handleLogout}>
              <i className="ti ti-logout" aria-hidden="true" />
              Logout
            </button>
          </div>
        </header>

        <main className="sr-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
