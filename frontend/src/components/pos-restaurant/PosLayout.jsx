import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import "../../styles/pos-restaurant.css";
import RequirePosAccess from "./RequirePosAccess";

const NAV = [
  { to: "/pos-restaurant/dashboard", label: "Dashboard" },
  { to: "/pos-restaurant/tables", label: "Tables" },
  { to: "/pos-restaurant/orders", label: "Commandes" },
  { to: "/pos-restaurant/menu", label: "Menu" },
  { to: "/pos-restaurant/kitchen", label: "Cuisine" },
  { to: "/pos-restaurant/billing", label: "Facturation" },
  { to: "/pos-restaurant/payments", label: "Paiements" },
  { to: "/pos-restaurant/reports", label: "Rapports" },
  { to: "/pos-restaurant/servers", label: "Serveurs" },
  { to: "/pos-restaurant/server-performance", label: "Performance" },
  { to: "/pos-restaurant/server-ranking", label: "Classement" },
  { to: "/pos-restaurant/settings", label: "Parametres" },
];

export default function PosLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/pos-restaurant/login", { replace: true });
  }

  return (
    <RequirePosAccess>
      <div className="pos-layout">
        <nav className="pos-nav" aria-label="POS Restaurant">
          <div className="pos-nav-brand">
            <span className="pos-nav-mark">POS</span>
            <span>Restaurant</span>
          </div>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `pos-nav-item ${isActive ? "active" : ""}`}>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="pos-main">
          <header className="pos-topbar">
            <div>
              <span className="pos-topbar-label">Espace POS autonome</span>
              <strong>{user?.hotel_name || user?.organization_name || "Restaurant"}</strong>
            </div>
            <div className="pos-topbar-actions">
              <Link className="pos-btn" to="/dashboard">
                Retour hotel
              </Link>
              <button className="pos-btn pos-btn-danger" type="button" onClick={handleLogout}>
                Deconnexion
              </button>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </RequirePosAccess>
  );
}
