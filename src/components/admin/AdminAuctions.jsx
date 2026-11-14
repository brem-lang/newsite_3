import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Clock, Star, Trophy, Users, Flame, CheckCircle2, Search, Download, FileText, BarChart3, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Play, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logAdminAction } from "@/lib/adminAudit";
import { useI18n } from "@/lib/i18n";
import { effectiveStatus, formatDuration } from "@/lib/auction";
import AuctionFormDialog from "@/components/admin/AuctionFormDialog";
import AuctionBidsLog from "@/components/admin/AuctionBidsLog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MAX_HOME_SLOTS } from "@/lib/homeShowcase";

const statusStyles = {
  open: "bg-success/10 text-success",
  live: "bg-destructive/10 text-destructive",
  ended: "bg-muted text-muted-foreground"
};

export default function AdminAuctions() {
  const { t } = useI18n();
  const [auctions, setAuctions] = useState([]);
  const [users, setUsers] = useState({});
  const [view, setView] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [changingId, setChangingId] = useState(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const load = useCallback(() => {
    base44.entities.Auction.list("-created_date", 100)
      .then(setAuctions)
      .finally(() => setLoading(false));
    base44.entities.User.list("", 1000)
      .then((rows) => {
        const map = {};
        (rows || []).forEach((u) => { map[u.id] = u; });
        setUsers(map);
      })
      .catch(() => setUsers({}));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (auction) => {
    if (!window.confirm(t.admin.confirmDelete)) return;
    try {
      await base44.entities.Auction.delete(auction.id);
      logAdminAction("auction.delete", { targetType: "auctions", targetId: auction.id, details: auction.title });
      toast.success(t.admin.deleted);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const MAX_FEATURED = MAX_HOME_SLOTS;
  // Only auctions that can actually surface on home count toward the slots.
  const featuredList = auctions
    .filter((a) => a.featured && a.status !== "ended" && a.status !== "voided" && a.status !== "voiding")
    .sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));

  const toggleFeatured = async (auction) => {
    const next = !auction.featured;
    if (next && featuredList.length >= MAX_FEATURED) {
      toast.error(t.admin.featuredLimit);
      return;
    }
    setAuctions((prev) => prev.map((x) => (x.id === auction.id ? { ...x, featured: next } : x)));
    try {
      await base44.entities.Auction.update(auction.id, {
        featured: next,
        featured_order: next ? featuredList.length + 1 : 0
      });
      logAdminAction(next ? "auction.feature" : "auction.unfeature", { targetType: "auctions", targetId: auction.id, details: auction.title });
      toast.success(next ? t.admin.featuredOn : t.admin.featuredOff);
      load();
    } catch (e) {
      setAuctions((prev) => prev.map((x) => (x.id === auction.id ? { ...x, featured: auction.featured } : x)));
      toast.error(e.message || "Error");
    }
  };

  /** Moves a starred auction up/down in the home-page order. */
  const moveFeatured = async (auction, delta) => {
    const idx = featuredList.findIndex((a) => a.id === auction.id);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= featuredList.length) return;
    const reordered = [...featuredList];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setAuctions((prev) =>
      prev.map((x) => {
        const pos = reordered.findIndex((r) => r.id === x.id);
        return pos >= 0 ? { ...x, featured_order: pos + 1 } : x;
      })
    );
    try {
      await Promise.all(
        reordered.map((a, i) => base44.entities.Auction.update(a.id, { featured_order: i + 1 }))
      );
      logAdminAction("auction.reorder", { targetType: "auctions", targetId: auction.id, details: auction.title });
      load();
    } catch (e) {
      toast.error(e.message || "Error");
      load();
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a) => { setEditing(a); setDialogOpen(true); };

  const statusOptions = [
    { value: "open", label: t.auction.statusOpen },
    { value: "live", label: t.auction.statusLive },
    { value: "ended", label: t.auction.statusEnded }
  ];

  const handleStatusChange = async (auction, newStatus) => {
    if (newStatus === effectiveStatus(auction, now)) return;
    if (newStatus === "ended") {
      await closeNow(auction);
      return;
    }
    if (newStatus === "live" && !window.confirm(`Start “${auction.title}” now?`)) return;
    try {
      setChangingId(auction.id);
      const patch = { status: newStatus };
      if (newStatus === "live" && !auction.start_time) {
        patch.start_time = new Date().toISOString();
        patch.end_time = new Date(Date.now() + (auction.duration_minutes || 5) * 60000).toISOString();
      }
      if (newStatus === "open") {
        patch.start_time = null;
        patch.end_time = null;
        patch.winner_id = null;
      }
      await base44.entities.Auction.update(auction.id, patch);
      logAdminAction("auction.status", { targetType: "auctions", targetId: auction.id, details: `${auction.title} -> ${newStatus}` });
      toast.success(t.admin.saved);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setChangingId(null);
    }
  };

  const closeNow = async (auction) => {
    if (!window.confirm(`Close “${auction.title}” now, calculate the winner, and create the winner payment?`)) return;
    setChangingId(auction.id);
    try {
      const result = await base44.functions.invoke("closeAuction", { auction_id: auction.id });
      if (result?.data?.error) throw new Error(result.data.error);
      toast.success(t.admin.live?.ended || t.admin.saved);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setChangingId(null);
    }
  };

  if (loading) {
    return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;
  }

  const byStatus = (s) => auctions.filter((a) => effectiveStatus(a, now) === s);
  const liveAuctions = byStatus("live");
  const openAuctions = byStatus("open");
  const endedAuctions = byStatus("ended");
  const stats = {
    total: auctions.length,
    open: openAuctions.length,
    live: liveAuctions.length,
    ended: endedAuctions.length,
    revenue: auctions.reduce((s, a) => s + (a.subscriber_ids?.length || 0) * (a.entry_fee || 0), 0)
  };
  const statCards = [
    { label: t.admin.stats.total, value: stats.total },
    { label: t.admin.stats.open, value: stats.open },
    { label: t.admin.stats.live, value: stats.live },
    { label: t.admin.stats.ended, value: stats.ended },
    { label: t.admin.revenue, value: `${t.common.currency}${stats.revenue.toFixed(0)}` }
  ];
  const tabs = [
    { value: "all", label: t.admin.stats.total, count: stats.total },
    { value: "open", label: t.auction.statusOpen, count: stats.open },
    { value: "live", label: t.auction.statusLive, count: stats.live },
    { value: "ended", label: t.auction.statusEnded, count: stats.ended }
  ];
  const rows = view === "all" ? auctions : byStatus(view);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.subtitle}</p>
        </div>
        <Button onClick={openNew} className="gold-button gap-2"><Plus className="w-4 h-4" /> {t.admin.new}</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="native-panel rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-heading text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={view === tab.value ? "cyan" : "outline"}
            size="sm"
            onClick={() => setView(tab.value)}
            className={cn(
              "px-4 text-xs",
              view !== tab.value && "text-muted-foreground"
            )}
          >
            {tab.label} <span className="opacity-70">({tab.count})</span>
          </Button>
        ))}
      </div>


      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold rounded-full bg-primary/10 text-primary px-3 py-1.5">
          <Star className="w-3.5 h-3.5 fill-current" />
          {t.admin.featuredCount}: {featuredList.length}/{MAX_FEATURED}
        </span>
        {featuredList.length === 0 && <span className="text-muted-foreground">{t.admin.featuredFallback}</span>}
      </div>

      {view === "ended" ? (
        <EndedAuctions items={endedAuctions} users={users} t={t} onEdit={openEdit} onDelete={handleDelete} onReload={load} />
      ) : (
      <div className="native-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/10 text-accent">
              <tr>
                <th className="text-start font-medium px-4 py-3">{t.admin.fields.title}</th>
                <th className="text-center font-medium px-4 py-3">{t.admin.home}</th>
                <th className="text-start font-medium px-4 py-3">{t.admin.fields.status}</th>
                <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.fields.startPrice}</th>
                <th className="text-start font-medium px-4 py-3">{t.auction.currentPrice}</th>
                <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.subs}</th>
                <th className="text-start font-medium px-4 py-3 hidden md:table-cell">{t.admin.fields?.bidsPerParticipant || "Numbers/user"}</th>
                <th className="text-start font-medium px-4 py-3 hidden md:table-cell">{t.auction.duration}</th>
                <th className="text-end font-medium px-4 py-3">{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-10">{t.home.empty}</td></tr>
              ) : rows.map((a) => {
                const status = effectiveStatus(a, now);
                const filled = a.subscriber_ids?.length || 0;
                return (
                  <tr key={a.id} className="hover:bg-accent/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {a.image_url ? (
                          <img src={a.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted grid place-items-center text-muted-foreground text-xs shrink-0">{t.admin.fields.noImage}</div>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium line-clamp-1 block">{a.title}</span>
                          {status === "open" && a.scheduled_start_time && (
                            <span className="text-[10px] font-semibold text-warning inline-flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{t.auction.scheduledBadge}: {new Date(a.scheduled_start_time).toLocaleString("en-GB")}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="iconSm"
                          onClick={() => toggleFeatured(a)}
                          aria-pressed={!!a.featured}
                          aria-label={a.featured ? t.admin.featuredOn : t.admin.featuredOff}
                          title={a.featured ? t.admin.featuredOn : t.admin.featuredOff}
                          className={cn(
                            "h-9 w-9",
                            a.featured
                              ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_14px_-7px_hsl(var(--primary)/0.8)]"
                              : "bg-background border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Star className={cn("w-4 h-4", a.featured && "fill-current")} />
                        </Button>
                        {a.featured && (
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveFeatured(a, -1)}
                              title={t.admin.moveUp || "Move up"}
                              aria-label={t.admin.moveUp || "Move up"}
                              className="h-4 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFeatured(a, 1)}
                              title={t.admin.moveDown || "Move down"}
                              aria-label={t.admin.moveDown || "Move down"}
                              className="h-4 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {a.featured && (
                          <span className="text-[10px] font-semibold text-primary tabular-nums">#{a.featured_order || "-"}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(a, e.target.value)}
                        disabled={changingId === a.id}
                        className={cn("text-xs font-semibold rounded-full border-0 px-2.5 py-1 cursor-pointer focus:outline-none", statusStyles[status])}
                      >
                        {statusOptions
                          .filter((o) => status === "live" || o.value !== "ended")
                          .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{t.common.currency}{a.start_price?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold">{t.common.currency}{a.current_price?.toFixed(2)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{filled}/{a.max_subscribers}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {a.mode === "closest" ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{a.bids_per_participant ?? 5}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatDuration(a.duration_minutes, t)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {status === "open" && (
                          <Button variant="outline" size="sm" className="border-accent/35 text-accent" onClick={() => handleStatusChange(a, "live")} disabled={changingId === a.id}>
                            <Play className="w-4 h-4" />{t.auction.statusLive}
                          </Button>
                        )}
                        {status === "live" && (
                          <Button variant="destructive" size="sm" onClick={() => closeNow(a)} disabled={changingId === a.id}>
                            <Square className="w-4 h-4" />{t.admin.live?.endNow || t.auction.statusEnded}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label={t.admin.edit || "Edit"}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AuctionFormDialog auction={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  );
}

const PAGE_SIZE = 10;

/** Full data view for ended auctions: search, filters, pagination, export, details and revenue. */
function EndedAuctions({ items, users, t, onEdit, onDelete, onReload }) {
  const currency = t?.common?.currency || "$";
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const date = (v) => (v ? new Date(v).toLocaleString("en-GB") : "—");

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [bidStats, setBidStats] = useState({});
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalSec, setIntervalSec] = useState(30);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setBidStats({});
    setRefreshKey((k) => k + 1);
    onReload?.();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 500);
  }, [onReload]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, Math.max(5, intervalSec) * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, intervalSec, refresh]);

  const labels = {
    search: t?.admin?.results?.searchPlaceholder || "Search by ID, title or winner",
    from: t?.admin?.results?.from || "From",
    to: t?.admin?.results?.to || "To",
    all: t?.admin?.stats?.total || "All",
    paid: t?.admin?.results?.paid || "Paid",
    unpaid: t?.admin?.results?.unpaid || "Unpaid",
    exportCsv: t?.admin?.results?.exportCsv || "Export CSV",
    print: t?.admin?.results?.print || "Print / PDF",
    reset: t?.admin?.results?.reset || "Reset",
    revenue: t?.admin?.revenue || "Revenue",
    entryFees: t?.admin?.results?.entryFees || "Entry fees",
    bidFees: t?.admin?.results?.bidFees || "Bid fees",
    seats: t?.admin?.subs || "Seats",
    totals: t?.admin?.results?.totals || "Total",
    page: t?.admin?.results?.page || "Page",
    results: t?.admin?.results?.count || "results",
  };

  const winnerNameOf = (a) => {
    const w = users[a.winner_id] || users[a.highest_bidder_id];
    return a.winner_name || (w ? w.full_name || w.email : "");
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86399999 : null;
    return items.filter((a) => {
      if (payment === "paid" && !a.paid) return false;
      if (payment === "unpaid" && a.paid) return false;
      const ts = a.end_time ? new Date(a.end_time).getTime() : null;
      if (fromTs && (!ts || ts < fromTs)) return false;
      if (toTs && (!ts || ts > toTs)) return false;
      if (!needle) return true;
      return [a.id, a.title, winnerNameOf(a)].some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [items, q, from, to, payment, users]);

  useEffect(() => { setPage(1); }, [q, from, to, payment]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Bid counts for the visible page (drives bid-fee revenue).
  useEffect(() => {
    pageItems.forEach((a) => {
      if (bidStats[a.id] !== undefined) return;
      base44.entities.Bid.filter({ auction_id: a.id }, "-created_date", 500)
        .then((rows) => setBidStats((prev) => ({ ...prev, [a.id]: (rows || []).length })))
        .catch(() => setBidStats((prev) => ({ ...prev, [a.id]: 0 })));
    });
  }, [pageItems, bidStats]);

  const revenueOf = (a) => {
    const seats = a.subscriber_ids?.length || 0;
    const entry = seats * Number(a.entry_fee || 0);
    const bidCount = bidStats[a.id] || 0;
    const bidRev = a.mode === "closest" ? bidCount * Number(a.bid_fee || 0) : 0;
    return { seats, entry, bidRev, total: entry + bidRev };
  };

  const totals = filtered.reduce((acc, a) => {
    const r = revenueOf(a);
    acc.seats += r.seats; acc.entry += r.entry; acc.bidRev += r.bidRev; acc.total += r.total;
    return acc;
  }, { seats: 0, entry: 0, bidRev: 0, total: 0 });
  const maxTotal = Math.max(...filtered.map((a) => revenueOf(a).total), 1);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        ["auction_id", "title", "mode", "status", "start_time", "end_time", "duration_minutes", "seats", "min_participants", "entry_fee", "bid_fee", "start_price", "current_price", "target_price", "round", "winner", "paid", "entry_revenue", "bid_fee_revenue", "total_revenue"].join(","),
      ];
      const bidLines = [["auction_id", "auction_title", "round", "archived", "burned", "bidder", "amount", "created_date"].join(",")];
      for (const a of filtered) {
        const r = revenueOf(a);
        lines.push([a.id, a.title, a.mode, a.status, a.start_time, a.end_time, a.duration_minutes, r.seats, a.min_participants ?? "", a.entry_fee, a.bid_fee, a.start_price, a.current_price, a.target_price ?? "", a.round ?? 1, winnerNameOf(a), a.paid ? "yes" : "no", r.entry.toFixed(2), r.bidRev.toFixed(2), r.total.toFixed(2)].map(esc).join(","));
        const bids = await base44.entities.Bid.filter({ auction_id: a.id }, "-created_date", 500).catch(() => []);
        (bids || []).forEach((b) => {
          const u = users[b.user_id];
          bidLines.push([a.id, a.title, b.round ?? 1, b.archived ? "yes" : "no", b.burned ? "yes" : "no", u ? u.full_name || u.email : b.user_id, b.amount, b.created_date].map(esc).join(","));
        });
      }
      const csv = `ENDED AUCTIONS\n${lines.join("\n")}\n\nBID HISTORY\n${bidLines.join("\n")}\n`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `ended-auctions-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(labels.exportCsv);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="native-panel rounded-2xl p-4 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.search}
              className="w-full h-9 rounded-xl border border-border bg-background pl-9 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {labels.from}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {labels.to}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-sm">
            <option value="all">{labels.all}</option>
            <option value="paid">{labels.paid}</option>
            <option value="unpaid">{labels.unpaid}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => { setQ(""); setFrom(""); setTo(""); setPayment("all"); }}>{labels.reset}</Button>
          <Button size="sm" className="gap-2" onClick={exportCsv} disabled={exporting || !filtered.length}>
            <Download className="w-4 h-4" />{labels.exportCsv}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()} disabled={!filtered.length}>
            <FileText className="w-4 h-4" />{labels.print}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            {t?.common?.refresh || "Refresh"}
          </Button>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-primary w-4 h-4" />
            {t?.admin?.results?.autoRefresh || "Auto-refresh"}
          </label>
          <select
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
            disabled={!autoRefresh}
            className="h-8 rounded-xl border border-border bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={300}>5m</option>
          </select>
          {lastRefresh && (
            <span className="text-[11px] text-muted-foreground">
              {(t?.admin?.results?.lastUpdated || "Updated")}: {lastRefresh.toLocaleTimeString("en-GB")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} {labels.results}</p>
      </div>

      {filtered.length > 0 && (
        <div className="native-panel rounded-2xl p-5 space-y-4">
          <h3 className="font-heading text-sm font-bold inline-flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />{labels.revenue}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cell label={labels.entryFees} value={money(totals.entry)} />
            <Cell label={labels.bidFees} value={money(totals.bidRev)} />
            <Cell icon={Users} label={labels.seats} value={totals.seats} />
            <Cell label={labels.totals} value={money(totals.total)} />
          </div>
          <div className="space-y-2">
            {pageItems.map((a) => {
              const r = revenueOf(a);
              return (
                <div key={a.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{a.title}</span>
                    <span className="shrink-0 font-semibold">{money(r.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                    <div className="bg-primary h-full" style={{ width: `${(r.entry / maxTotal) * 100}%` }} title={`${labels.entryFees}: ${money(r.entry)}`} />
                    <div className="bg-warning h-full" style={{ width: `${(r.bidRev / maxTotal) * 100}%` }} title={`${labels.bidFees}: ${money(r.bidRev)}`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />{labels.entryFees}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning" />{labels.bidFees}</span>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.results?.empty || t.home.empty}</div>
      ) : pageItems.map((a) => {
        const seats = a.subscriber_ids?.length || 0;
        const winnerName = winnerNameOf(a) || (t.admin.results?.noWinner || "—");
        const closest = a.mode === "closest";
        const totalNumbers = closest ? Math.max(Math.round(Number(a.target_price || 0) * 100), 0) : 0;
        const r = revenueOf(a);
        const expanded = openId === a.id;
        return (
          <div key={a.id} className="native-panel rounded-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setOpenId(expanded ? null : a.id)} className="flex items-center gap-3 min-w-0 text-start flex-1">
                  {a.image_url ? (
                    <img src={a.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold truncate">{a.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {closest ? (t.admin.fields?.modeClosest || "Closest price") : (t.admin.fields?.modeAscending || "Ascending")}
                      {" · "}{t.admin.results?.endedAt || "Ended"}: {date(a.end_time)}
                      {" · "}#{String(a.id).slice(0, 8)}
                    </p>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", a.paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {a.paid ? labels.paid : labels.unpaid}
                  </span>
                  {a.winner_notified && (
                    <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t.admin.results?.notified || "Notified"}</span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(a)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {expanded && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Cell icon={Trophy} label={t.admin.results?.winner || "Winner"} value={winnerName} />
                  <Cell label={t.admin.results?.winningBid || "Winning price"} value={money(a.current_price)} />
                  <Cell icon={Users} label={t.admin.subs} value={`${seats}/${a.min_participants ?? a.max_subscribers}`} />
                  <Cell label={t.admin.fields.startPrice} value={money(a.start_price)} />
                  <Cell label={t.auction.duration} value={formatDuration(a.duration_minutes, t)} />
                  <Cell label={labels.entryFees} value={money(r.entry)} />
                  <Cell label={labels.bidFees} value={money(r.bidRev)} />
                  <Cell label={labels.totals} value={money(r.total)} />
                  <Cell label={t.admin.fields?.entryFee || "Entry fee"} value={money(a.entry_fee)} />
                  {closest && <Cell label={t.admin.fields?.targetPrice || "Target price"} value={money(a.target_price)} />}
                  {closest && <Cell icon={Flame} label={t.admin.numbers?.total || "Total numbers"} value={totalNumbers} />}
                  {closest && <Cell label={t.admin.fields?.bidsPerParticipant || "Numbers/user"} value={a.bids_per_participant ?? 5} />}
                  {closest && <Cell label={t.admin.fields?.bidFee || "Bid fee"} value={money(a.bid_fee)} />}
                  <Cell label={t.admin.fields?.rounds || "Round"} value={a.round ?? 1} />
                  <Cell label={t.auction.statusLive} value={date(a.start_time)} />
                  <Cell label="ID" value={a.id} />
                </div>
              )}
            </div>
            {expanded && <AuctionBidsLog auction={a} users={users} defaultOpen refreshKey={refreshKey} />}
          </div>
        );
      })}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{labels.page} {safePage} / {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Cell({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-accent/15 bg-background/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </p>
      <p className="text-sm font-semibold truncate" title={String(value)}>{value}</p>
    </div>
  );
}