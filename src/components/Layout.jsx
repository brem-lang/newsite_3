import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Gavel, Wallet as WalletIcon, LogOut, CircleUserRound, Home as HomeIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useWallet } from "@/lib/useWallet";
import { useSignupGeo } from "@/lib/useSignupGeo";
import { useBidAlerts } from "@/lib/useBidAlerts";

import NotificationBell from "@/components/NotificationBell";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Layout() {
  const { t, dir } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  // The identity is already resolved by AuthContext; re-fetching it here
  // duplicated a round-trip on every navigation.
  const { user } = useAuth();
  const { balance, refresh } = useWallet(user?.id);
  useSignupGeo(user);
  useBidAlerts(user);


  const handleLogout = async () => {
    await base44.auth.logout("/");
  };

  const navItems = [
    { to: "/home", label: t.nav.home, icon: HomeIcon },
    { to: "/auctions", label: t.nav.auctions, icon: Gavel },
    { to: "/account", label: t.nav.account, icon: CircleUserRound },
    { to: "/wallet", label: t.nav.wallet, icon: WalletIcon }
  ];

  // The home screen ships its own native app bar on phones (screen 04).
  const bareMobile = location.pathname === "/home" || location.pathname === "/account" || location.pathname.startsWith("/auction/");

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground" dir={dir}>
      <header className={cn("native-chrome sticky top-0 z-40 border-b pt-safe", bareMobile && "hidden sm:block")}>
        <div className="max-w-6xl mx-auto px-gutter h-16 flex items-center justify-between gap-2 sm:gap-4">

          <Link to="/home" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="w-9 h-9 shrink-0 rounded-lg border border-primary/50 bg-primary text-primary-foreground grid place-items-center shadow-[0_0_22px_hsl(var(--primary)/0.2)]">
              <Gavel className="w-5 h-5" />
            </div>
            <span className="truncate font-heading font-semibold text-base sm:text-lg tracking-tight">{t.brand}</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-secondary text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-accent hover:bg-secondary/60"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/70">
              <WalletIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t.common.currency}{balance.toFixed(2)}</span>
            </div>
            <NotificationBell />
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={handleLogout} title={t.common.logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

      </header>

      <main
        key={location.pathname}
        className={cn(
          "sm:page-transition max-w-6xl mx-auto sm:py-8 sm:px-gutter",
          bareMobile ? "py-0 px-0" : "py-6 px-gutter"
        )}
        style={{ paddingBottom: bareMobile ? undefined : "calc(var(--app-tabbar-h) + 1.5rem)" }}
      >

        <Outlet context={{ user, walletBalance: balance, refreshWallet: refresh }} />
      </main>
      <BottomNav />
    </div>
  );
}