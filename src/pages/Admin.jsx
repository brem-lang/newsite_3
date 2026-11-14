import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { LogOut, Menu, Search, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GROUPS, SECTIONS, SECTION_IDS, DEFAULT_SECTION, groupOfSection, sectionLabel } from "@/lib/adminNav";

const BASE_PATH = "/admin";

/** Every panel is code-split: opening /admin no longer downloads all 29 screens. */
const PANELS = {
  analytics: lazy(() => import("@/components/admin/AdminAnalytics")),
  live: lazy(() => import("@/components/admin/AdminLive")),
  auctions: lazy(() => import("@/components/admin/AdminAuctions")),
  results: lazy(() => import("@/components/admin/AdminResults")),
  fulfilment: lazy(() => import("@/components/admin/AdminFulfilment")),
  categories: lazy(() => import("@/components/admin/AdminCategories")),
  brands: lazy(() => import("@/components/admin/AdminBrands")),
  winnerpayments: lazy(() => import("@/components/admin/AdminWinnerPayments")),
  auctionpl: lazy(() => import("@/components/admin/AdminAuctionPL")),
  revenue: lazy(() => import("@/components/admin/AdminRevenue")),
  payments: lazy(() => import("@/components/admin/AdminPayments")),
  payment_methods: lazy(() => import("@/components/admin/AdminPaymentMethods")),
  refunds: lazy(() => import("@/components/admin/AdminRefunds")),
  coupons: lazy(() => import("@/components/admin/AdminCoupons")),
  users: lazy(() => import("@/components/admin/AdminUsers")),
  participants: lazy(() => import("@/components/admin/AdminParticipants")),
  verification: lazy(() => import("@/components/admin/AdminVerification")),
  roles: lazy(() => import("@/components/admin/AdminRoles")),
  hero: lazy(() => import("@/components/admin/AdminHero")),
  content: lazy(() => import("@/components/admin/AdminContent")),
  pages: lazy(() => import("@/components/admin/AdminPages")),
  design: lazy(() => import("@/components/admin/AdminDesign")),
  broadcast: lazy(() => import("@/components/admin/AdminBroadcast")),
  notifications: lazy(() => import("@/components/admin/AdminNotifications")),
  templates: lazy(() => import("@/components/admin/AdminTemplates")),
  support: lazy(() => import("@/components/admin/AdminSupport")),
  system: lazy(() => import("@/components/admin/AdminSystem")),
  bidmonitor: lazy(() => import("@/components/admin/AdminBidMonitor")),
  activitylog: lazy(() => import("@/components/admin/AdminActivityLogs")),
  apikeys: lazy(() => import("@/components/admin/AdminApiKeys")),
  reports: lazy(() => import("@/components/admin/AdminReports")),
  testmode: lazy(() => import("@/components/admin/AdminTestMode")),
  settings: lazy(() => import("@/components/admin/AdminSettings")),
  shipping: lazy(() => import("@/components/admin/AdminShipping")),
};

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/** Admin section -> database capability that unlocks it. */
const SECTION_CAPABILITY = {
  analytics: "dashboard.view",
  live: "dashboard.view",
  bidmonitor: "dashboard.view",
  auctions: "auctions.manage",
  results: "auctions.manage",
  categories: "auctions.manage",
  brands: "auctions.manage",
  testmode: "auctions.testmode",
  revenue: "finance.view",
  auctionpl: "finance.view",
  winnerpayments: "winners.manage",
  payments: "payments.approve",
  payment_methods: "payments.approve",
  refunds: "refunds.resolve",
  coupons: "finance.view",
  users: "users.edit",
  participants: "users.view",
  verification: "users.verify",
  roles: "roles.manage",
  fulfilment: "fulfilment.manage",
  shipping: "fulfilment.manage",
  broadcast: "messaging.send",
  notifications: "messaging.send",
  templates: "messaging.send",
  support: "support.manage",
  reports: "support.manage",
  hero: "system.manage",
  content: "system.manage",
  pages: "system.manage",
  design: "system.manage",
  settings: "system.manage",
  system: "system.manage",
  apikeys: "system.manage",
  activitylog: "system.manage",
};

export default function Admin({ caps: capsProp = null }) {
  const { t, dir } = useI18n();
  const { section } = useParams();
  const navigate = useNavigate();
  
  const [caps, setCaps] = useState(capsProp);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (capsProp) {
      setCaps(capsProp);
      return;
    }
    base44.functions
      .invoke("myAdminCapabilities", {})
      .then((r) => setCaps(r?.data?.error ? null : r?.data || null))
      .catch(() => {});
  }, [capsProp]);

  // The database role hierarchy decides which admin sections are reachable.
  // Super admins hold every capability, so nothing is filtered for them.
  const allowed = useMemo(() => {
    if (!caps || caps.is_super) return null;
    const held = new Set(caps.capabilities || []);
    const keys = SECTION_IDS.filter((id) => {
      const need = SECTION_CAPABILITY[id];
      return !need || held.has(need);
    });
    return keys.length && keys.length < SECTION_IDS.length ? new Set(keys) : null;
  }, [caps]);

  const groups = useMemo(() => {
    if (!allowed) return GROUPS;
    return GROUPS
      .map((g) => ({ ...g, items: g.items.filter((id) => allowed.has(id)) }))
      .filter((g) => g.items.length > 0);
  }, [allowed]);


  const logout = async () => {
    await base44.auth.logout();
    navigate("/");
  };

  if (!caps) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }


  const firstAllowed = groups[0]?.items?.[0] || DEFAULT_SECTION;
  const requested = section && SECTION_IDS.includes(section) ? section : DEFAULT_SECTION;
  const active = !allowed || allowed.has(requested) ? requested : firstAllowed;
  const group = groups.find((g) => g.items.includes(active)) || groupOfSection(active);
  const Panel = PANELS[active];

  return (
    <div className="min-h-screen flex overflow-x-hidden bg-background" dir={dir}>
      <AdminSidebar
        groups={groups}
        basePath={BASE_PATH}
        active={active}
        activeGroup={group.id}
        onLogout={logout}
        onSearch={() => setPalette(true)}
        className="hidden lg:flex"
      />

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="p-0 w-72">
          <AdminSidebar
            groups={groups}
            basePath={BASE_PATH}
            active={active}
            activeGroup={group.id}
            onLogout={logout}
            onSearch={() => { setDrawer(false); setPalette(true); }}
            onClose={() => setDrawer(false)}
            className="w-full border-e-0"
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="native-chrome sticky top-0 z-30 border-b">
          <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer(true)} aria-label={t.admin.panelTitle}>
                <Menu className="w-5 h-5" />
              </Button>
              <nav aria-label="breadcrumb" className="flex items-center gap-1.5 min-w-0 text-sm">
                <span className="text-muted-foreground hidden sm:inline truncate">{group.label(t)}</span>
                <ChevronRight className={cn("w-4 h-4 text-muted-foreground/60 hidden sm:inline", dir === "rtl" && "rotate-180")} />
                <span className="font-display font-semibold text-base sm:text-lg truncate">{sectionLabel(t, active)}</span>
              </nav>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setPalette(true)} aria-label={t.admin.searchPlaceholder || "Search"}>
                <Search className="w-4 h-4" />
              </Button>
              <LanguageSwitcher />
              <Link to="/" className="hidden sm:block"><Button variant="outline" size="sm">{t.admin.backToSite}</Button></Link>
              <Button variant="ghost" size="icon" onClick={logout} title={t.common.logout}><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>

          {group.items.length > 1 && (
            <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-2 py-1.5">
              {group.items.map((id) => {
                const Icon = SECTIONS[id]?.icon;
                return (
                  <Link
                    key={id}
                    to={`${BASE_PATH}/${id}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                        active === id ? "bg-accent/10 text-accent ring-1 ring-accent/30" : "text-muted-foreground hover:bg-secondary/60 hover:text-accent"
                    )}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {sectionLabel(t, id)}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<PanelSkeleton />}>
              {Panel ? <Panel /> : null}
            </Suspense>
          </div>
        </main>
      </div>

      <AdminCommandPalette open={palette} onOpenChange={setPalette} basePath={BASE_PATH} />
    </div>
  );
}
