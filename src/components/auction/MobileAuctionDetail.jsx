import React, { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  Users, Clock, TrendingUp, ArrowLeft, AlertTriangle, Zap,
  Heart, Share2, Plus, Minus, Trophy, X
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { formatCountdown, formatCountdownCompact, formatDuration, timeRemaining } from "@/lib/auction";
import { useNow } from "@/lib/useNow";
import MyBidsCard from "@/components/auction/MyBidsCard";
import PullToRefresh from "@/components/PullToRefresh";
import BottomSheet from "@/components/ui/bottom-sheet";
import useSwipe from "@/lib/useSwipe";
import { Money } from "@/lib/currency";
import { cn } from "@/lib/utils";
import Leaderboard from "@/components/auction/Leaderboard";
import SealedBidPanel from "@/components/auction/SealedBidPanel";
import BidPaceMeter from "@/components/auction/BidPaceMeter";
import { isClosestMode } from "@/lib/auction";
import WinnerCelebration from "@/components/auction/WinnerCelebration";
import WinnerClaim from "@/components/auction/WinnerClaim";
import WinnerAnnouncement from "@/components/auction/WinnerAnnouncement";
import BidConfirm from "@/components/auction/BidConfirm";


function MiniCountdown({ remaining, total, status, t, seatsFull = true }) {
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const idle = status !== "live";
  const ended = status === "ended";
  const urgent = status === "live" && seatsFull && frac <= 0.25;
  const text = status === "live" ? formatCountdownCompact(remaining, t) : null;
  const a11y = status === "live"
    ? `${t.auction.timeRemaining}: ${formatCountdownCompact(remaining, t)}`
    : ended
      ? t.auction.statusEnded
      : t.auction.statusOpen;
  const statusLabel = idle
    ? (ended ? t.auction.statusEnded : t.auction.statusOpen)
    : !seatsFull
      ? t.auction.waitingSeatsPill
      : urgent
        ? t.auction.endingSoon
        : t.auction.closingPill;
  return (
     <div role="timer" aria-label={a11y} className="timer-glow min-w-0 rounded-lg px-3 py-2 text-center">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{t.auction.timeRemaining}</p>
      <m.p
        aria-live="off"
        animate={urgent ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
        transition={urgent ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
         className={cn("mt-1 font-mono text-xl font-extrabold tabular-nums text-primary", urgent && "text-destructive")}
      >
        {text || (ended ? t.auction.statusEnded : t.auction.statusOpen)}
      </m.p>
      <span role="status" className={cn("mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold", ended ? "text-muted-foreground" : idle ? "text-success" : urgent ? "text-destructive" : "text-primary")}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel}
      </span>
    </div>
  );
}




/** Screen 06 auction room clock: three gold-bordered segments. */
function RoomCountdown({ auction, status, t }) {
  // Reads the shared clock itself, so only this clock re-renders every second.
  const now = useNow(status === "live");
  const remaining = status === "live" ? timeRemaining(auction, now) : 0;
  const total = Math.max(0, Math.floor(remaining / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  // Long auctions swap seconds for days so the clock stays three tidy cells.
  const cells = days > 0
    ? [
        { value: pad(days), label: t.common.days || "d" },
        { value: pad(hours), label: t.auction.hourLabel },
        { value: pad(minutes), label: t.auction.minuteLabel },
      ]
    : [
        { value: pad(hours), label: t.auction.hourLabel },
        { value: pad(minutes), label: t.auction.minuteLabel },
        { value: pad(seconds), label: t.auction.secondLabel },
      ];
  if (status !== "live") {
    return (
      <div className="rounded-2xl border border-primary/35 bg-background/60 px-4 py-4 text-center">
        <p className="font-display text-xl font-extrabold text-primary">
          {status === "ended" ? t.auction.statusEnded : t.auction.statusOpen}
        </p>
      </div>
    );
  }
  return (
    <div
      role="timer"
      aria-label={t.auction.timeRemaining}
      className="flex items-stretch justify-center gap-2 rounded-2xl border border-primary/35 bg-background/60 px-3 py-3 shadow-[0_0_28px_-14px_hsl(var(--primary)/0.8)]"
      dir="ltr"
    >
      {cells.map((c, i) => (
        <React.Fragment key={c.label}>
          {i > 0 && <span className="self-center font-display text-2xl font-extrabold text-primary/70">:</span>}
          <div className="min-w-[62px] rounded-xl bg-card px-2 py-2 text-center">
            <p className="font-mono text-[26px] font-extrabold leading-none text-primary tabular-nums">{c.value}</p>
            <p className="mt-1 text-[9px] font-bold text-muted-foreground">{c.label}</p>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Overlapping bidder avatars, like the reference room header. */
function BidderStack({ bids = [], names }) {
  const seen = [];
  bids.forEach((b) => { if (b?.user_id && !seen.includes(b.user_id)) seen.push(b.user_id); });
  const shown = seen.slice(0, 3);
  const extra = Math.max(0, seen.length - shown.length);
  if (!seen.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {shown.map((id, i) => (
          <span
            key={id}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-extrabold text-primary",
              i > 0 && "-ms-2.5"
            )}
          >
            {(names?.[id] || "•").slice(0, 2)}
          </span>
        ))}
      </div>
      {extra > 0 && <span className="text-[10px] font-bold text-muted-foreground tabular-nums">+{extra}</span>}
    </div>
  );
}

function IconBtn({ onClick, label, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="tap-44 h-11 w-11 rounded-full border border-border/60 bg-card/90 text-foreground shadow-sm backdrop-blur-xl active:scale-95"
    >
      {children}
    </Button>
  );
}

function StatCell({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0 text-accent" /><span className="truncate">{label}</span></div>
      <p className="mt-1 text-sm font-extrabold text-foreground truncate">{value}</p>
    </div>
  );
}

export default function MobileAuctionDetail({
  auction, bids, user, status, totalMs, nextBid,
  bidAmount, setBidAmount, maxBid, setMaxBid, onBid, onJoin,
  actionLoading, subscribed, watched, onWatch, onShare, outbid,
  filled, seatsLeft, symbol, backTo, onRefresh, sealed: sealedProp, bidState,
  onBuyCredits, buyingCredits, balance
}) {
  const { t, dir } = useI18n();
  const [bidOpen, setBidOpen] = useState(false);
  const navigate = useNavigate();

  const [claimOpen, setClaimOpen] = useState(false);
  // Screen 06: review step between typing a bid and saving it.
  const [confirmAmount, setConfirmAmount] = useState(null);
  const [placed, setPlaced] = useState(false);

  const requestBid = () => {
    setPlaced(false);
    setConfirmAmount(Number(bidAmount || nextBid));
  };
  const confirmBid = async () => {
    const res = await onBid?.();
    if (res === false) { setConfirmAmount(null); return; }
    setPlaced(true);
  };
  const closeBidSheet = () => { setBidOpen(false); setConfirmAmount(null); setPlaced(false); };

  const live = status === "live";
  const sealed = sealedProp ?? isClosestMode(auction);
  const isWinner = status === "ended" && auction.winner_id === user?.id;
  const base = bidAmount || nextBid;
  const chips = [
    { label: t.auction.chipMin, value: nextBid },
    { label: "+1", value: base + 1 },
    { label: "+5", value: base + 5 },
    { label: "+10", value: base + 10 }
  ];
  const bump = (d) => setBidAmount(Number((((bidAmount || nextBid) + d)).toFixed(2)));

  const showBidToggle = subscribed && (live || status === "open");
  const showBoardToggle = showBidToggle;

  const closeQuota =
    Number(auction.min_participants || 0) || Number(auction.max_subscribers || 0) || 0;
  const seatsFull = closeQuota
    ? (auction.subscriber_ids || []).length >= closeQuota
    : true;

  // Swipe from the leading edge goes back, like a native detail screen.
  const swipeRef = useSwipe({
    onSwipeLeft: () => false,
    onSwipeRight: () => navigate({ to: backTo }),
    threshold: 80
  });

  return (
    <>

    <PullToRefresh
      onRefresh={onRefresh}
      dir={dir}
      className="app-shell fixed! top-0! z-30 flex flex-col bg-background overscroll-contain page-transition sm:top-(--app-header-h)!"
      
      innerClassName="flex flex-col min-h-full"
    >
      {/* Native header controls above the product image */}
      <div
        dir="ltr"
        className="z-40 flex items-center justify-between gap-2 bg-background/95 px-3 py-2.5 pt-safe backdrop-blur-xl"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={backTo}
            aria-label={t.auction.back}
            className="tap-44 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border/60 bg-card text-foreground shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold",
              live
                ? "theme-badge-live-soft"
                : "border-border bg-card text-foreground"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", live ? "bg-current animate-pulse" : "bg-muted-foreground")} />
            {live ? t.street.live : status === "ended" ? t.auction.statusEnded : t.auction.statusOpen}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 text-[11px] font-bold text-foreground">
            <Users className="h-4 w-4 text-accent" />
            <span className="tabular-nums">{filled}</span>
          </span>
          <IconBtn onClick={onWatch} label={t.auction.watch}>
            <Heart className={cn("h-5 w-5", watched && "fill-current text-primary")} />
          </IconBtn>
          <IconBtn onClick={onShare} label={t.auction.share}>
            <Share2 className="h-5 w-5" />
          </IconBtn>
        </div>
      </div>

      {/* Product image */}
      <div className="relative h-[238px] shrink-0 bg-muted sm:h-[280px]">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full" fittingType="fill" />
      </div>

      {/* BODY */}
      <div ref={swipeRef} className="flex flex-col px-5 pb-36 pt-5 text-foreground">
        {/* Screen 06 room card: title, big clock, bidders and top bid */}
        <div className="native-panel rounded-2xl px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[20px] font-extrabold leading-tight text-foreground">{auction.title}</h1>
              {auction.description && (
                <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{auction.description}</p>
              )}
            </div>
            <span className="mt-1 shrink-0 text-muted-foreground">
              <ArrowLeft className={cn("h-4 w-4", "rotate-180")} />
            </span>
          </div>

          <div className="mt-3">
            <RoomCountdown auction={auction} status={status} t={t} />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <BidderStack bids={bids} names={bidState?.names} />
            <div className="min-w-0 text-end">
              <p className="text-[10px] font-bold text-muted-foreground">
                {sealed ? t.auction.sealedTarget : t.auction.topBid}
              </p>
              <Money
                amount={sealed ? (status === "ended" ? auction.current_price : auction.target_price) : auction.current_price}
                className="mt-1 block truncate font-display text-[26px] font-extrabold leading-none text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.25)]"
                codeClassName="text-xs text-primary/60"
              />
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                {t.auction.bidIncrement} <span className="tabular-nums">{symbol}{Number(auction.bid_increment || 0)}</span>
              </p>
            </div>
          </div>

          {showBidToggle && (
            <Button
              onClick={() => setBidOpen(true)}
              disabled={!live}
              className="gold-button mt-4 h-12 w-full gap-2 rounded-xl text-[15px] font-extrabold shadow-md active:scale-[0.99]"
            >
              <Zap className="h-4 w-4" /> {t.auction.bidNowCta}
            </Button>
          )}
        </div>


         <div className="native-panel mt-3 grid grid-cols-3 divide-x divide-border rounded-lg">
          <StatCell icon={Users} label={t.auction.seats} value={`${filled}/${auction.max_subscribers}`} />
          <StatCell icon={Clock} label={t.auction.duration} value={formatDuration(auction.duration_minutes, t)} />
          <StatCell icon={TrendingUp} label={t.auction.bidIncrement} value={<>+<Money amount={auction.bid_increment} /></>} />
        </div>

        {subscribed && <MyBidsCard auction={auction} bidState={bidState} className="mt-3" />}

        {outbid && live && !sealed && (
           <div className="mt-2 rounded-lg bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 flex items-center gap-1.5 text-[12px] text-destructive font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> {t.auction.outbidAlert}
          </div>
        )}

        <div className="mt-5 space-y-5">
          {status !== "ended" && (
          <section>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-foreground" id="seats-label">{t.auction.seats}</span>
              <span className="text-muted-foreground tabular-nums" aria-hidden="true">{filled}/{auction.max_subscribers}</span>
            </div>
            <div
              role="progressbar"
              aria-labelledby="seats-label"
              aria-valuemin={0}
              aria-valuemax={auction.max_subscribers}
              aria-valuenow={filled}
              aria-valuetext={`${filled} / ${auction.max_subscribers}`}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <m.div
                className="relative h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${auction.max_subscribers ? Math.min(100, (filled / auction.max_subscribers) * 100) : 0}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              >
                {seatsLeft > 0 && (
                  <m.span
                    className="absolute inset-0 rounded-full bg-primary-foreground/25"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: "40%" }}
                    aria-hidden="true"
                  />
                )}
              </m.div>
            </div>
          </section>
          )}
          {auction.description && (
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{auction.description}</p>
          )}
        </div>

        {/* Action area (pinned bottom; scrollable when the ended-state cards are tall) */}
        <div className="space-y-2.5 mt-2.5">
          {/* Winner state */}
          {isWinner && (
            <WinnerCelebration status={status} auction={auction} userId={user?.id} />
          )}
          {status === "ended" && !isWinner && (
            <WinnerAnnouncement auction={auction} status={status} />
          )}
          {status === "ended" && (
            <Link
              to="/auction/$id/results" params={{ id: auction.id }}
              className="cyan-button flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold"
            >
              <Trophy className="h-4 w-4" /> {t.auction.results || "Results"}
            </Link>
          )}
          {isWinner && (
            <Button onClick={() => setClaimOpen(true)} className="gold-button h-11 w-full gap-2 font-bold">
              <Trophy className="w-4 h-4" /> {t.fulfilment.claim}
            </Button>
          )}

          {/* Join CTA */}
          {status !== "ended" && !subscribed && (
            <div className="space-y-1.5">
              <Button onClick={onJoin} disabled={actionLoading} className="gold-button h-12 w-full rounded-xl text-[15px] font-bold shadow-md">
                {actionLoading ? t.auction.joining : t.auction.join.replace("{fee}", `${symbol}${Number(auction.entry_fee || 0)}`)}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                {seatsLeft > 0
                  ? <>{status === "open" && <>{t.auction.startsWhenFull} · </>}{t.auction.seatsLeft.replace("{count}", seatsLeft)}</>
                  : t.auction.seatsTargetMet}
              </p>
            </div>
          )}

          {subscribed && status === "open" && (
            <div className="rounded-xl bg-card border border-border p-3 text-center text-[13px] text-muted-foreground">{t.auction.startsWhenFull}</div>
          )}

          {/* One clean activity section; the full history expands naturally. */}
          {showBoardToggle && (
            <section className="mt-3">
              <Leaderboard bids={bids} currentUserId={user?.id} live={live} closest={sealed} target={Number(auction.target_price || 0)} names={bidState?.names} allBids={bidState?.all} />
            </section>
          )}
        </div>
      </div>

      {/* Claim overlay sheet (no page scroll) */}
      <AnimatePresence>
        {claimOpen && (
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/80 flex items-end"
            onClick={() => setClaimOpen(false)}
          >
            <m.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[85%] bg-card rounded-t-3xl overflow-hidden flex flex-col border-t border-border"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
                <span className="font-display font-bold text-foreground flex items-center gap-2"><Trophy className="w-4 h-4 text-foreground" />{t.fulfilment.claim}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setClaimOpen(false)} className="rounded-full bg-muted">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {/* Only the claim form scrolls; the title bar stays put. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                <WinnerClaim auction={auction} user={user} />
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <BottomSheet open={bidOpen} onClose={closeBidSheet} title={t.auction.placeBid} icon={Zap}>
            {confirmAmount != null ? (
              <BidConfirm
                auction={auction}
                amount={confirmAmount}
                balance={balance}
                bidState={bidState}
                loading={actionLoading}
                placed={placed}
                onConfirm={confirmBid}
                onCancel={() => setConfirmAmount(null)}
                onClose={closeBidSheet}
              />
            ) : (
            <div className="space-y-3">
              {live && <BidPaceMeter rate={bidState?.rate} onExpire={onRefresh} compact />}
              {live && sealed ? (
                <SealedBidPanel
                  auction={auction}
                  bidState={bidState}
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  onBid={requestBid}
                  actionLoading={actionLoading}
                  symbol={symbol}
                  onBuyCredits={onBuyCredits}
                  buyingCredits={buyingCredits}
                  balance={balance}
                  compact
                />
              ) : live ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{t.auction.yourBid}</span>
                    <span className="text-[10px] text-muted-foreground">{t.auction.minBid}: <Money amount={nextBid} /></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => bump(-1)} className="h-10 w-10 rounded-xl active:scale-95">
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number" min={nextBid} value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      className="h-10 bg-card text-center text-base font-bold text-foreground placeholder:text-muted-foreground"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => bump(1)} className="h-10 w-10 rounded-xl active:scale-95">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {chips.map((c) => (
                      <Button key={c.label} type="button" variant="outline" size="sm" onClick={() => setBidAmount(Number(c.value.toFixed(2)))}
                        className="h-8 rounded-lg px-2 text-[11px] font-bold hover:bg-primary hover:text-primary-foreground">
                        {c.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={requestBid}
                    disabled={actionLoading}
                    className="gold-button h-13 min-h-[52px] w-full gap-2 rounded-2xl text-[15px] font-bold shadow-md active:scale-[0.98]"
                  >
                    {actionLoading ? t.auction.bidding : <span className="flex items-center gap-2"><Zap className="w-4 h-4" />{t.auction.placeBid} · <Money amount={Number(bidAmount || nextBid)} /></span>}
                  </Button>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0"><Zap className="w-3 h-3 text-foreground" />{t.auction.maxBid}</label>
                    <Input type="number" min={0} value={maxBid} onChange={(e) => setMaxBid(Number(e.target.value) || 0)} placeholder="0.00"
                      className="h-8 bg-card text-sm text-foreground placeholder:text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-card border border-border p-3 text-[13px] text-muted-foreground text-center">{t.auction.notLive}</div>
              )}
            </div>
            )}
      </BottomSheet>
    </PullToRefresh>

    </>
  );
}