import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, Minus, MessageSquarePlus, Gavel, Trophy, Wallet, Coins, Flame,
  Download, RefreshCw, KeyRound, ChevronDown, Search, ShieldCheck, CreditCard, History, Ticket
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, useAdminMe } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  moneySummary, withRunningBalance, auctionRollups, activitySummary, buildTimeline, toCsv
} from "@/lib/participantFile";

const statusStyle = {
  pending: "bg-warning/15 text-warning",
  verified: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive"
};

const dt = (v) => (v ? new Date(v).toLocaleString("en-GB") : "—");
const money = (v) => `${Number(v || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ParticipantDetailDialog({ participant, open, onOpenChange, onUpdate }) {
  const { t, dir } = useI18n();
  const d = t.admin.participants.dialog;
  const me = useAdminMe();
  const [noteDraft, setNoteDraft] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [adj, setAdj] = useState({ dir: "credit", amount: "", reason: "" });
  const [busyAdj, setBusyAdj] = useState(false);
  const [busyReset, setBusyReset] = useState(false);

  // The participant file, cached per user while the dialog is open.
  const fileQuery = useAdminData(
    adminKeys.participantFile(participant?.id),
    async () => {
      const res = await base44.functions.invoke("getParticipantFile", { user_id: participant.id });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    { enabled: open && !!participant?.id, retry: false },
  );
  const payload = open ? fileQuery.data ?? null : null;
  const loading = fileQuery.isFetching;
  const load = fileQuery.refresh;
  useEffect(() => { if (fileQuery.error) toast.error(fileQuery.error.message || "Error"); }, [fileQuery.error]);

  const rollups = useMemo(() => (payload ? auctionRollups(payload) : []), [payload]);
  const money$ = useMemo(() => moneySummary(payload?.transactions || []), [payload]);
  const activity = useMemo(() => (payload ? activitySummary(payload, rollups) : null), [payload, rollups]);
  const txRows = useMemo(() => withRunningBalance(payload?.transactions || []), [payload]);
  const timeline = useMemo(() => (payload ? buildTimeline(payload) : []), [payload]);

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    setPostingNote(true);
    try {
      await base44.entities.ParticipantNote.create({
        user_id: participant.id, author_id: me?.id,
        author_name: me?.full_name || me?.email || "—", body
      });
      toast.success(d.noteAdded);
      setNoteDraft("");
      load(); onUpdate?.();
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setPostingNote(false); }
  };

  const applyAdjustment = async () => {
    const amt = parseFloat(adj.amount);
    if (!amt || amt <= 0) return toast.error(d.amount);
    setBusyAdj(true);
    try {
      const signed = adj.dir === "credit" ? Math.abs(amt) : -Math.abs(amt);
      await base44.entities.WalletTransaction.create({
        user_id: participant.id, type: "adjustment", amount: signed,
        description: `${adj.dir === "credit" ? t.admin.payments.credit : t.admin.payments.debit} — ${adj.reason || "-"}`,
        notes: adj.reason
      });
      toast.success(d.adjusted);
      setAdj({ dir: "credit", amount: "", reason: "" });
      load(); onUpdate?.();
    } catch (e) { toast.error(e.message || "Error"); }
    finally { setBusyAdj(false); }
  };

  if (!participant) return null;
  const p = payload?.profile || participant;
  const v = p.verification_status || "pending";
  const vSt = t.admin.verification.status;

  const sendReset = async () => {
    if (!p.email) return;
    setBusyReset(true);
    try {
      await base44.auth.resetPasswordRequest(p.email);
      toast.success(d.resetSent || "Password reset email sent");
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusyReset(false);
    }
  };

  const exportAll = () => {
    const csv = toCsv(timeline, [
      { key: "at", label: "date", value: (r) => dt(r.at) },
      { key: "kind", label: "kind" },
      { key: "label", label: "event" },
      { key: "amount", label: "amount" },
      { key: "auction", label: "auction" },
      { key: "status", label: "status" },
      { key: "description", label: "details" }
    ]);
    download(`participant-${participant.id}.csv`, csv);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" dir={dir}>
        <Tabs defaultValue="overview" className="contents">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 rounded-full bg-secondary grid place-items-center text-sm font-bold shrink-0">
              {(p.full_name || p.email || "?").charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{p.full_name || p.email}</span>
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", statusStyle[v])}>{vSt[v]}</span>
            <div className="ms-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />{d.refresh}
              </Button>
              <Button size="sm" variant="outline" onClick={exportAll} className="gap-1.5">
                <Download className="w-4 h-4" />{d.exportAll}
              </Button>
              <Button size="sm" variant="outline" onClick={sendReset} disabled={busyReset || !p.email} className="gap-1.5">
                <KeyRound className="w-4 h-4" />{busyReset ? (d.sendingReset || "…") : (d.resetPassword || "Reset password")}
              </Button>
            </div>
          </DialogTitle>
          {/* Tab bar sits in the pinned header so it stays visible while a tab scrolls. */}
          {!(loading && !payload) && (
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="overview" className="gap-1.5"><ShieldCheck className="w-4 h-4" />{d.tabOverview}</TabsTrigger>
              <TabsTrigger value="auctions" className="gap-1.5"><Gavel className="w-4 h-4" />{d.tabAuctions} ({rollups.length})</TabsTrigger>
              <TabsTrigger value="bids" className="gap-1.5"><Coins className="w-4 h-4" />{d.tabBids} ({payload?.bids?.length || 0})</TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="w-4 h-4" />{d.tabPayments} ({txRows.length})</TabsTrigger>
              <TabsTrigger value="log" className="gap-1.5"><History className="w-4 h-4" />{d.tabLog} ({timeline.length})</TabsTrigger>
            </TabsList>
          )}
        </DialogHeader>

        {loading && !payload ? (
          <div className="h-56 grid place-items-center">
            <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ---------------- Overview ---------------- */}
            <TabsContent value="overview" className="space-y-5 mt-4">
              <Section title={d.profile}>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl border border-border bg-muted/20 p-4">
                  <Field label={t.admin.users.name} value={p.full_name || "—"} />
                  <Field label={t.admin.users.email} value={p.email || "—"} />
                  <Field label={t.admin.users.phone} value={p.phone || "—"} />
                  <Field label={d.whatsapp} value={[p.whatsapp_country_code, p.whatsapp_number].filter(Boolean).join(" ") || "—"} />
                  <Field label={t.admin.participants.colCountry} value={p.country || "—"} />
                  <Field label={d.address} value={[p.address_line1, p.address_city, p.address_country].filter(Boolean).join(", ") || "—"} />
                  <Field label={t.admin.participants.colIp} value={p.ip || "—"} mono />
                  <Field label={t.admin.participants.colRegistered} value={dt(p.created_date)} />
                  <Field label={d.lastSignIn} value={dt(p.last_sign_in_at)} />
                  <Field label={d.roles} value={(p.roles || []).join(", ") || p.role || "user"} />
                  <Field label={d.paused} value={p.paused ? d.yes : d.no} />
                  <Field label={d.emailConfirmed} value={p.email_confirmed_at ? d.yes : d.no} />
                </div>
              </Section>

              <Section title={d.moneySummary}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat icon={Wallet} label={d.balance} value={`${t.common.currency}${money(money$.balance)}`} />
                  <Stat icon={Plus} label={d.totalIn} value={`${t.common.currency}${money(money$.inflow)}`} />
                  <Stat icon={Minus} label={d.totalOut} value={`${t.common.currency}${money(money$.outflow)}`} />
                  <Stat icon={CreditCard} label={d.pending} value={`${t.common.currency}${money(money$.pending)}`} />
                </div>
                <div className="mt-2 rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 text-muted-foreground">
                      <tr><Th>{d.type}</Th><Th>{d.count}</Th><Th end>{d.total}</Th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {money$.byType.map((row) => (
                        <tr key={row.type}>
                          <Td>{d.txTypes?.[row.type] || row.type}</Td>
                          <Td>{row.count}</Td>
                          <Td end className={row.total < 0 ? "text-destructive" : "text-success"}>
                            {t.common.currency}{money(row.total)}
                          </Td>
                        </tr>
                      ))}
                      {money$.byType.length === 0 && <tr><Td colSpan={3}>{d.empty}</Td></tr>}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title={d.activity}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <Stat icon={Gavel} label={d.auctionsJoined} value={activity?.auctionsJoined ?? 0} />
                  <Stat icon={Trophy} label={d.wins} value={activity?.auctionsWon ?? 0} />
                  <Stat icon={Coins} label={d.totalBids} value={activity?.totalBids ?? 0} />
                  <Stat icon={Flame} label={d.burned} value={activity?.burnedNumbers ?? 0} />
                  <Stat icon={Plus} label={d.extraBids} value={activity?.extraBidsBought ?? 0} />
                  <Stat icon={Ticket} label={d.rejected} value={activity?.rejectedAttempts ?? 0} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{d.lastActivity}: {dt(activity?.lastActivity)}</p>
              </Section>

              <Section title={d.notes}>
                <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                  {(payload?.notes || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{d.notesEmpty}</p>
                  ) : payload.notes.map((n) => (
                    <div key={n.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-sm">{n.body}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{n.author_name || "—"} · {dt(n.created_date)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={d.notePlaceholder} className="flex-1" dir={dir} />
                  <Button onClick={addNote} disabled={postingNote || !noteDraft.trim()} className="gap-1.5 shrink-0">
                    <MessageSquarePlus className="w-4 h-4" />{postingNote ? d.posting : d.addNote}
                  </Button>
                </div>
              </Section>

              <Section title={d.finance}>
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant={adj.dir === "credit" ? "default" : "outline"} onClick={() => setAdj({ ...adj, dir: "credit" })} className="gap-1.5"><Plus className="w-4 h-4" />{d.addBalance}</Button>
                    <Button type="button" size="sm" variant={adj.dir === "debit" ? "destructive" : "outline"} onClick={() => setAdj({ ...adj, dir: "debit" })} className="gap-1.5"><Minus className="w-4 h-4" />{d.deductBalance}</Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <Label>{d.amount}</Label>
                      <Input type="number" min="0" step="0.01" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>{d.reason}</Label>
                      <Input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <Button onClick={applyAdjustment} disabled={busyAdj} className="w-full gap-1.5">{busyAdj ? d.applying : d.apply}</Button>
                </div>
              </Section>
            </TabsContent>

            {/* ---------------- Auctions ---------------- */}
            <TabsContent value="auctions" className="mt-4">
              <AuctionsTab rollups={rollups} d={d} currency={t.common.currency} />
            </TabsContent>

            {/* ---------------- Bids ---------------- */}
            <TabsContent value="bids" className="mt-4">
              <BidsTab payload={payload} d={d} currency={t.common.currency} />
            </TabsContent>

            {/* ---------------- Payments ---------------- */}
            <TabsContent value="payments" className="mt-4">
              <PaymentsTab rows={txRows} payload={payload} d={d} currency={t.common.currency} />
            </TabsContent>

            {/* ---------------- Log ---------------- */}
            <TabsContent value="log" className="mt-4">
              <LogTab items={timeline} d={d} currency={t.common.currency} />
            </TabsContent>
          </>
        )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- tabs ------------------------------- */

function AuctionsTab({ rollups, d, currency }) {
  const [openId, setOpenId] = useState(null);
  const exportCsv = () => download("participant-auctions.csv", toCsv(rollups, [
    { key: "title", label: "auction", value: (r) => r.auction.title },
    { key: "mode", label: "mode", value: (r) => r.auction.mode },
    { key: "status", label: "status", value: (r) => r.auction.status },
    { key: "joined", label: "joined_at", value: (r) => dt(r.joinedAt) },
    { key: "entry", label: "entry_fee", value: (r) => r.entryFeePaid },
    { key: "bids", label: "bids", value: (r) => r.totalBids },
    { key: "quota", label: "quota", value: (r) => r.quota },
    { key: "burned", label: "burned", value: (r) => r.burnedCount },
    { key: "fees", label: "bid_fees", value: (r) => r.bidFeesPaid },
    { key: "credits", label: "extra_credits_paid", value: (r) => r.creditsPaid },
    { key: "best", label: "best_number", value: (r) => r.bestAmount ?? "" },
    { key: "gap", label: "gap", value: (r) => r.gap ?? "" },
    { key: "won", label: "won", value: (r) => (r.won ? "yes" : "no") },
    { key: "charged", label: "winner_charged", value: (r) => r.winnerCharged }
  ]));

  if (rollups.length === 0) return <Empty text={d.empty} />;

  return (
    <div className="space-y-3">
      <ExportBar onExport={exportCsv} label={d.exportCsv} />
      <div className="space-y-2">
        {rollups.map((r) => {
          const isOpen = openId === r.auction.id;
          return (
            <div key={r.auction.id} className="rounded-xl border border-border bg-card">
              <button className="w-full text-start p-3 flex items-center gap-3" onClick={() => setOpenId(isOpen ? null : r.auction.id)}>
                <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{r.auction.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.auction.mode === "closest" ? d.modeClosest : d.modeHighest} · {r.auction.status} · {(r.auction.subscriber_ids || []).length} {d.seats}
                    {r.won && <span className="ms-2 text-success font-semibold">{d.winner}</span>}
                  </p>
                </div>
                <div className="hidden sm:grid grid-cols-4 gap-3 text-xs text-end">
                  <KV label={d.bidsUsed} value={`${r.totalBids}/${r.quota}`} />
                  <KV label={d.burned} value={r.burnedCount} />
                  <KV label={d.paid} value={`${currency}${money(r.entryFeePaid + r.bidFeesPaid + r.creditsPaid + r.winnerCharged)}`} />
                  <KV label={r.auction.mode === "closest" ? d.gap : d.best} value={r.auction.mode === "closest" ? (r.gap != null ? money(r.gap) : "—") : (r.bestAmount != null ? money(r.bestAmount) : "—")} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <KV label={d.joinedAt} value={dt(r.joinedAt)} />
                    <KV label={d.entryFee} value={`${currency}${money(r.entryFeePaid)}`} />
                    <KV label={d.bidFees} value={`${currency}${money(r.bidFeesPaid)}`} />
                    <KV label={d.extraCreditsPaid} value={`${currency}${money(r.creditsPaid)}`} />
                    <KV label={d.extraBids} value={r.purchasedCredits} />
                    <KV label={d.sellingPrice} value={r.auction.target_price != null ? `${currency}${money(r.auction.target_price)}` : "—"} />
                    <KV label={d.rank} value={r.rank ? `${r.rank.position}/${r.rank.of}` : "—"} />
                    <KV label={d.winnerCharged} value={`${currency}${money(r.winnerCharged)}`} />
                  </div>
                  <BidTable rows={r.liveBids} title={d.currentRound} d={d} currency={currency} />
                  {r.archivedBids.length > 0 && <BidTable rows={r.archivedBids} title={d.archivedRounds} d={d} currency={currency} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BidTable({ rows, title, d, currency }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{title} ({rows.length})</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{d.empty}</p> : (
        <div className="rounded-lg border border-border overflow-hidden admin-table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr><Th>{d.date}</Th><Th>{d.round}</Th><Th>{d.amount}</Th><Th>{d.state}</Th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((b) => (
                <tr key={b.id}>
                  <Td>{dt(b.created_date)}</Td>
                  <Td>{b.round}</Td>
                  <Td>{currency}{money(b.amount)}</Td>
                  <Td>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      b.burned ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                      {b.burned ? d.burnedState : d.activeState}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BidsTab({ payload, d, currency }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [auctionId, setAuctionId] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 25;
  const titleOf = (id) => (payload?.auctions || []).find((a) => a.id === id)?.title || id;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (payload?.bids || [])
      .filter((b) => auctionId === "all" || b.auction_id === auctionId)
      .filter((b) => state === "all"
        || (state === "burned" && b.burned)
        || (state === "active" && !b.burned && !b.archived)
        || (state === "archived" && b.archived))
      .filter((b) => !term || String(b.amount).includes(term) || titleOf(b.auction_id).toLowerCase().includes(term));
  }, [payload, q, state, auctionId]);

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const shown = rows.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  const exportCsv = () => download("participant-bids.csv", toCsv(rows, [
    { key: "created_date", label: "date", value: (r) => dt(r.created_date) },
    { key: "auction", label: "auction", value: (r) => titleOf(r.auction_id) },
    { key: "round", label: "round" },
    { key: "amount", label: "amount" },
    { key: "burned", label: "burned", value: (r) => (r.burned ? "yes" : "no") },
    { key: "archived", label: "archived", value: (r) => (r.archived ? "yes" : "no") }
  ]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={d.searchBids} className="ps-9" />
        </div>
        <Select value={auctionId} onValueChange={(v) => { setAuctionId(v); setPage(1); }}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.allAuctions}</SelectItem>
            {(payload?.auctions || []).map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.allStates}</SelectItem>
            <SelectItem value="active">{d.activeState}</SelectItem>
            <SelectItem value="burned">{d.burnedState}</SelectItem>
            <SelectItem value="archived">{d.archivedState}</SelectItem>
          </SelectContent>
        </Select>
        <ExportBar onExport={exportCsv} label={d.exportCsv} />
      </div>

      {rows.length === 0 ? <Empty text={d.empty} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr><Th>{d.date}</Th><Th>{d.auction}</Th><Th>{d.round}</Th><Th>{d.amount}</Th><Th>{d.state}</Th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((b) => (
                  <tr key={b.id}>
                    <Td>{dt(b.created_date)}</Td>
                    <Td>{titleOf(b.auction_id)}</Td>
                    <Td>{b.round}</Td>
                    <Td>{currency}{money(b.amount)}</Td>
                    <Td>{b.burned ? d.burnedState : b.archived ? d.archivedState : d.activeState}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} d={d} />
        </>
      )}
    </div>
  );
}

function PaymentsTab({ rows, payload, d, currency }) {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 25;
  const titleOf = (id) => (payload?.auctions || []).find((a) => a.id === id)?.title || "";
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);

  const filtered = useMemo(() => rows
    .filter((r) => type === "all" || r.type === type)
    .filter((r) => status === "all" || r.status === status), [rows, type, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const shown = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  const exportCsv = () => download("participant-payments.csv", toCsv(filtered, [
    { key: "created_date", label: "date", value: (r) => dt(r.created_date) },
    { key: "type", label: "type" },
    { key: "amount", label: "amount" },
    { key: "running_balance", label: "balance_after" },
    { key: "status", label: "status" },
    { key: "auction", label: "auction", value: (r) => titleOf(r.auction_id) },
    { key: "reference", label: "reference" },
    { key: "provider", label: "provider" },
    { key: "description", label: "description" }
  ]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.allTypes}</SelectItem>
            {types.map((x) => <SelectItem key={x} value={x}>{d.txTypes?.[x] || x}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.allStates}</SelectItem>
            <SelectItem value="confirmed">confirmed</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
          </SelectContent>
        </Select>
        <ExportBar onExport={exportCsv} label={d.exportCsv} />
      </div>

      {filtered.length === 0 ? <Empty text={d.empty} /> : (
        <>
          <div className="rounded-xl border border-border overflow-hidden admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <Th>{d.date}</Th><Th>{d.type}</Th><Th>{d.amount}</Th><Th>{d.balanceAfter}</Th>
                  <Th>{d.status}</Th><Th>{d.auction}</Th><Th>{d.details}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((tx) => (
                  <tr key={tx.id}>
                    <Td>{dt(tx.created_date)}</Td>
                    <Td>{d.txTypes?.[tx.type] || tx.type}</Td>
                    <Td className={Number(tx.amount) < 0 ? "text-destructive" : "text-success"}>
                      {Number(tx.amount) < 0 ? "−" : "+"}{currency}{money(Math.abs(tx.amount))}
                    </Td>
                    <Td>{currency}{money(tx.running_balance)}</Td>
                    <Td>{tx.status}</Td>
                    <Td className="max-w-[160px] truncate">{titleOf(tx.auction_id) || "—"}</Td>
                    <Td className="max-w-[220px] truncate">{tx.description || tx.notes || tx.reference || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} d={d} />
        </>
      )}
    </div>
  );
}

const kindStyle = {
  bid: "bg-info/15 text-info",
  wallet: "bg-success/15 text-success",
  attempt: "bg-destructive/15 text-destructive",
  notification: "bg-primary/15 text-primary",
  support: "bg-warning/15 text-warning",
  fulfilment: "bg-cyan-100 text-cyan-700",
  refund: "bg-warning/15 text-warning",
  note: "bg-surface text-foreground",
  admin: "bg-surface text-foreground",
  account: "bg-surface text-foreground"
};

function LogTab({ items, d, currency }) {
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 40;
  const kinds = useMemo(() => Array.from(new Set(items.map((i) => i.kind))), [items]);
  const filtered = useMemo(() => items.filter((i) => kind === "all" || i.kind === kind), [items, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const shown = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  const exportCsv = () => download("participant-log.csv", toCsv(filtered, [
    { key: "at", label: "date", value: (r) => dt(r.at) },
    { key: "kind", label: "kind" },
    { key: "label", label: "event" },
    { key: "amount", label: "amount" },
    { key: "auction", label: "auction" },
    { key: "status", label: "status" },
    { key: "description", label: "details" }
  ]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{d.allKinds}</SelectItem>
            {kinds.map((k) => <SelectItem key={k} value={k}>{d.kinds?.[k] || k}</SelectItem>)}
          </SelectContent>
        </Select>
        <ExportBar onExport={exportCsv} label={d.exportCsv} />
      </div>

      {filtered.length === 0 ? <Empty text={d.empty} /> : (
        <>
          <div className="space-y-2">
            {shown.map((i, idx) => (
              <div key={`${i.kind}-${i.at}-${idx}`} className="rounded-xl border border-border bg-card p-3 flex gap-3">
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full h-fit shrink-0", kindStyle[i.kind] || "bg-secondary")}>
                  {d.kinds?.[i.kind] || i.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">
                    {d.events?.[i.label] || i.label}
                    {i.amount != null && <span className="ms-2 font-mono">{currency}{money(Math.abs(i.amount))}</span>}
                  </p>
                  {i.auction && <p className="text-xs text-muted-foreground truncate">{i.auction}</p>}
                  {i.description && <p className="text-xs text-muted-foreground break-words">{i.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {dt(i.at)}{i.status ? ` · ${i.status}` : ""}{i.author ? ` · ${i.author}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} d={d} />
        </>
      )}
    </div>
  );
}

/* ------------------------------ primitives ------------------------------ */

const Section = ({ title, children }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
    {children}
  </div>
);

const Th = ({ children, end }) => (
  <th className={cn("font-medium px-3 py-2 whitespace-nowrap", end ? "text-end" : "text-start")}>{children}</th>
);
const Td = ({ children, end, className, colSpan }) => (
  <td colSpan={colSpan} className={cn("px-3 py-2 whitespace-nowrap", end && "text-end", className)}>{children}</td>
);

const KV = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[11px] text-muted-foreground truncate">{label}</p>
    <p className="font-semibold truncate">{value}</p>
  </div>
);

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className="font-display font-bold leading-tight truncate">{value}</p>
    </div>
  </div>
);

const Empty = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">{text}</div>
);

const ExportBar = ({ onExport, label }) => (
  <Button size="sm" variant="outline" onClick={onExport} className="gap-1.5 ms-auto">
    <Download className="w-4 h-4" />{label}
  </Button>
);

const Pager = ({ page, pages, onChange, d }) => (
  pages <= 1 ? null : (
    <div className="flex items-center justify-between gap-2 text-sm">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>{d.prev}</Button>
      <span className="text-muted-foreground">{page} / {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>{d.next}</Button>
    </div>
  )
);

function Field({ label, value, mono }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("font-medium truncate", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
