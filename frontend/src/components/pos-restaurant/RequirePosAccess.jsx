import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

const POS_ROLES = new Set([
  "manager_restaurant",
  "caissier",
  "serveur",
  "cuisinier",
  "barman",
  "comptable",
  "admin",
  "administrateur",
  "restaurant",
  "cashier",
  "manager",
]);

export function hasPosAccess(user) {
  const role = String(user?.profile?.role || user?.role_code || user?.role || "").toLowerCase();
  return Boolean(user?.is_staff || user?.is_superuser || user?.is_platform_admin || POS_ROLES.has(role));
}

export default function RequirePosAccess({ children }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="pos-loading">Verification de la session POS...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/pos-restaurant/login" replace state={{ from: location }} />;
  }

  if (!hasPosAccess(user)) return <Navigate to="/dashboard" replace />;
  return children;
}
