import { Navigate, Outlet, useLocation } from "react-router-dom";

import { usePermissions } from "../../app/providers/PermissionProvider";

export default function RequireSuperRoot({ children, redirectTo = "/login" }) {
  const { isAuthenticated, isLoading, isSuperRoot } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (!isSuperRoot) {
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}
