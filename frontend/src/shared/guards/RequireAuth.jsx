import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

export default function RequireAuth({ children, redirectTo = "/login" }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children || <Outlet />;
}
