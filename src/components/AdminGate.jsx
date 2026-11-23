import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import { adminKeys } from "@/lib/queries/keys";
import { clearAdminCache, useAdminCapabilities } from "@/lib/queries/admin";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";

/**
 * The admin area is separate from the customer site: it only looks at the
 * staff session (base44.adminAuth). Until a staff member signs in, /admin
 * shows the staff sign-in screen; the customer session is never consulted.
 *
 * The capability check is a cached query (warmed by the route loader), so
 * moving between admin sections never re-checks it.
 */
export default function AdminGate() {
  const qc = useQueryClient();
  const { data: caps, isPending } = useAdminCapabilities();

  // Login form or dashboard: unknown yet, so no layout-shaped skeleton.
  if (isPending) return <AppShellSkeleton />;
  if (!caps) return <AdminLogin onVerified={(next) => qc.setQueryData(adminKeys.capabilities(), next)} />;
  return <Admin caps={caps} onSignedOut={() => clearAdminCache(qc)} />;
}
