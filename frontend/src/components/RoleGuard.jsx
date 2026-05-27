import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { UnauthorizedState } from "./UnauthorizedState";

function normalizeRole(value) {
  return String(value || "").toLowerCase();
}

function userHasRole(user, allowedRoles) {
  if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }

  const roleSet = new Set(allowedRoles.map(normalizeRole));
  const candidates = [
    user.role_code,
    user.role,
    user.platform_role,
    user.is_super_root ? "super_root" : "",
  ].map(normalizeRole);

  return candidates.some((role) => roleSet.has(role));
}

export function RoleGuard({
  roles,
  children,
  redirectTo = "",
  fallback,
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!userHasRole(user, roles)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return fallback || <UnauthorizedState />;
  }

  return children;
}
