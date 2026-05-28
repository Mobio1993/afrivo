import { createContext, useContext, useEffect, useState } from "react";

import { ensureCsrfCookie, fetchJson, postJson } from "../api/client";

const AuthContext = createContext(null);
const PLATFORM_ORGANIZATIONS_UPDATED_EVENT = "afrivo:platform-organizations-updated";

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
    let mounted = true;

    ensureCsrfCookie()
      .catch(() => null)
      .then(() => refreshSession())
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
      setIsAuthenticated(false);
    }

    window.addEventListener("afrivo:session-expired", handleSessionExpired);
    return () => window.removeEventListener("afrivo:session-expired", handleSessionExpired);
  }, []);

  useEffect(() => {
    function handlePlatformOrganizationsUpdated() {
      refreshSession();
    }

    window.addEventListener(PLATFORM_ORGANIZATIONS_UPDATED_EVENT, handlePlatformOrganizationsUpdated);
    return () => {
      window.removeEventListener(PLATFORM_ORGANIZATIONS_UPDATED_EVENT, handlePlatformOrganizationsUpdated);
    };
  }, []);

  async function login(credentials) {
    await ensureCsrfCookie();
    const payload = await postJson("/api/auth/login/", credentials);
    if (payload.two_factor_required) {
      setUser(null);
      setIsAuthenticated(false);
      return payload;
    }
    setUser(payload.user);
    setIsAuthenticated(true);
    return payload;
  }

  async function completeTwoFactorLogin({ challengeId, code }) {
    await ensureCsrfCookie();
    const payload = await postJson("/api/auth/2fa/login/verify/", { challenge_id: challengeId, code });
    setUser(payload.user);
    setIsAuthenticated(true);
    return payload;
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
        completeTwoFactorLogin,
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
