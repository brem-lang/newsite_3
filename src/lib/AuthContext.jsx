import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { configKeys, adminKeys } from "@/lib/queries/keys";
import { useSiteSettings } from "@/lib/queries/config";

const AuthContext = createContext(undefined);

/** Cached data that belongs to one signed-in customer (config and staff data are kept). */
const isUserScoped = (query) => {
  const root = query.queryKey[0];
  return root !== configKeys.all[0] && root !== adminKeys.all[0] && root !== adminKeys.entities[0];
};

export const AuthProvider = ({ children }) => {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const lastUserId = useRef(undefined);

  // A different identity (sign-in, sign-out, account switch) must never see the
  // previous one's cached wallet, bids or auctions.
  const noteIdentity = useCallback(
    (id) => {
      if (lastUserId.current !== undefined && lastUserId.current !== id) {
        qc.removeQueries({ predicate: isUserScoped });
      }
      lastUserId.current = id;
    },
    [qc],
  );

  const checkUserAuth = useCallback(async (opts = {}) => {
    // Only the very first check shows the full-screen loading state. Later
    // refreshes (session events, profile updates) used to flip loading back on,
    // which unmounted the current page and made it re-fetch everything.
    const silent = opts.silent === true;
    if (!silent) setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.paused) {
        await base44.auth.logout();
        noteIdentity(null);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: "suspended", message: "Account suspended" });
      } else {
        noteIdentity(currentUser?.id ?? null);
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      }
    } catch {
      noteIdentity(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    } finally {
      if (!silent) setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [noteIdentity]);

  // Site settings come from the shared config query (also used by currency).
  const { data: settingsRows, isPending: isLoadingPublicSettings, isError: settingsFailed } = useSiteSettings();
  const appPublicSettings = useMemo(() => {
    if (isLoadingPublicSettings && !settingsFailed) return null;
    return { id: "site", public_settings: settingsRows?.[0] ?? {} };
  }, [settingsRows, isLoadingPublicSettings, settingsFailed]);

  const checkAppState = useCallback(async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: configKeys.settings() }), checkUserAuth()]);
  }, [qc, checkUserAuth]);

  useEffect(() => {
    checkUserAuth();
    const unsubscribe = base44.auth.onAuthStateChange((event) => {
      // A sign-out must tear the app down; other events refresh in the
      // background without blanking the current page.
      checkUserAuth({ silent: event !== "SIGNED_OUT" });
    });
    return unsubscribe;
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    noteIdentity(null);
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
