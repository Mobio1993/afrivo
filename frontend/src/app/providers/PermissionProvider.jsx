import { createContext, useContext, useMemo } from "react";

import { useAuth } from "../../auth/AuthContext";
import {
  canPerformAction,
  canWriteModule,
  getUserPermissions,
  hasHierarchyAccess,
  hasPermission,
  isHotelAdminUser,
  isPlatformAdminUser,
  isSuperRootUser,
} from "../../auth/permissions";

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    permissions: getUserPermissions(user),
    hasPermission: (module, action = "view") => hasPermission(user, module, action),
    hasHierarchyAccess: (hierarchy) => hasHierarchyAccess(user, hierarchy),
    canWriteModule: (module) => canWriteModule(user, module),
    canPerformAction: (actionCode, options) => canPerformAction(user, actionCode, options),
    isSuperRoot: isSuperRootUser(user),
    isPlatformAdmin: isPlatformAdminUser(user),
    isHotelAdmin: isHotelAdminUser(user),
  }), [isAuthenticated, isLoading, user]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used inside PermissionProvider");
  }
  return context;
}
