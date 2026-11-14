import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import AccountSuspended from "@/components/AccountSuspended";

/**
 * Nothing of the admin shell renders until the server confirms the signed-in
 * account really holds admin access. A plain member session sees the staff
 * sign-in screen instead of the sidebar.
 */
export default function AdminGate() {
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();
  const [caps, setCaps] = useState(null);
  const [checked, setChecked] = useState(false);

  const verify = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("myAdminCapabilities", {});
      const data = res?.data && !res.data.error ? res.data : null;
      setCaps(data?.is_admin ? data : null);
    } catch {
      setCaps(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!authChecked || isLoadingAuth) return;
    if (!isAuthenticated) {
      setCaps(null);
      setChecked(true);
      return;
    }
    setChecked(false);
    verify();
  }, [authChecked, isLoadingAuth, isAuthenticated, verify]);

  if (isLoadingAuth || !authChecked || !checked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (authError?.type === "suspended") return <AccountSuspended />;
  if (!caps) return <AdminLogin onVerified={setCaps} />;
  return <Admin caps={caps} />;
}
