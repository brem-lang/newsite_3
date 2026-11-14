import React, { useState } from "react";
import { FlaskConical, Play, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Scale } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  title: "TEST · closest price",
  target_price: "20",
  seats: "3",
  entry_fee: "5",
  bid_fee: "0",
  extra_bid_price: "1",
  bids_per_participant: "5",
  duration_minutes: "120",
  seed_balance: "500",
  numbers: "19.90, 19.50 | 19.75 | 18.20, 19.95",
};

const STATUS_STYLE = {
  ok: "bg-success/10 text-success border-success/25",
  missing: "bg-warning/10 text-warning border-warning/25",
  duplicate: "bg-destructive/10 text-destructive border-destructive/25",
  mismatch: "bg-destructive/10 text-destructive border-destructive/25",
};

const CATEGORY_LABEL = {
  entry_fee: "Entry fee",
  bid_fee: "Bid fee",
  extra_credits: "Extra bid credits",
  winner_charge: "Winner charge",
};

function Field({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input {...props} />
    </div>
  );
}

/**
 * Test mode: build a reproducible closest-price auction (predefined seats,
 * numbers and selling price) and reconcile every money movement of any auction.
 */
export default function AdminTestMode() {
  const [form, setForm] = useState(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  const [auctionId, setAuctionId] = useState("");
  const [checking, setChecking] = useState(false);
  const [recon, setRecon] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setCreating(true); setError(""); setCreated(null);
    try {
      const res = await base44.functions.invoke("createTestAuction", {
        ...form,
        target_price: Number(form.target_price),
        seats: Number(form.seats),
        entry_fee: Number(form.entry_fee),
        bid_fee: Number(form.bid_fee),
        extra_bid_price: Number(form.extra_bid_price),
        bids_per_participant: Number(form.bids_per_participant),
        duration_minutes: Number(form.duration_minutes),
        seed_balance: Number(form.seed_balance),
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setCreated(data);
      if (data?.auction?.id) { setAuctionId(data.auction.id); reconcile(data.auction.id); }
    } catch (e) {
      setError(e?.message || "Failed to create the test auction");
    } finally {
      setCreating(false);
    }
  };

  const reconcile = async (id) => {
    const target = id || auctionId;
    if (!target) return;
    setChecking(true);
    try {
      const res = await base44.functions.invoke("reconcileAuctionPayments", { auction_id: target });
      const data = res?.data || res;
      setRecon(data?.error ? { error: data.error } : data);
    } catch (e) {
      setRecon({ error: e?.message || "Reconciliation failed" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" /> Test mode
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a repeatable test auction with predefined seats, numbers and selling price, then verify that every
          charge was applied exactly once.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold">Test auction generator</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Title" value={form.title} onChange={set("title")} />
          <Field label="Selling price (target)" type="number" step="0.01" value={form.target_price} onChange={set("target_price")} />
          <Field label="Seats to fill" type="number" value={form.seats} onChange={set("seats")} />
          <Field label="Entry fee" type="number" step="0.01" value={form.entry_fee} onChange={set("entry_fee")} />
          <Field label="Bid fee (0 = free bids)" type="number" step="0.01" value={form.bid_fee} onChange={set("bid_fee")} />
          <Field label="Extra bid price" type="number" step="0.01" value={form.extra_bid_price} onChange={set("extra_bid_price")} />
          <Field label="Bids per participant" type="number" value={form.bids_per_participant} onChange={set("bids_per_participant")} />
          <Field label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={set("duration_minutes")} />
          <Field label="Seed wallet per seat" type="number" step="0.01" value={form.seed_balance} onChange={set("seed_balance")} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Numbers per seat — separate seats with “|”, numbers with “,”</Label>
          <Input value={form.numbers} onChange={set("numbers")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={create} disabled={creating}>
            {creating ? <RefreshCw className="w-4 h-4 me-1.5 animate-spin" /> : <Play className="w-4 h-4 me-1.5" />}
            Create test auction
          </Button>
          <Button variant="outline" onClick={() => setForm(DEFAULTS)}>Reset defaults</Button>
        </div>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{error}</p>
        )}

        {created?.auction && (
          <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{created.auction.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-background">{created.auction.status}</span>
              <a
                href={`/auction/${created.auction.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs font-semibold"
              >
                Open auction <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Test accounts password: {created.password}</p>
            <div className="space-y-1.5">
              {(created.seats || []).map((s) => (
                <div key={s.seat} className="rounded-lg bg-background border border-border p-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">Seat {s.seat}</span>
                    <span className="text-muted-foreground">{s.email}</span>
                    <span className={cn("px-1.5 py-0.5 rounded border", s.joined ? STATUS_STYLE.ok : STATUS_STYLE.duplicate)}>
                      {s.joined ? "joined" : `join failed: ${s.join_error || s.error}`}
                    </span>
                    <span className="text-muted-foreground tabular-nums">balance {s.balance}</span>
                  </div>
                  {!!(s.bids || []).length && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.bids.map((b, i) => (
                        <span
                          key={i}
                          className={cn(
                            "text-[11px] px-1.5 py-0.5 rounded border tabular-nums",
                            b.ok ? (b.burned ? STATUS_STYLE.missing : STATUS_STYLE.ok) : STATUS_STYLE.duplicate
                          )}
                        >
                          {b.amount}{b.burned ? " · burned" : ""}{b.error ? ` · ${b.error}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Scale className="w-4 h-4" /> Payment reconciliation</h2>
        <p className="text-sm text-muted-foreground">
          Checks entry fees, bid fees, extra bid credits and the winner charge of one auction against what its state
          implies, and flags anything missing, duplicated or mismatched.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            placeholder="Auction ID"
            value={auctionId}
            onChange={(e) => setAuctionId(e.target.value)}
          />
          <Button variant="outline" onClick={() => reconcile()} disabled={checking || !auctionId}>
            {checking ? <RefreshCw className="w-4 h-4 me-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 me-1.5" />}
            Reconcile
          </Button>
        </div>

        {recon?.error && (
          <p className="text-sm text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{recon.error}</p>
        )}

        {recon && !recon.error && (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border p-3 text-sm font-semibold flex items-center gap-2",
                recon.problems ? STATUS_STYLE.duplicate : STATUS_STYLE.ok
              )}
            >
              {recon.problems ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {recon.problems
                ? `${recon.problems} reconciliation issue(s) found`
                : "All charges applied exactly once"}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Entry fees", recon.totals?.entry_fees],
                ["Bid fees", recon.totals?.bid_fees],
                ["Extra credits", recon.totals?.extra_credits],
                ["Winner charge", recon.totals?.winner_charges],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold tabular-nums">{Number(value || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs">
                  <tr>
                    <th className="text-start p-2">Charge</th>
                    <th className="text-start p-2">User</th>
                    <th className="text-end p-2">Expected</th>
                    <th className="text-end p-2">Actual</th>
                    <th className="text-end p-2">Count</th>
                    <th className="text-start p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recon.lines || []).map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2">{CATEGORY_LABEL[l.category] || l.category}</td>
                      <td className="p-2 font-mono text-xs">…{String(l.user_id || "—").slice(-6)}</td>
                      <td className="p-2 text-end tabular-nums">{Number(l.expected_amount || 0).toFixed(2)}</td>
                      <td className="p-2 text-end tabular-nums">{Number(l.actual_amount || 0).toFixed(2)}</td>
                      <td className="p-2 text-end tabular-nums">{l.actual_count}/{l.expected_count}</td>
                      <td className="p-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_STYLE[l.status])}>{l.status}</span>
                        {l.note && <span className="ms-2 text-xs text-muted-foreground">{l.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="rounded-xl border border-border p-3">
              <summary className="text-sm font-semibold cursor-pointer">
                Wallet transactions ({(recon.transactions || []).length})
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {(recon.transactions || []).map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="p-1.5">{new Date(t.created_date).toLocaleString("en-GB")}</td>
                        <td className="p-1.5">{t.type}</td>
                        <td className="p-1.5 font-mono">…{String(t.user_id || "").slice(-6)}</td>
                        <td className="p-1.5 text-end tabular-nums">{Number(t.amount).toFixed(2)}</td>
                        <td className="p-1.5">{t.status}</td>
                        <td className="p-1.5 text-muted-foreground">{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
