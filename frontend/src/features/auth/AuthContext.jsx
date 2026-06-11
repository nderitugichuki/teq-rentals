import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, login as loginRequest } from "../../api/auth.js";
import { authStorage } from "./authStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(authStorage.getAccessToken()));

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!authStorage.getAccessToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (isMounted) setUser(currentUser);
      } catch {
        authStorage.clear();
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(email, password) {
    const tokens = await loginRequest(email, password);
    authStorage.setTokens(tokens);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }

  function logout() {
    authStorage.clear();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

