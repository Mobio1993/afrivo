import { createContext, useContext, useEffect, useState } from "react";

import { ensureCsrfCookie, fetchJson, postJson } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshSession() {
    try {
      const payload = await fetchJson("/api/auth/session/");
      setUser(payload.user);
      setIsAuthenticated(true);
      return payload.user;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }

  useEffect(() => {
    Promise.all([ensureCsrfCookie(), refreshSession()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  async function login(credentials) {
    await ensureCsrfCookie();
    const payload = await postJson("/api/auth/login/", credentials);
    setUser(payload.user);
    setIsAuthenticated(true);
    return payload.user;
  }

  async function logout() {
    try {
      await ensureCsrfCookie();
      await postJson("/api/auth/logout/", {});
    } catch (error) {
      console.warn("Erreur API logout:", error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
