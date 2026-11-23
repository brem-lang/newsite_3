import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, Gavel, CircleUserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Native tab bar. Each tab is a real destination (Home is its own route),
 * so the active state comes from the path — only the My Bids tab also
 * looks at the `tab` filter it carries.
 */
export default function BottomNav() {
  const { t } = useI18n();
  const location = useRouterState({ select: (s) => s.location });
  const nav = t.nav;

  const activeTab = location.search?.tab;
  const isAuctions = location.pathname === "/auctions";

  const tabs = [
    { id: "home", to: "/home", label: nav.home, icon: Home },
    { id: "auctions", to: "/auctions", search: {}, label: nav.auctions, icon: Search },
    { id: "wallet", to: "/wallet", label: nav.wallet, icon: Plus, center: true },
    { id: "board", to: "/auctions", search: { tab: "mine" }, label: nav.bidboard, icon: Gavel },
    { id: "profile", to: "/account", label: nav.profile, icon: CircleUserRound },
  ];

  const isActive = (id) => {
    if (id === "home") return location.pathname === "/home" || location.pathname === "/";
    if (id === "auctions") return isAuctions && activeTab !== "mine";
    if (id === "board") return isAuctions && activeTab === "mine";
    if (id === "wallet") return location.pathname === "/wallet";
    return location.pathname === "/account";
  };

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card/96 backdrop-blur-xl border-t border-border/80 flex px-safe pb-safe shadow-[0_-14px_34px_-22px_hsl(var(--accent)/0.65)]"
      style={{ height: "var(--app-tabbar-h)" }}>
      {tabs.map((tb) => {
        const active = isActive(tb.id);
        return (
          <Link
            key={tb.id}
            to={tb.to}
            search={tb.search}
            className={cn(
              "flex-1 tap-44 flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-colors relative active:scale-95",
               active ? "text-primary" : "text-muted-foreground",
              tb.center && "-translate-y-3"
            )}
          >
            {active && !tb.center && <span className="absolute top-0 h-[3px] w-8 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.8)]" />}
            <span className={cn("grid place-items-center", tb.center && "h-12 w-12 rounded-full gold-button ring-4 ring-background text-primary-foreground") }>
              <tb.icon className={cn("w-[22px] h-[22px] transition-transform duration-200", active && "scale-110")} />
            </span>
            {tb.label}
          </Link>
        );
      })}
    </nav>
  );
}
