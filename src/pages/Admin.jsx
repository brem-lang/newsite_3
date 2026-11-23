import React, { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";
import { LogOut, Menu, Search, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import AdminSystemEvents from "@/components/admin/AdminSystemEvents";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmProvider } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";
import { PANEL_IMPORTS, preloadPanel } from "@/lib/adminPanels";
import { GROUPS, SECTIONS, SECTION_IDS, DEFAULT_SECTION, groupOfSection, sectionLabel } from "@/lib/adminNav";

const BASE_PATH = "/admin";

const PANELS = Object.fromEntries(Object.entries(PANEL_IMPORTS).map(([id, load]) => [id, lazy(load)]));

// preloadPanel (on hover/focus/touch of a section link) and the route loader
// download a panel's code ahead of render; see src/lib/adminPanels.js.

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

export default function Admin({ caps: capsProp = null, onSignedOut }) {
  const { t, dir } = useI18n();
  // Both /admin and /admin/$section render this page.
  const { section } = useParams({ strict: false });
  const navigate = useNavigate();

  // Capabilities come from the cached query in AdminGate.
  const caps = capsProp;
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

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


  // Signs out of the staff session only; the customer site is unaffected.
  const logout = async () => {
    await base44.adminAuth.logout();
    navigate({ to: "/admin" });
    onSignedOut?.();
  };

  if (!caps) return <AppShellSkeleton />;


  const firstAllowed = groups[0]?.items?.[0] || DEFAULT_SECTION;
  const requested = section && SECTION_IDS.includes(section) ? section : DEFAULT_SECTION;
  const active = !allowed || allowed.has(requested) ? requested : firstAllowed;
  const group = groups.find((g) => g.items.includes(active)) || groupOfSection(active);
  const Panel = PANELS[active];

  // lg+: the shell is one window tall; only <main> scrolls (src/styles.css, .admin-main).
  return (
    <div className="min-h-screen flex overflow-x-hidden bg-background lg:h-dvh lg:overflow-hidden" dir={dir}>
      <AdminSidebar
        groups={groups}
        basePath={BASE_PATH}
        onPreload={preloadPanel}
        active={active}
        activeGroup={group.id}
        onLogout={logout}
        onSearch={() => setPalette(true)}
        className="hidden lg:flex"
      />

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} hideClose className="p-0 w-72">
          <SheetTitle className="sr-only">{t.admin.panelTitle}</SheetTitle>
          <SheetDescription className="sr-only">{t.admin.navDescription}</SheetDescription>
          <AdminSidebar
            groups={groups}
            basePath={BASE_PATH}
            onPreload={preloadPanel}
            active={active}
            activeGroup={group.id}
            onLogout={logout}
            onSearch={() => { setDrawer(false); setPalette(true); }}
            onClose={() => setDrawer(false)}
            className="w-full border-e-0"
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 lg:min-h-0">
        <header className="native-chrome sticky top-0 z-30 shrink-0 border-b">
          <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer(true)} aria-label={t.admin.panelTitle}>
                <Menu className="w-5 h-5" />
              </Button>
              <nav aria-label="breadcrumb" className="flex items-center gap-1.5 min-w-0 text-sm">
                <span className="text-muted-foreground hidden sm:inline truncate">{group.label(t)}</span>
                <ChevronRight className={cn("w-4 h-4 text-muted-foreground/60 hidden sm:inline")} />
                <span className="font-display font-semibold text-base sm:text-lg truncate">{sectionLabel(t, active)}</span>
              </nav>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setPalette(true)} aria-label={t.admin.searchPlaceholder || "Search"}>
                <Search className="w-4 h-4" />
              </Button>
              <AdminSystemEvents />
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
                    to="/admin/$section"
                    params={{ section: id }}
                    onMouseEnter={() => preloadPanel(id)}
                    onFocus={() => preloadPanel(id)}
                    onTouchStart={() => preloadPanel(id)}
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

        {/* key: a new section starts at the top of the scroll area.
            lg+: the top padding lives on the inner div, not on the scroll area,
            so sticky panel headers (top-0) meet the very top edge with no gap. */}
        <main key={active} className="admin-main flex-1 min-w-0 p-3 sm:p-6 lg:pt-0">
          <div className="max-w-7xl mx-auto lg:pt-6">
            <ConfirmProvider>
              {/* The route loader already downloaded this panel's code (the top bar
                  covered the wait), so this fallback is at most one blank frame. */}
              <Suspense fallback={null}>
                {Panel ? <Panel /> : null}
              </Suspense>
            </ConfirmProvider>
          </div>
        </main>
      </div>

      <AdminCommandPalette open={palette} onOpenChange={setPalette} basePath={BASE_PATH} />
    </div>
  );
}
