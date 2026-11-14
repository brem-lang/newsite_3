import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async (opts = {}) => {
    // Only the very first check shows the full-screen spinner. Later refreshes
    // (session events, profile updates) used to flip loading back on, which
    // unmounted the current page and made it re-fetch everything from scratch.
    const silent = opts.silent === true;
    if (!silent) setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.paused) {
        await base44.auth.logout();
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: "suspended", message: "Account suspended" });
      } else {
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    } finally {
      if (!silent) setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);


  const loadPublicSettings = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    try {
      const settings = await base44.entities.SiteSettings.list();
      setAppPublicSettings({ id: "site", public_settings: settings?.[0] ?? {} });
    } catch {
      setAppPublicSettings({ id: "site", public_settings: {} });
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, []);

  // Settings and the session check are independent, so they run in parallel;
  // gating auth behind settings made every page wait on two serial round-trips.
  const checkAppState = useCallback(async () => {
    await Promise.all([loadPublicSettings(), checkUserAuth()]);
  }, [loadPublicSettings, checkUserAuth]);

  useEffect(() => {
    checkAppState();
    const unsubscribe = base44.auth.onAuthStateChange((event) => {
      // A sign-out must tear the app down; other events refresh in the
      // background without blanking the current page.
      checkUserAuth({ silent: event !== "SIGNED_OUT" });
    });
    return unsubscribe;
  }, [checkAppState, checkUserAuth]);


  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await base44.auth.logout(shouldRedirect ? "/" : undefined);
  };

  const navigateToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
