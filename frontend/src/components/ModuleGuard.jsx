import { usePermissions } from "../app/providers/PermissionProvider";
import { UnauthorizedState } from "./UnauthorizedState";

export function ModuleGuard({
  module,
  action = "view",
  children,
  fallback,
}) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return <div className="status-box">Verification de la session en cours...</div>;
  }

  if (!hasPermission(module, action)) {
    return fallback || (
      <UnauthorizedState
        title="Permission insuffisante"
        message="Cette action est reservee aux profils autorises par l'IAM AFRIVO."
      />
    );
  }

  return children;
}
