import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogForm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { hoursToMinutes, minutesToHours, formatDuration } from "@/lib/auction";
import ImagePicker from "@/components/admin/ImagePicker";
import { useDiscardGuard } from "@/components/admin/ConfirmDialog";
import SelectField from "@/components/ui/select-field";
import { allowedStatuses, actionFor, runLifecycle, LOCKED_WHILE_LIVE } from "@/lib/auctionLifecycle";
import AuctionHistory from "@/components/admin/AuctionHistory";

const inputCls = "w-full rounded-lg border border-accent/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({ title, children }) {
  return (
    <section className="native-panel rounded-xl p-4 space-y-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-accent">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return <FormField label={label} labelClassName="text-sm font-medium">{children}</FormField>;
}

export default function AuctionFormDialog({ auction, open, onOpenChange, onSaved }) {
  const { t } = useI18n();
  const { markDirty, guard } = useDiscardGuard(open);
  const isEdit = !!auction;
  // Price, duration, seats and fees are frozen while live (guard_auction_writes).
  const live = isEdit && auction.status === "live";
  const [form, setForm] = useState({
    title: "", description: "", image_url: "",
    entry_fee: 10, max_subscribers: 10, min_participants: 0, start_price: 0,
    bid_increment: 1, duration_hours: 1, status: "open",
    scheduled_start_time: "", mode: "highest", target_price: 0, bid_fee: 0, bids_per_participant: 5, extra_bid_price: 0,
    bid_rate_limit: 0, bid_rate_window_minutes: 10, min_round_minutes: 5, pool_warn_pct: 20, max_restarts: 3, anti_snipe_seconds: 0, hold_retry_minutes: 1440,
    cost_price: 0, other_cost: 0
  });
  const [saving, setSaving] = useState(false);
  // The price of one bid is normally derived from the two numbers the admin
  // already sets: entry (join) fee x bid increment. It can still be overridden.
  const [autoBidFee, setAutoBidFee] = useState(true);
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const computedBidFee = round2((Number(form.entry_fee) || 0) * (Number(form.bid_increment) || 0));
  const effectiveBidFee = autoBidFee ? computedBidFee : Math.max(0, round2(form.bid_fee));
  // Numbers each participant gets = what they paid to join divided by the bid
  // step, so a $20 join with a $0.10 step buys 200 numbers.
  const [autoQuota, setAutoQuota] = useState(true);
  // "Unlimited" means the only limit is what the participant can pay for:
  // stored as 0 numbers per participant, which the bid engine reads as no cap.
  const [unlimitedQuota, setUnlimitedQuota] = useState(false);
  const computedQuota = Math.max(
    1,
    Math.round((Number(form.entry_fee) || 0) / (Number(form.bid_increment) || 1))
  );
  const effectiveQuota = unlimitedQuota
    ? 0
    : (autoQuota ? computedQuota : Math.max(1, Number(form.bids_per_participant) || 1));

  useEffect(() => {
    if (auction) {
      setForm({
        title: auction.title || "", description: auction.description || "",
        image_url: auction.image_url || "",
        entry_fee: auction.entry_fee ?? 10, max_subscribers: auction.max_subscribers ?? 10,
        min_participants: auction.min_participants ?? 0,
        start_price: auction.start_price ?? 0,
        bid_increment: auction.bid_increment ?? 1, duration_hours: minutesToHours(auction.duration_minutes ?? 60),
        status: auction.status || "open",
        scheduled_start_time: auction.scheduled_start_time ? auction.scheduled_start_time.slice(0, 16) : "",
        mode: auction.mode || "highest",
        target_price: auction.target_price ?? 0,
        bid_fee: auction.bid_fee ?? 0,
        bids_per_participant: auction.bids_per_participant ?? 5,
        extra_bid_price: auction.extra_bid_price ?? 0,
        bid_rate_limit: auction.bid_rate_limit ?? 0,
        bid_rate_window_minutes: auction.bid_rate_window_minutes ?? 10,
        min_round_minutes: auction.min_round_minutes ?? 5,
        max_restarts: auction.max_restarts ?? 3,
        anti_snipe_seconds: auction.anti_snipe_seconds ?? 0,
        hold_retry_minutes: auction.hold_retry_minutes ?? 1440,
        pool_warn_pct: auction.pool_warn_pct ?? 20,
        cost_price: auction.cost_price ?? 0,
        other_cost: auction.other_cost ?? 0
      });
      const auto = Math.round((auction.entry_fee ?? 0) * (auction.bid_increment ?? 0) * 100) / 100;
      setAutoBidFee(Math.round((auction.bid_fee ?? 0) * 100) / 100 === auto);
      const autoQ = Math.max(1, Math.round((auction.entry_fee ?? 0) / (auction.bid_increment || 1)));
      setUnlimitedQuota(Number(auction.bids_per_participant ?? 0) === 0);
      setAutoQuota(Number(auction.bids_per_participant ?? 0) === autoQ);
    } else {
      setAutoBidFee(true);
      setAutoQuota(true);
      setUnlimitedQuota(false);
      setForm({ title: "", description: "", image_url: "", entry_fee: 10, max_subscribers: 10, min_participants: 0, start_price: 0, bid_increment: 1, duration_hours: 1, status: "open", scheduled_start_time: "", mode: "highest", target_price: 0, bid_fee: 0, bids_per_participant: 5, extra_bid_price: 0, bid_rate_limit: 0, bid_rate_window_minutes: 10, min_round_minutes: 5, pool_warn_pct: 20, max_restarts: 3, anti_snipe_seconds: 0, hold_retry_minutes: 1440, cost_price: 0, other_cost: 0 });
    }
  }, [auction, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const L = t.admin.lifecycle;
  // Status changes run a lifecycle action on save; only allowed moves are offered.
  const storedStatus = isEdit ? auction.status || "open" : "open";
  const statusName = {
    open: t.auction.statusOpen, live: t.auction.statusLive, ended: t.auction.statusEnded,
    voided: L.voided, voiding: L.voided, archived: L.archived
  };
  const moveName = {
    startAuction: t.admin.confirm.startLabel,
    closeAuction: t.admin.live?.endNow || t.admin.confirm.closeLabel,
    relaunchAuction: L.relaunch,
    archiveAuction: L.archive
  };
  const statusOptions = allowedStatuses(storedStatus).map((s) => ({
    value: s,
    label: s === storedStatus ? statusName[s] : moveName[actionFor(storedStatus, s)] || statusName[s]
  }));

  const modeOptions = [
    { value: "highest", label: t.admin.fields.modeHighest || "Highest bid" },
    { value: "closest", label: t.admin.fields.modeClosest || "Closest to price" }
  ];

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t.admin.fields.title); return; }
    if (form.mode === "closest" && !(Number(form.target_price) > 0)) {
      toast.error(t.admin.fields.targetPrice || "Selling price (target)");
      return;
    }
    if (form.mode === "closest" && unlimitedQuota && !(effectiveBidFee > 0)) {
      toast.error(t.admin.fields.bidsUnlimitedHint || "Set a fee per bid above 0 for unlimited bidding.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        image_url: form.image_url.trim(),
        entry_fee: Number(form.entry_fee),
        max_subscribers: Number(form.max_subscribers),
        // No maximum exists: the single configured number is the minimum target.
        min_participants: Number(form.max_subscribers) || 0,
        start_price: Number(form.start_price),
        bid_increment: Number(form.bid_increment),
        duration_minutes: hoursToMinutes(form.duration_hours),
        scheduled_start_time: form.scheduled_start_time ? new Date(form.scheduled_start_time).toISOString() : null,
        mode: form.mode,
        target_price: form.mode === "closest" ? Number(form.target_price) || 0 : null,
        bid_fee: form.mode === "closest" ? Math.max(0, effectiveBidFee) : 0,
        bids_per_participant: effectiveQuota,
        extra_bid_price: form.mode === "closest" ? Math.max(0, Number(form.extra_bid_price) || 0) : 0,
        bid_rate_limit: Math.max(0, Number(form.bid_rate_limit) || 0),
        bid_rate_window_minutes: Math.max(1, Number(form.bid_rate_window_minutes) || 10),
        min_round_minutes: Math.max(0, Number(form.min_round_minutes) || 0),
        max_restarts: Math.max(0, Number(form.max_restarts) || 0),
        anti_snipe_seconds: Math.max(0, Number(form.anti_snipe_seconds) || 0),
        hold_retry_minutes: Math.max(0, Number(form.hold_retry_minutes) || 0),
        pool_warn_pct: Math.min(100, Math.max(0, Number(form.pool_warn_pct) || 0)),
        cost_price: Math.max(0, Number(form.cost_price) || 0),
        other_cost: Math.max(0, Number(form.other_cost) || 0)
      };
      // Status, timer, round and price are the server's. A live auction only
      // takes its unlocked fields (the database refuses the rest anyway).
      if (live) LOCKED_WHILE_LIVE.forEach((k) => delete payload[k]);
      let id = auction?.id;
      if (isEdit) {
        await base44.entities.Auction.update(auction.id, payload);
      } else {
        payload.status = "open";
        payload.current_price = payload.start_price;
        payload.subscriber_ids = [];
        id = (await base44.entities.Auction.create(payload))?.id;
      }
      // A changed status runs its lifecycle action (Start, End now, Relaunch, Archive).
      const action = actionFor(storedStatus, form.status);
      if (action && id) await runLifecycle(action, id);
      toast.success(t.admin.saved);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Bidding pace: inline advice + hard validation -----------------------
  const paceLimit = Math.max(0, Number(form.bid_rate_limit) || 0);
  const paceWindow = Math.max(1, Number(form.bid_rate_window_minutes) || 10);
  const durationMins = hoursToMinutes(form.duration_hours) || 0;
  const quota = effectiveQuota;
  const windowsInAuction = paceWindow > 0 ? Math.floor(durationMins / paceWindow) : 0;
  const maxBidsOverAuction = paceLimit > 0 ? windowsInAuction * paceLimit : Infinity;
  const paceIssues = [];
  const F = t.admin.fields;
  const fmt = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  if (paceLimit > 0) {
    if (paceWindow > durationMins && durationMins > 0) {
      paceIssues.push({
        level: "error",
        text: fmt(F.paceWindowTooLong, {
          window: paceWindow,
          duration: durationMins,
          limit: paceLimit,
          suggest: Math.max(1, Math.floor(durationMins / 2)),
        }),
      });
    }
    paceIssues.push({
      level: "info",
      text: fmt(F.paceResult, {
        limit: paceLimit,
        window: paceWindow,
        windows: windowsInAuction,
        total: Number.isFinite(maxBidsOverAuction) ? maxBidsOverAuction : "∞",
      }),
    });
    if (form.mode === "closest" && Number.isFinite(maxBidsOverAuction) && maxBidsOverAuction < quota) {
      paceIssues.push({
        level: "warn",
        text: fmt(F.paceConflict, { quota, total: maxBidsOverAuction }),
      });
    }
    if (form.mode === "closest" && paceLimit >= quota) {
      paceIssues.push({
        level: "warn",
        text: fmt(F.paceWeak, { limit: paceLimit, quota, suggest: Math.max(1, Math.ceil(quota / 3)) }),
      });
    }
  } else {
    paceIssues.push({ level: "info", text: F.paceOff });
  }
  // ---- Closest mode: number space advice (never blocks saving) ----
  // The pool is counted in integer cents: each whole unit holds 100 numbers.
  // The auction shortens its own timer as free numbers run out, so a small pool
  // just means a shorter round, not a broken auction.
  const poolIssues = [];
  if (form.mode === "closest") {
    const stepCents = Math.round((Number(form.bid_increment) || 0) * 100);
    const targetCents = Math.round((Number(form.target_price) || 0) * 100);
    const seats = Math.max(1, Number(form.max_subscribers) || 1);
    const slots = stepCents > 0 && targetCents > 0 ? Math.floor(targetCents / stepCents) : 0;
    const totalBids = seats * quota;
    if (slots > 0) {
      if (slots <= totalBids) {
        poolIssues.push({
          level: "warn",
          text: fmt(F.poolSmall, { slots, total: totalBids, seats, quota }),
        });
      } else if (slots < totalBids * 3) {
        poolIssues.push({
          level: "warn",
          text: fmt(F.poolTight, { slots, total: totalBids, suggest: totalBids * 3 }),
        });
      }
    }
  }



  const paceBlocked = paceIssues.some((i) => i.level === "error");

  return (
    <Dialog open={open} onOpenChange={guard(onOpenChange)}>
      <DialogContent onChange={markDirty}>
        <DialogForm onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t.admin.edit : t.admin.new}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {live && (
              <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{L.lockedWhileLive}</p>
            )}
            <Section title={t.admin.fields.sectionBasics || "Basics"}>
            <Field label={t.admin.fields.title}>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label={t.admin.fields.description}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
            </Field>
            <Field label={t.admin.fields.imageUrl}>
              <ImagePicker value={form.image_url} onChange={(v) => set("image_url", v)} label={t.admin.fields.imageUrl} />
            </Field>
            </Section>
  
            <Section title={t.admin.fields.sectionMode || "Auction type & numbers"}>
            <fieldset disabled={live} className="contents">
            <Field label={t.admin.fields.mode || "Auction type"}>
              <SelectField value={form.mode} onChange={(e) => set("mode", e.target.value)} className={inputCls}>
                {modeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectField>
            </Field>
            </fieldset>
            {form.mode === "closest" && (
              <>
                <fieldset disabled={live} className="contents">
                <Field label={t.admin.fields.targetPrice || "Selling price (target)"}>
                  <Input type="number" min="0" step="0.01" value={form.target_price} onChange={(e) => set("target_price", e.target.value)} />
                </Field>
                <Field label={t.admin.fields.bidFee || "Fee charged per bid (0 = free)"}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={autoBidFee ? computedBidFee : form.bid_fee}
                    readOnly={autoBidFee}
                    onChange={(e) => set("bid_fee", e.target.value)}
                    className={autoBidFee ? "bg-muted/60" : undefined}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={autoBidFee}
                      onChange={(e) => {
                        setAutoBidFee(e.target.checked);
                        if (e.target.checked) set("bid_fee", computedBidFee);
                      }}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {t.admin.fields.bidFeeAuto || "Calculate from entry fee x bid increment"}
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {autoBidFee
                      ? `${Number(form.entry_fee) || 0} x ${Number(form.bid_increment) || 0} = ${computedBidFee} ${t.admin.fields.bidFeePerBid || "per bid"}`
                      : (t.admin.fields.bidFeeHint || "Deducted from the participant's wallet on every number they submit.")}
                  </p>
                </Field>
                <Field label={t.admin.fields.extraBidPrice || "Price per extra number (0 = cannot buy)"}>
                  <Input type="number" min="0" step="0.01" value={form.extra_bid_price} onChange={(e) => set("extra_bid_price", e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.extraBidPriceHint || "After using their free numbers, a participant can buy more at this price from their wallet."}</p>
                </Field>
                <Field label={t.admin.fields.bidsPerParticipant || "Numbers per participant"}>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={unlimitedQuota ? "" : (autoQuota ? computedQuota : form.bids_per_participant)}
                    placeholder={unlimitedQuota ? "∞" : undefined}
                    readOnly={autoQuota || unlimitedQuota}
                    disabled={unlimitedQuota}
                    onChange={(e) => set("bids_per_participant", e.target.value)}
                    className={autoQuota || unlimitedQuota ? "bg-muted/60" : undefined}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={unlimitedQuota}
                      onChange={(e) => {
                        setUnlimitedQuota(e.target.checked);
                        if (e.target.checked) {
                          setAutoQuota(false);
                          set("bids_per_participant", 0);
                        } else {
                          setAutoQuota(true);
                          set("bids_per_participant", computedQuota);
                        }
                      }}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {t.admin.fields.bidsUnlimited || "Unlimited bids — only the wallet balance limits them"}
                  </label>
                  {!unlimitedQuota && (
                    <label className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={autoQuota}
                        onChange={(e) => {
                          setAutoQuota(e.target.checked);
                          if (e.target.checked) set("bids_per_participant", computedQuota);
                        }}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      {t.admin.fields.bidsPerParticipantAuto || "Calculate from entry fee / bid increment"}
                    </label>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {unlimitedQuota
                      ? (t.admin.fields.bidsUnlimitedHint || "Participants keep bidding as long as their balance covers the fee per bid.")
                      : autoQuota
                        ? `${Number(form.entry_fee) || 0} / ${Number(form.bid_increment) || 0} = ${computedQuota}`
                        : (t.admin.fields.bidsPerParticipantHint || "Every participant gets the same amount of numbers.")}
                  </p>
                </Field>
                </fieldset>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t.admin.fields.minRoundMinutes || "Minimum round length (minutes)"}>
                    <Input type="number" min="0" step="1" value={form.min_round_minutes} onChange={(e) => set("min_round_minutes", e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.minRoundMinutesHint || "Fairness guard: the automatic time reduction can never end the round earlier than this."}</p>
                  </Field>
                  <Field label={t.admin.fields.poolWarnPct || "Low number-pool warning (% free)"}>
                    <Input type="number" min="0" max="100" step="1" value={form.pool_warn_pct} onChange={(e) => set("pool_warn_pct", e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.poolWarnPctHint || "The live monitor flashes a warning once free numbers drop to this share of the pool."}</p>
                  </Field>
                </div>
                {poolIssues.length > 0 && (
                  <div className="space-y-1.5">
                    {poolIssues.map((issue, i) => (
                      <p key={i} className="rounded-md bg-warning/10 px-2 py-1.5 text-[11px] font-semibold text-warning">
                        {issue.text}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.admin.fields.antiSnipe || "Anti-sniping extension (seconds, 0 = off)"}>
                <Input type="number" min="0" step="1" value={form.anti_snipe_seconds} onChange={(e) => set("anti_snipe_seconds", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.antiSnipeHint || "A bid placed inside this window before the end pushes the deadline forward by the same number of seconds."}</p>
              </Field>
              <Field label={t.admin.fields.holdRetry || "Winner payment window (minutes)"}>
                <Input type="number" min="0" step="1" value={form.hold_retry_minutes} onChange={(e) => set("hold_retry_minutes", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.holdRetryHint || "How long the winner's funds stay reserved while their manual payment is pending. Afterwards the reservation is released automatically."}</p>
              </Field>
            </div>
            <Field label={t.admin.fields.maxRestarts || "Maximum round restarts"}>
              <Input type="number" min="0" step="1" value={form.max_restarts} onChange={(e) => set("max_restarts", e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.maxRestartsHint || "If the minimum participants are still not reached after this many restarts, the auction is voided and every fee is refunded."}</p>
            </Field>
            </Section>
  
            <Section title={t.admin.fields.sectionPace || "Bidding pace"}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t.admin.fields.bidRateLimit || "Bids allowed per time window (0 = unlimited)"}>
                  <Input type="number" min="0" step="1" value={form.bid_rate_limit} onChange={(e) => set("bid_rate_limit", e.target.value)} />
                </Field>
                <Field label={t.admin.fields.bidRateWindow || "Time window"}>
                  <SelectField value={String(form.bid_rate_window_minutes)} onChange={(e) => set("bid_rate_window_minutes", e.target.value)} className={inputCls}>
                    {[1, 5, 10, 30, 60].map((m) => (
                      <option key={m} value={m}>{formatDuration(m, t)}</option>
                    ))}
                  </SelectField>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{t.admin.fields.bidRateHint || "Paces bidding: a participant can place at most this many bids inside the chosen window."}</p>
              <div className="space-y-1.5">
                {paceIssues.map((issue, i) => (
                  <p
                    key={i}
                    className={
                      issue.level === "error"
                        ? "rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive"
                        : issue.level === "warn"
                          ? "rounded-md bg-warning/10 px-2 py-1.5 text-[11px] font-semibold text-warning"
                          : "rounded-md bg-info/10 px-2 py-1.5 text-[11px] text-info"
                    }
                  >
                    {issue.text}
                  </p>
                ))}
              </div>
            </Section>
  
            <Section title={t.admin.fields.sectionSchedule || "Money, participants & timing"}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <fieldset disabled={live} className="contents">
              <Field label={t.admin.fields.entryFee}><Input type="number" min="0" step="0.01" value={form.entry_fee} onChange={(e) => set("entry_fee", e.target.value)} /></Field>
              <Field label={t.admin.fields.minParticipants || "Participants needed to close (minimum)"}>
                <Input type="number" min="1" value={form.max_subscribers} onChange={(e) => set("max_subscribers", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.minParticipantsHint || "There is no maximum. Extra participants can always join; the round only closes once this many have joined and the timer has run out."}</p>
              </Field>
              </fieldset>
              <Field label={t.admin.fields.costPrice || "Product cost (what you pay)"}>
                <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{t.admin.fields.costPriceHint || "Used to calculate profit for this auction in the Revenue section."}</p>
              </Field>
              <Field label={t.admin.fields.otherCost || "Other costs (shipping, fees...)"}>
                <Input type="number" min="0" step="0.01" value={form.other_cost} onChange={(e) => set("other_cost", e.target.value)} />
              </Field>
              <fieldset disabled={live} className="contents">
              <Field label={t.admin.fields.startPrice}><Input type="number" min="0" step="0.01" value={form.start_price} onChange={(e) => set("start_price", e.target.value)} /></Field>
              <Field label={t.admin.fields.bidIncrement}><Input type="number" min="0.01" step="0.01" value={form.bid_increment} onChange={(e) => set("bid_increment", e.target.value)} /></Field>
              <Field label={t.admin.fields.durationMinutes}><Input type="number" min="0.25" step="any" value={form.duration_hours} onChange={(e) => set("duration_hours", e.target.value)} /></Field>
              </fieldset>
              <Field label={t.admin.fields.scheduledStart}><Input type="datetime-local" value={form.scheduled_start_time} onChange={(e) => set("scheduled_start_time", e.target.value)} /></Field>
              <Field label={t.admin.fields.status}>
                <SelectField value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls} disabled={statusOptions.length < 2}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectField>
                <p className="mt-1 text-xs text-muted-foreground">{L.statusHint}</p>
              </Field>
            </div>
            </Section>
            {isEdit && <AuctionHistory auctionId={auction.id} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => guard(onOpenChange)(false)}>{t.admin.cancel}</Button>
            <Button className="gold-button" type="submit" disabled={saving || paceBlocked}>{saving ? t.admin.saving : t.admin.save}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}