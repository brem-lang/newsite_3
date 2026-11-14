import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";

/**
 * The admin area is separate from the customer site: it only looks at the
 * staff session (base44.adminAuth). Until a staff member signs in, /admin
 * shows the staff sign-in screen; the customer session is never consulted.
 */
export default function AdminGate() {
  const [caps, setCaps] = useState(null);
  const [checked, setChecked] = useState(false);

  const verify = useCallback(async () => {
    try {
      if (!base44.adminAuth.isAuthenticated()) {
        setCaps(null);
        return;
      }
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
    verify();
  }, [verify]);

  if (!checked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!caps) return <AdminLogin onVerified={setCaps} />;
  return <Admin caps={caps} onSignedOut={() => setCaps(null)} />;
}
