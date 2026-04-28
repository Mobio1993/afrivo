import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

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

export function RequirePlatformAdmin({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isPlatformAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
