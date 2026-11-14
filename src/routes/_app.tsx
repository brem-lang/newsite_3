import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import AccountSuspended from "@/components/AccountSuspended";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (authError?.type === "suspended") return <AccountSuspended />;
  if (authError?.type === "user_not_registered") return <UserNotRegisteredError />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Layout />;
}
