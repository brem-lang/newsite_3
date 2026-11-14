import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, History, Layers, Receipt, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const num = (v) => Number(v) || 0;
const abs = (v) => Math.abs(num(v));

export const COST_KINDS = [
  { id: "entry", label: "Entry cost" },
  { id: "bid", label: "Bid / processing cost" },
  { id: "other", label: "Other expense" },
];

/**
 * Per-auction finance workspace: saved cost line items, manual overrides for the
 * cost/revenue inputs, an audit trail of every change, and a per-round
 * breakdown that includes archived rounds.
 */
export default function AuctionFinancePanel({ auction, row, costItems, override, format, onChanged }) {
  const [tab, setTab] = useState("items");
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  const [rounds, setRounds] = useState(null);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState({ kind: "other", label: "", amount: "", notes: "" });
  const [ov, setOv] = useState({
    cost_price: override?.cost_price ?? "",
    other_cost: override?.other_cost ?? "",
    income_adjust: override?.income_adjust ?? "",
    note: override?.note ?? "",
  });

  useEffect(() => {
    setOv({
      cost_price: override?.cost_price ?? "",
      other_cost: override?.other_cost ?? "",
      income_adjust: override?.income_adjust ?? "",
      note: override?.note ?? "",
    });
  }, [override]);

  useEffect(() => {
    base44.adminAuth.me().then(setMe).catch(() => {});
  }, []);

  const loadHistory = async () => {
    const list = await base44.entities.AuctionFinanceChange.filter({ auction_id: auction.id }, "-created_date", 200);
    setHistory(list || []);
  };

  useEffect(() => { if (tab === "history") loadHistory().catch(() => {}); }, [tab, auction.id]);

  /** Per-round income, including archived rounds. */
  useEffect(() => {
    if (tab !== "rounds" || rounds) return;
    let alive = true;
    (async () => {
      const [bids, credits] = await Promise.all([
        base44.entities.Bid.filter({ auction_id: auction.id }, "created_date", 5000),
        base44.entities.BidCredit.filter({ auction_id: auction.id }, "created_date", 2000),
      ]);
      if (!alive) return;
      const bidFee = num(auction.bid_fee);
      const extraPrice = num(auction.extra_bid_price);
      const map = new Map();
      const bucket = (r) => {
        const k = Number(r) || 1;
        if (!map.has(k)) map.set(k, { round: k, bids: 0, archivedBids: 0, burned: 0, bidFees: 0, extraBids: 0, credits: 0, bidders: new Set() });
        return map.get(k);
      };
      for (const b of bids || []) {
        const g = bucket(b.round);
        if (b.archived) g.archivedBids += 1; else g.bids += 1;
        if (b.burned) g.burned += 1;
        g.bidFees += bidFee;
        g.bidders.add(b.user_id);
      }
      for (const c of credits || []) {
        const g = bucket(c.round);
        g.credits += num(c.credits);
        g.extraBids += num(c.credits) * extraPrice;
      }
      const currentRound = Number(auction.round) || 1;
      const entryFees = num(row?.entryFees);
      const out = [...map.values()].sort((a, b) => a.round - b.round).map((g) => ({
        ...g,
        participants: g.bidders.size,
        entryFees: g.round === 1 ? entryFees : 0,
        income: (g.round === 1 ? entryFees : 0) + g.bidFees + g.extraBids,
        isCurrent: g.round === currentRound,
      }));
      setRounds(out);
    })().catch(() => setRounds([]));
    return () => { alive = false; };
  }, [tab, rounds, auction.id, auction.bid_fee, auction.extra_bid_price, auction.round, row?.entryFees]);

  const logChange = async (field, oldValue, newValue, note) => {
    await base44.entities.AuctionFinanceChange.create({
      auction_id: auction.id,
      field,
      old_value: oldValue === null || oldValue === undefined || oldValue === "" ? null : String(oldValue),
      new_value: newValue === null || newValue === undefined || newValue === "" ? null : String(newValue),
      note: note || null,
      actor_id: me?.id || null,
      actor_name: me?.full_name || me?.email || "admin",
    });
  };

  const addItem = async () => {
    if (!draft.label.trim()) { toast.error("Add a label for the cost line"); return; }
    setBusy(true);
    try {
      await base44.entities.AuctionCostItem.create({
        auction_id: auction.id,
        kind: draft.kind,
        label: draft.label.trim(),
        amount: num(draft.amount),
        notes: draft.notes || null,
      });
      await logChange(`cost_item:${draft.kind}:${draft.label.trim()}`, null, num(draft.amount).toFixed(2), "added cost line");
      setDraft({ kind: "other", label: "", amount: "", notes: "" });
      toast.success("Cost line saved");
      onChanged?.();
      if (tab === "history") loadHistory();
    } catch (e) {
      toast.error(e?.message || "Could not save cost line");
    } finally { setBusy(false); }
  };

  const removeItem = async (item) => {
    setBusy(true);
    try {
      await base44.entities.AuctionCostItem.delete(item.id);
      await logChange(`cost_item:${item.kind}:${item.label}`, num(item.amount).toFixed(2), null, "removed cost line");
      toast.success("Cost line removed");
      onChanged?.();
      if (tab === "history") loadHistory();
    } catch (e) {
      toast.error(e?.message || "Could not remove cost line");
    } finally { setBusy(false); }
  };

  const saveOverride = async () => {
    setBusy(true);
    try {
      const payload = {
        cost_price: ov.cost_price === "" ? null : num(ov.cost_price),
        other_cost: ov.other_cost === "" ? null : num(ov.other_cost),
        income_adjust: ov.income_adjust === "" ? 0 : num(ov.income_adjust),
        note: ov.note || null,
      };
      const before = {
        cost_price: override?.cost_price ?? null,
        other_cost: override?.other_cost ?? null,
        income_adjust: override?.income_adjust ?? 0,
      };
      if (override?.id) await base44.entities.AuctionFinanceOverride.update(override.id, payload);
      else await base44.entities.AuctionFinanceOverride.create({ auction_id: auction.id, ...payload });

      for (const field of ["cost_price", "other_cost", "income_adjust"]) {
        if (String(before[field] ?? "") !== String(payload[field] ?? "")) {
          await logChange(`override:${field}`, before[field], payload[field], ov.note || null);
        }
      }
      toast.success("Override saved");
      onChanged?.();
      if (tab === "history") loadHistory();
    } catch (e) {
      toast.error(e?.message || "Could not save override");
    } finally { setBusy(false); }
  };

  const clearOverride = async () => {
    if (!override?.id) return;
    setBusy(true);
    try {
      await base44.entities.AuctionFinanceOverride.delete(override.id);
      await logChange("override:cleared", "custom values", "auction defaults", null);
      toast.success("Override cleared");
      onChanged?.();
      if (tab === "history") loadHistory();
    } catch (e) {
      toast.error(e?.message || "Could not clear override");
    } finally { setBusy(false); }
  };

  const itemTotals = useMemo(() => {
    const t = { entry: 0, bid: 0, other: 0, total: 0 };
    for (const i of costItems || []) { t[i.kind in t ? i.kind : "other"] += abs(i.amount); t.total += abs(i.amount); }
    return t;
  }, [costItems]);

  const TABS = [
    { id: "items", label: "Cost line items", icon: Receipt },
    { id: "override", label: "Override", icon: SlidersHorizontal },
    { id: "rounds", label: "Per round", icon: Layers },
    { id: "history", label: "Change history", icon: History },
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
              tab === x.id ? "bg-info text-info-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <x.icon className="w-3.5 h-3.5" />{x.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "items" && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_120px_auto] items-center">
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {COST_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <Input className="h-9" placeholder="Label (e.g. shipping to winner)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              <Input className="h-9" type="number" step="0.01" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <Button size="sm" onClick={addItem} disabled={busy}><Plus className="w-4 h-4 me-1" />Add</Button>
            </div>

            {(costItems || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No cost line items saved for this auction yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start font-medium">Type</th>
                      <th className="p-2 text-start font-medium">Label</th>
                      <th className="p-2 text-end font-medium">Amount</th>
                      <th className="p-2 text-start font-medium">Added</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {costItems.map((i) => (
                      <tr key={i.id} className="border-t border-border">
                        <td className="p-2">{COST_KINDS.find((k) => k.id === i.kind)?.label || i.kind}</td>
                        <td className="p-2">{i.label}</td>
                        <td className="p-2 text-end tabular-nums text-destructive">{format(abs(i.amount))}</td>
                        <td className="p-2 text-[11px] text-muted-foreground">{formatDateTime(i.created_date)}</td>
                        <td className="p-2 text-end">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={busy}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 font-semibold">
                    <tr className="border-t border-border">
                      <td className="p-2" colSpan={2}>
                        Entry {format(itemTotals.entry)} · Bid/processing {format(itemTotals.bid)} · Other {format(itemTotals.other)}
                      </td>
                      <td className="p-2 text-end tabular-nums text-destructive">{format(itemTotals.total)}</td>
                      <td className="p-2" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "override" && (
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs text-muted-foreground">
              Leave a field empty to keep the auction value. Overrides replace the auction inputs in every revenue
              calculation and every change is recorded in the history tab.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-medium">
                <span>Product cost {`(auction: ${format(num(auction.cost_price))})`}</span>
                <Input className="h-9" type="number" step="0.01" value={ov.cost_price} onChange={(e) => setOv({ ...ov, cost_price: e.target.value })} placeholder="—" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span>Other cost {`(auction: ${format(num(auction.other_cost))})`}</span>
                <Input className="h-9" type="number" step="0.01" value={ov.other_cost} onChange={(e) => setOv({ ...ov, other_cost: e.target.value })} placeholder="—" />
              </label>
              <label className="space-y-1 text-xs font-medium">
                <span>Income adjustment (+/-)</span>
                <Input className="h-9" type="number" step="0.01" value={ov.income_adjust} onChange={(e) => setOv({ ...ov, income_adjust: e.target.value })} placeholder="0.00" />
              </label>
            </div>
            <label className="space-y-1 text-xs font-medium block">
              <span>Reason / note</span>
              <Input className="h-9" value={ov.note} onChange={(e) => setOv({ ...ov, note: e.target.value })} placeholder="Why is this adjusted?" />
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveOverride} disabled={busy}><Save className="w-4 h-4 me-1" />Save override</Button>
              {override?.id && <Button size="sm" variant="outline" onClick={clearOverride} disabled={busy}>Clear override</Button>}
            </div>
            {override?.updated_date && (
              <p className="text-[11px] text-muted-foreground">Last updated {formatDateTime(override.updated_date)}</p>
            )}
          </div>
        )}

        {tab === "rounds" && (
          rounds === null ? <p className="text-sm text-muted-foreground">Loading rounds…</p>
            : rounds.length === 0 ? <p className="text-sm text-muted-foreground">No bids recorded yet.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="p-2 text-start font-medium">Round</th>
                        <th className="p-2 text-end font-medium">Bids (live)</th>
                        <th className="p-2 text-end font-medium">Bids (archived)</th>
                        <th className="p-2 text-end font-medium">Burned</th>
                        <th className="p-2 text-end font-medium">Bidders</th>
                        <th className="p-2 text-end font-medium">Entry fees</th>
                        <th className="p-2 text-end font-medium">Bid fees</th>
                        <th className="p-2 text-end font-medium">Extra bids</th>
                        <th className="p-2 text-end font-medium">Round income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rounds.map((g) => (
                        <tr key={g.round} className={cn("border-t border-border", g.isCurrent && "bg-info/10")}>
                          <td className="p-2 font-medium">
                            {g.round}{g.isCurrent ? " · current" : g.archivedBids > 0 ? " · archived" : ""}
                          </td>
                          <td className="p-2 text-end tabular-nums">{g.bids}</td>
                          <td className="p-2 text-end tabular-nums">{g.archivedBids}</td>
                          <td className="p-2 text-end tabular-nums">{g.burned}</td>
                          <td className="p-2 text-end tabular-nums">{g.participants}</td>
                          <td className="p-2 text-end tabular-nums">{format(g.entryFees)}</td>
                          <td className="p-2 text-end tabular-nums">{format(g.bidFees)}</td>
                          <td className="p-2 text-end tabular-nums">{format(g.extraBids)}</td>
                          <td className="p-2 text-end tabular-nums font-semibold">{format(g.income)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Entry fees are charged once per participant, so they are shown on round 1. Bid fees and extra bids are
                    attributed to the round in which they were bought.
                  </p>
                </div>
              )
        )}

        {tab === "history" && (
          history.length === 0 ? <p className="text-sm text-muted-foreground">No manual changes recorded for this auction.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start font-medium">When</th>
                    <th className="p-2 text-start font-medium">Who</th>
                    <th className="p-2 text-start font-medium">Field</th>
                    <th className="p-2 text-start font-medium">From</th>
                    <th className="p-2 text-start font-medium">To</th>
                    <th className="p-2 text-start font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-2 text-[11px] text-muted-foreground whitespace-nowrap">{formatDateTime(h.created_date)}</td>
                      <td className="p-2">{h.actor_name || "—"}</td>
                      <td className="p-2 font-mono text-[11px]">{h.field}</td>
                      <td className="p-2 tabular-nums">{h.old_value ?? "—"}</td>
                      <td className="p-2 tabular-nums">{h.new_value ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{h.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
