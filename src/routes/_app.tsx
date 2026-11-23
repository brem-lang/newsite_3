import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import AccountSuspended from "@/components/AccountSuspended";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";

export const Route = createFileRoute("/_app")({
  ssr: false,
  // Runs before any child loader: signed-out visitors are sent to /login (and
  // come back here afterwards), so no loader ever caches a signed-out result.
  // getSession() reads the stored session; it does not hit the network.
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      throw redirect({ to: "/login", search: { returnTo: location.href }, replace: true });
    }
    return { userId: session.user.id };
  },
  pendingComponent: AppShellSkeleton,
  component: AppLayout,
});

function AppLayout() {
  // The session exists (beforeLoad); the profile check decides suspended /
  // not-registered accounts and supplies `user` to the pages.
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  if (isLoadingAuth || !authChecked) return <AppShellSkeleton />;
  if (authError?.type === "suspended") return <AccountSuspended />;
  if (authError?.type === "user_not_registered") return <UserNotRegisteredError />;
  // Session ended while on the page (signed out in another tab, expired):
  // the sign-out handler reloads to "/", so render nothing meanwhile.
  if (!isAuthenticated) return <AppShellSkeleton />;

  return <Layout />;
}
