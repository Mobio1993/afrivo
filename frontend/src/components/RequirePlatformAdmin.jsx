import { Navigate, useLocation } from "react-router-dom";

import { usePermissions } from "../app/providers/PermissionProvider";

export function RequirePlatformAdmin({ children }) {
  const { hasHierarchyAccess, isAuthenticated, isLoading, user } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasHierarchyAccess("platform-admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
