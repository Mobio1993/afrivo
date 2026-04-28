import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { canAccessPath, resolveDeniedRedirect } from "../auth/routePermissions";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={resolveDeniedRedirect(user, location.pathname)} replace />;
  }

  return <Outlet />;
}
