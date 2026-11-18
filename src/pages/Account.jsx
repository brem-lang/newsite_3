import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Trophy, Clock, XCircle, MinusCircle, Gavel, ArrowLeft, Heart, Search, Compass, Pencil, KeyRound, ShieldCheck, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { effectiveStatus } from "@/lib/auction";
import { Image } from "@/components/ui/image";
import { Badge } from "@/components/ui/badge";
import WinnerBadge from "@/components/WinnerBadge";
import MobileAccount from "@/components/account/MobileAccount";
import ProfileSection from "@/components/account/profile/ProfileSection";
import ChangePassword from "@/components/account/ChangePassword";
import SecuritySettings from "@/components/account/SecuritySettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { Button } from "@/components/ui/button";

const STATUS_META = (t) => ({
  ongoing: { label: t.account.status.ongoing, icon: Clock, className: "bg-warning/15 text-warning border-warning/30" },
  won: { label: t.account.status.won, icon: Trophy, className: "bg-success/15 text-success border-success/30" },
  lost: { label: t.account.status.lost, icon: XCircle, className: "bg-destructive/15 text-destructive border-destructive/30" },
  noWinner: { label: t.account.status.noWinner, icon: MinusCircle, className: "bg-muted text-muted-foreground" }
});

export default function Account() {
  const { t, dir } = useI18n();
  const { symbol } = useCurrency();
  const { user } = useOutletContext();
  const isMobile = useIsMobileView();

  const handleLogout = useCallback(async () => {
    await base44.auth.logout("/");
  }, []);

  const [bids, setBids] = useState([]);
  const [auctions, setAuctions] = useState({});
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState([]);

  const reload = useCallback(async () => {
    if (!user) return;
    const [myBids, allAuctions] = await Promise.all([
      base44.entities.Bid.filter({ user_id: user.id }, "-created_date", 100),
      base44.entities.Auction.list("-created_date", 100)
    ]);
    const map = {};
    (allAuctions || []).forEach((a) => { map[a.id] = a; });
    setBids(myBids || []);
    setAuctions(map);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reload]);

  useEffect(() => {
    // Guarded so a late response after navigation never updates an unmounted page.
    let alive = true;
    base44.auth
      .me()
      .then((u) => { if (alive) setWatched(u?.watched_auction_ids || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);


  const watchlist = watched.map((wid) => auctions[wid]).filter(Boolean);

  const participations = useMemo(() => {
    const byAuction = {};
    for (const b of bids) {
      const key = b.auction_id;
      if (!byAuction[key]) byAuction[key] = { auction: auctions[key], highest: 0, count: 0, last: null };
      byAuction[key].count++;
      if (b.amount > byAuction[key].highest) byAuction[key].highest = b.amount;
      if (!byAuction[key].last || new Date(b.created_date) > new Date(byAuction[key].last)) {
        byAuction[key].last = b.created_date;
      }
    }
    return Object.values(byAuction)
      .filter((p) => p.auction)
      .sort((a, b) => new Date(b.last || 0) - new Date(a.last || 0));
  }, [bids, auctions]);

  const outcomeOf = (p) => {
    const status = effectiveStatus(p.auction);
    if (status === "ended") {
      if (p.auction.winner_id === user.id) return "won";
      return p.auction.winner_id ? "lost" : "noWinner";
    }
    return "ongoing";
  };

  const stats = useMemo(() => {
    const s = { total: participations.length, won: 0, ongoing: 0, lost: 0 };
    participations.forEach((p) => {
      const o = outcomeOf(p);
      if (o === "won") s.won++;
      else if (o === "ongoing") s.ongoing++;
      else if (o === "lost") s.lost++;
    });
    return s;
  }, [participations]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = STATUS_META(t);
  const cur = symbol;

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const withOutcome = useMemo(
    () => participations.map((p) => ({ p, outcome: outcomeOf(p) })),
    [participations] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const counts = useMemo(() => {
    const c = { all: withOutcome.length, ongoing: 0, won: 0, lost: 0, noWinner: 0 };
    withOutcome.forEach(({ outcome }) => { c[outcome] = (c[outcome] || 0) + 1; });
    return c;
  }, [withOutcome]);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "ongoing", label: t.account.status.ongoing },
    { id: "won", label: t.account.status.won },
    { id: "lost", label: t.account.status.lost },
    { id: "noWinner", label: t.account.status.noWinner }
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withOutcome
      .filter(({ outcome }) => filter === "all" || outcome === filter)
      .filter(({ p }) => !q || (p.auction.title || "").toLowerCase().includes(q));
  }, [withOutcome, filter, query]);

  const tabRefs = useRef([]);
  const focusTab = (i) => {
    const next = (i + filterTabs.length) % filterTabs.length;
    setFilter(filterTabs[next].id);
    tabRefs.current[next]?.focus();
  };
  const onTabsKeyDown = (e) => {
    const idx = filterTabs.findIndex((f) => f.id === filter);
    const forward = "ArrowRight";
    const back = "ArrowLeft";
    if (e.key === forward) { e.preventDefault(); focusTab(idx + 1); }
    else if (e.key === back) { e.preventDefault(); focusTab(idx - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusTab(0); }
    else if (e.key === "End") { e.preventDefault(); focusTab(filterTabs.length - 1); }
  };

  // Lock page scroll while the no-scroll mobile account console is shown.
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    const prevH = html.style.overflow;
    const prevB = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevH;
      body.style.overflow = prevB;
    };
  }, [isMobile]);

  if (loading) {
    return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;
  }

  if (isMobile) {
    return (
      <MobileAccount
        user={user}
        stats={stats}
        participations={participations}
        outcomeOf={outcomeOf}
        watchlist={watchlist}
        loading={loading}
        onRefresh={reload}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t.account.title}</h1>
          <p className="text-muted-foreground mt-1">{t.account.subtitle}</p>
        </div>
        {stats.won > 0 && <WinnerBadge count={stats.won} />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t.account.stats.total} value={stats.total} icon={Gavel} />
        <StatCard label={t.account.stats.won} value={stats.won} icon={Trophy} accent="text-success" />
        <StatCard label={t.account.stats.ongoing} value={stats.ongoing} icon={Clock} accent="text-warning" />
        <StatCard label={t.account.stats.lost} value={stats.lost} icon={XCircle} accent="text-destructive" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={Pencil} title={t.account.profile.editProfile} subtitle={t.account.profile.editProfileSubtitle} onClick={() => setEditOpen(true)} />
        <QuickAction icon={KeyRound} title={t.account.profile.changePassword} subtitle={t.account.profile.changePasswordSubtitle} onClick={() => setPwOpen(true)} />
        <QuickAction icon={ShieldCheck} title={t.account.profile.securitySettings} subtitle={t.account.profile.securityOverviewSubtitle} onClick={() => setSecurityOpen(true)} />
      </div>

      <ProfileSection user={user} />


      {watchlist.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> {t.account.watchlist}</h2>
          <div className="flex flex-wrap gap-3">
            {watchlist.map((a) => (
              <Link key={a.id} to={`/auction/${a.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 pr-3 hover:shadow-sm transition-shadow">
                {a.image_url ? <Image src={a.image_url} alt={a.title} className="w-10 h-10 rounded-lg shrink-0" fittingType="fill" /> : <div className="w-10 h-10 rounded-lg bg-muted grid place-items-center"><Gavel className="w-4 h-4 text-muted-foreground/50" /></div>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{cur}{(a.current_price || 0).toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {participations.length === 0 ? (
        <DesktopEmptyState filter="all" t={t} dir={dir} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div
              className="flex items-center gap-2 flex-wrap"
              role="tablist"
              aria-label={"Filter bids by status"}
              aria-orientation="horizontal"
              onKeyDown={onTabsKeyDown}
            >
              {filterTabs.map((f, i) => {
                const active = filter === f.id;
                const count = counts[f.id] || 0;
                return (
                  <Button
                    key={f.id}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    id={`bids-tab-${f.id}`}
                    type="button"
                    variant={active ? "gold" : "outline"}
                    size="sm"
                    role="tab"
                    aria-selected={active}
                    aria-controls="bids-panel"
                    tabIndex={active ? 0 : -1}
                    aria-label={`${f.label}, ${count} ${count === 1 ? "auction" : "auctions"}`}
                    onClick={() => setFilter(f.id)}
                    className={`h-9 gap-1.5 px-3 text-xs ${active ? "" : "text-muted-foreground"}`}
                  >
                    <span aria-hidden="true">{f.label}</span>
                    <span aria-hidden="true" className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>
                  </Button>
                );
              })}
            </div>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={"Search your bids"}
                aria-label={"Search your bids"}
                aria-controls="bids-panel"
                className="w-full h-9 rounded-xl bg-card border border-border text-sm pl-9 outline-none focus:ring-2 focus:ring-ring/30 transition"
              />
            </div>
          </div>

          <div id="bids-panel" role="tabpanel" aria-labelledby={`bids-tab-${filter}`} aria-live="polite" tabIndex={-1} className="space-y-4">
          {visible.length === 0 && (
            <DesktopEmptyState filter={query.trim() ? "noMatch" : filter} t={t} dir={dir}
              onReset={() => { setFilter("all"); setQuery(""); }} />
          )}

          {visible.map(({ p, outcome }) => {
            const m = meta[outcome];
            const StatusIcon = m.icon;
            return (
              <div key={p.auction.id} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col sm:flex-row">
                <div className="sm:w-48 w-full h-40 sm:h-auto shrink-0 bg-muted overflow-hidden">
                  {p.auction.image_url ? (
                    <Image src={p.auction.image_url} alt={p.auction.title} className="w-full h-full" fittingType="fill" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground/40"><Gavel className="w-8 h-8" /></div>
                  )}
                </div>
                <div className="flex-1 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/auction/${p.auction.id}`} className="font-heading text-lg font-semibold hover:underline">
                      {p.auction.title}
                    </Link>
                    {outcome === "won" ? (
                      <WinnerBadge />
                    ) : (
                      <Badge variant="secondary" className={`gap-1.5 border ${m.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {m.label}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <Field label={t.account.myBids} value={p.count} />
                    <Field label={t.account.highest} value={`${cur}${p.highest.toFixed(2)}`} />
                    <Field label={t.account.currentPrice} value={`${cur}${(p.auction.current_price || 0).toFixed(2)}`} />
                  </div>
                  <Link to={`/auction/${p.auction.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline self-start mt-1">
                    {t.account.viewAuction}
                  </Link>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" /> {t.account.profile.editProfile}</DialogTitle>
          </DialogHeader>
          <ProfileSection user={user} compact />
        </DialogContent>
      </Dialog>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> {t.account.profile.changePassword}</DialogTitle>
          </DialogHeader>
          <ChangePassword user={user} embedded />
        </DialogContent>
      </Dialog>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> {t.account.profile.securitySettings}</DialogTitle>
          </DialogHeader>
          <SecuritySettings user={user} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickAction({ icon: Icon, title, subtitle, onClick }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-auto justify-start gap-3 p-4 text-start whitespace-normal"
    >
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground truncate">{subtitle}</span>
      </span>
    </Button>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className={`w-3.5 h-3.5 ${accent || ""}`} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

const EMPTY_ICON = { all: Gavel, ongoing: Clock, won: Trophy, lost: XCircle, noWinner: MinusCircle, noMatch: Search };
const EMPTY_TONE = {
  all: "text-accent", ongoing: "text-warning", won: "text-success",
  lost: "text-destructive", noWinner: "text-muted-foreground/50", noMatch: "text-muted-foreground/50"
};

function DesktopEmptyState({ filter, t, dir, onReset }) {
  const Icon = EMPTY_ICON[filter] || Gavel;
  const tone = EMPTY_TONE[filter] || EMPTY_TONE.all;
  const copy = t.account.emptyStates[filter] || t.account.emptyStates.all;
  const arrow = "";
  const btn = "gold-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.97]";
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center" role="status">
      <Icon className={`w-12 h-12 mx-auto mb-3 ${tone}`} aria-hidden="true" />
      <h3 className="text-lg font-semibold">{copy.title}</h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">{copy.body}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {filter === "noMatch" && onReset ? (
          <Button type="button" onClick={onReset}>
            {"Reset filters"}
          </Button>
        ) : null}
        {filter !== "noMatch" && (
          <Link to="/auctions" className={btn} aria-label={"Browse auctions"}>
            <Compass className="w-4 h-4" aria-hidden="true" /> {t.home.browse}
            <ArrowLeft className={`w-4 h-4 ${arrow}`} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

