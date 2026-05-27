import { AuthProvider as ExistingAuthProvider, useAuth } from "../../auth/AuthContext";

export function AuthProvider({ children }) {
  return <ExistingAuthProvider>{children}</ExistingAuthProvider>;
}

export { useAuth };
