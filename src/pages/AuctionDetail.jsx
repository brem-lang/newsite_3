import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useOutletContext, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Clock, TrendingUp, ArrowLeft, AlertTriangle, Trophy, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useCurrency, Money } from "@/lib/currency";
import { effectiveStatus, timeRemaining, isSubscribed, formatDuration, formatCountdown, isClosestMode, validClosestAmount, closeQuota } from "@/lib/auction";
import { useWallet } from "@/lib/useWallet";
import { useNow, useRerenderAt } from "@/lib/useNow";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AuctionGallery from "@/components/auction/AuctionGallery";
import MyBidsCard from "@/components/auction/MyBidsCard";
import CountdownRing from "@/components/auction/CountdownRing";
import BidPanel from "@/components/auction/BidPanel";
import SealedBidPanel from "@/components/auction/SealedBidPanel";
import BidPaceMeter from "@/components/auction/BidPaceMeter";
import ActivityFeed from "@/components/auction/ActivityFeed";
import Leaderboard from "@/components/auction/Leaderboard";
import AuctionChat from "@/components/auction/AuctionChat";
import WinnerCelebration from "@/components/auction/WinnerCelebration";
import WatchShareBar from "@/components/auction/WatchShareBar";
import WinnerClaim from "@/components/auction/WinnerClaim";
import WinnerAnnouncement, { ParticipantQuota } from "@/components/auction/WinnerAnnouncement";
import AuctionTimeline from "@/components/auction/AuctionTimeline";
import MobileAuctionDetail from "@/components/auction/MobileAuctionDetail";

export default function AuctionDetail() {
  const { id } = useParams();
  const { t, dir } = useI18n();
  const { symbol } = useCurrency();
  const { user } = useOutletContext();
  const { balance, refresh: refreshWallet } = useWallet(user?.id);
  const isMobile = useMediaQueryLess640();

  const qc = useQueryClient();
  const { data: auction = null } = useQuery({
    queryKey: ["auction", id],
    queryFn: () => base44.entities.Auction.get(id),
    enabled: !!id,
    staleTime: 10_000,
  });
  const { data: bids = EMPTY } = useQuery({
    queryKey: ["bids", id],
    queryFn: () => base44.entities.Bid.filter({ auction_id: id, archived: false }, "-created_date", BID_PAGE),
    enabled: !!id,
    staleTime: 10_000,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState(0);
  const [maxBid, setMaxBid] = useState(0);
  const [bidState, setBidState] = useState({ burned: [], mine: [] });
  const [watched, setWatched] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [outbid, setOutbid] = useState(false);
  const prevHighest = useRef(null);
  const autoGuard = useRef(null);
  const pendingBidKey = useRef(null);
  const hittingBid = useRef(false);

  const load = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["auction", id] });
    qc.invalidateQueries({ queryKey: ["bids", id] });
  }, [qc, id]);

  // Sealed mode: burned numbers + the caller's own numbers come from the server
  // (other participants' active numbers are never sent to the client).
  const loadBidState = useCallback(() => {
    base44.functions
      .invoke("auctionBidState", { auction_id: id })
      .then((res) => { if (res?.data && !res.data.error) setBidState(res.data); })
      .catch(() => {});
  }, [id]);

  // Busy auctions produce many bid events per second; refresh the bid state at
  // most once per window instead of once per bid.
  const bidStateTimer = useRef(null);
  const loadBidStateSoon = useCallback(() => {
    if (bidStateTimer.current) return;
    bidStateTimer.current = setTimeout(() => {
      bidStateTimer.current = null;
      loadBidState();
    }, BID_STATE_THROTTLE_MS);
  }, [loadBidState]);
  useEffect(() => () => clearTimeout(bidStateTimer.current), []);

  // The auction clock lives in the database: ask the server to promote a due
  // auction to live (or settle an expired one) so bidding matches what is shown.
  // Only re-read the auction when the server says its state actually changed;
  // otherwise the realtime stream already has us up to date.
  const sync = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("syncAuction", { auction_id: id });
      const server = res?.data;
      const cur = qc.getQueryData(["auction", id]);
      if (!server || server.error || !cur) return;
      const sameEnd = timeOrNull(server.end_time) === timeOrNull(cur.end_time);
      if (server.status !== cur.status || !sameEnd) load();
    } catch {
      /* the countdown keeps rendering from the last known row */
    }
  }, [id, qc, load]);

  // Pull-to-refresh (mobile): an explicit full reload.
  const refreshAll = useCallback(async () => {
    await sync();
    load();
    loadBidState();
  }, [sync, load, loadBidState]);

  useEffect(() => {
    if (!id) return;
    sync();
    const poll = setInterval(() => { if (!document.hidden) sync(); }, 15000);
    // Only this auction's rows are streamed; each event is applied directly to
    // the cached data instead of triggering a re-fetch.
    const resync = () => { load(); loadBidState(); };
    const u1 = base44.entities.Auction.subscribe(
      (ev) => {
        if (ev.type === "delete") return;
        qc.setQueryData(["auction", id], (prev) => mergeKnownFields(prev, ev.data));
      },
      { filter: `id=eq.${id}`, onReconnect: resync },
    );
    const u2 = base44.entities.Bid.subscribe(
      (ev) => {
        qc.setQueryData(["bids", id], (prev) => mergeBidEvent(prev, ev));
        loadBidStateSoon();
      },
      { filter: `auction_id=eq.${id}`, onReconnect: resync },
    );
    return () => { clearInterval(poll); u1(); u2(); };
  }, [id, qc, sync, load, loadBidState, loadBidStateSoon]);

  // Bid state also carries the pace-limit status, so load it for every mode.
  useEffect(() => { if (auction?.id) loadBidState(); }, [auction?.id, auction?.mode, auction?.round, loadBidState]); // eslint-disable-line react-hooks/exhaustive-deps


  // The page only needs to re-render when a live auction's clock runs out (its
  // status may flip). The per-second countdown lives in the leaf components.
  useRerenderAt(auction?.status === "live" && auction?.end_time ? new Date(auction.end_time).getTime() : 0);

  // Lock page scroll while the no-scroll mobile console is shown.
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

  // The signed-in profile (from the layout) already carries the watch list.
  useEffect(() => {
    setWatched((user?.watched_auction_ids || []).includes(id));
  }, [user, id]);

  const status = effectiveStatus(auction, Date.now());
  const subscribed = auction && isSubscribed(auction, user?.id);
  const sealed = isClosestMode(auction);
  const nextBid = auction ? (auction.current_price || auction.start_price) + auction.bid_increment : 0;
  useEffect(() => { if (!sealed) setBidAmount(nextBid); }, [nextBid, sealed]);
  const filled = auction?.subscriber_ids?.length || 0;
  const seatsLeft = auction ? Math.max(0, closeQuota(auction) - filled) : 0;
  const totalMs = auction ? auction.duration_minutes * 60000 : 0;
  const showQuickBid = subscribed && status === "live" && !sealed;

  // outbid detection
  useEffect(() => {
    if (!auction || !user) return;
    const cur = auction.highest_bidder_id;
    if (prevHighest.current === user.id && cur && cur !== user.id) setOutbid(true);
    prevHighest.current = cur || prevHighest.current;
  }, [auction, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-bid up to the user's ceiling
  useEffect(() => {
    if (sealed) return;
    if (!subscribed || status !== "live" || !maxBid || !user || hittingBid.current) return;
    if (auction.highest_bidder_id === user.id) return;
    if (nextBid > maxBid) return;
    if (autoGuard.current === nextBid) return;
    autoGuard.current = nextBid;
    (async () => { await placeBid(nextBid, true); })();
  }, [auction, maxBid, nextBid, status, subscribed, user, sealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    if (!user) return;
    if (balance < auction.entry_fee) {
      toast.error(t.auction.insufficientBalance, {
        action: { label: t.auction.depositNow, onClick: () => { window.location.href = "/wallet"; } },
      });
      return;
    }
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("joinAuction", { auction_id: auction.id });
      if (res.data?.error) { toast.error(errorKey(res.data.error)); return; }
      refreshWallet();
      load();
      qc.invalidateQueries({ queryKey: ["myAuctions", user.id] });
      toast.success(t.auction.subscribed);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const promptDeposit = (needed) => {
    toast.error(
      needed
        ? `${t.auction.insufficientBidFunds} ${symbol}${Number(needed).toFixed(2)}`
        : t.auction.insufficientBidFunds,
      { action: { label: t.auction.depositNow, onClick: () => { window.location.hash = ""; navigateToWallet(); } } }
    );
  };

  const navigateToWallet = () => { window.location.href = "/deposit"; };

  // A taken/burned number is a dead end, so offer the nearest free one instead
  // of a bare error. The server only reveals that single suggestion.
  const suggestFreeNumber = async (amt, code) => {
    try {
      const res = await base44.functions.invoke("auctionFreeNumber", { auction_id: auction.id, near: amt });
      const n = res?.data?.suggestion;
      if (n == null) { toast.error(errorKey(code)); return; }
      const pretty = `${symbol}${Number(n).toFixed(2)}`;
      toast.error(
        (t.auction.burnedSuggest || "That number is burned. The closest free number is {number}.")
          .replace("{number}", pretty),
        {
          action: {
            label: (t.auction.suggestFree || "Try {number} instead").replace("{number}", pretty),
            onClick: () => setBidAmount(String(Number(n).toFixed(2))),
          },
        }
      );
    } catch {
      toast.error(errorKey(code));
    }
  };


  const placeBid = async (amount, isAuto) => {
    if (!subscribed) return false;
    // A submit already in flight is never duplicated by another tap.
    if (hittingBid.current && actionLoading) return false;
    const amt = Number(amount ?? bidAmount);
    if (sealed) {
      const bad = validClosestAmount(auction, amt);
      if (bad) { toast.error(t.auction[bad]); return false; }
    } else if (!amt || amt < nextBid) { if (!isAuto) toast.error(t.auction.tooLow); return false; }
    // A bid is a promise, not a payment: the wallet is never required to cover
    // the bid amount. Money is only needed for a per-bid fee or for extra bids
    // beyond the free quota, and the server checks that.


    hittingBid.current = true;
    setActionLoading(true);
    try {
      // Retry dedupe: one stable key per attempt (amount + auction). A double
      // tap or a retried request reuses the key, so the server records one bid.
      const key = pendingBidKey.current || `${auction.id}:${amt}:${crypto.randomUUID()}`;
      pendingBidKey.current = key;
      const res = await base44.functions.invoke("placeBid", {
        auction_id: auction.id,
        amount: amt,
        client_request_id: key,
      });
      // The server answered: this attempt is finished, so the next bid gets a
      // fresh key (only a thrown network error keeps the key for a safe retry).
      pendingBidKey.current = null;
      if (res.data?.error) {
        const code = String(res.data.error);
        if (code.startsWith("rate_limited")) {
          const [, lim, win, secs] = code.split(":");
          const wait = Math.max(1, Number(secs || 0));
          // Keep the widget honest about the fresh server state.
          loadBidState();
          if (!isAuto) {
            const unlockAt = new Date(Date.now() + wait * 1000);
            toast.error(
              (t.auction.errRateLimitedExact ||
                "You used all {limit} bids for this {window}-minute window. Your next bid unlocks in {sec} (at {clock}).")
                .replace("{limit}", String(lim || 0))
                .replace("{window}", String(win || 0))
                .replace("{sec}", formatCountdown(wait * 1000))
                .replace("{clock}", unlockAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
            );
          }
          return false;
        }
        if (code.startsWith("insufficient_funds_for_fee")) {
          refreshWallet();
          if (!isAuto) {
            const fee = Number(auction?.bid_fee || 0);
            const have = Number(balance || 0);
            const needed = Math.max(0, fee - have);
            toast.error(
              (t.auction.insufficientFeeFunds ||
                "Each number in this auction costs {fee}. Your balance is {balance} — deposit {needed} more to keep bidding.")
                .replace("{fee}", `${symbol}${fee.toFixed(2)}`)
                .replace("{balance}", `${symbol}${have.toFixed(2)}`)
                .replace("{needed}", `${symbol}${needed.toFixed(2)}`),
              { action: { label: t.auction.depositNow, onClick: () => { window.location.hash = ""; navigateToWallet(); } } }
            );
          }
          return false;
        }
        if (code.startsWith("quota_reached")) {
          const [, quota, , price] = code.split(":");
          loadBidState();
          if (!isAuto) {
            const extraPrice = Number(price || auction?.extra_bid_price || 0);
            const msg = (t.auction.errQuotaReached || "You have used all your numbers for this round.")
              .replace("{quota}", String(quota || auction?.bids_per_participant || 0));
            toast.error(
              msg,
              extraPrice > 0
                ? {
                    action: {
                      label: `${t.auction.buyBids || "Buy extra bids"} (${symbol}${extraPrice.toFixed(2)})`,
                      onClick: () => buyCredits(1),
                    },
                  }
                : undefined
            );
          }
          return false;
        }
        if (code.startsWith("number_burned") || code.startsWith("duplicate_own")) {
          loadBidState();
          if (!isAuto) suggestFreeNumber(amt, code);
          return false;
        }

        if (!isAuto) toast.error(errorKey(code));
        return false;

      }
      setOutbid(false);
      load();
      loadBidState();
      if (sealed) {
        refreshWallet();
        setBidAmount("");
        if (res.data?.burned) toast.error(t.auction.sealedBurnedNow);
        else toast.success(`${t.auction.sealedSubmitted}: ${symbol}${amt.toFixed(2)}`);
        return !res.data?.burned;
      }
      if (res.data?.extended && !isAuto) {
        toast.info(t.auction.antiSnipeExtended || "Last-second bid: the auction clock was extended.");
      }
      if (!isAuto) toast.success(`${symbol}${amt.toFixed(2)} ✓`);
      return true;
    } catch (e) {
      toast.error(e.message || "Error");
      return false;
    } finally {
      hittingBid.current = false;
      setActionLoading(false);
    }
  };

  const buyCredits = async (count) => {
    setBuyingCredits(true);
    try {
      const res = await base44.functions.invoke("buyBidCredits", { auction_id: auction.id, count });
      if (res.data?.error) {
        const code = String(res.data.error);
        if (code.startsWith("insufficient_funds_for_credits")) {
          const [, have, want] = code.split(":");
          refreshWallet();
          promptDeposit(Number(want || 0) - Number(have || 0));
          return;
        }
        toast.error(errorKey(code));
        return;
      }
      loadBidState();
      refreshWallet();
      toast.success(
        (t.auction.buyBidsDone || "{count} extra numbers added").replace("{count}", String(count))
      );
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBuyingCredits(false);
    }
  };

  const errorKey = (code) => ({
    insufficient_balance: t.auction.insufficientBalance,
    seats_full: t.auction.seatsFull,
    already_joined: t.auction.alreadyJoined,
    not_live: t.auction.notLive,
    not_subscribed: t.auction.notSubscribed,
    verification_pending: t.auction.needVerification,
    tooLow: t.auction.tooLow,
    number_burned: t.auction.errNumberBurned,
    
    quota_reached: (t.auction.errQuotaReached || "You have used all your numbers for this round.").replace("{quota}", String(auction?.bids_per_participant ?? 5)),
    waiting_for_others: t.auction.errWaitingForOthers,
    extra_bids_disabled: t.auction.errExtraBidsDisabled,
    duplicate_own: t.auction.errDuplicateOwn,
    out_of_range: t.auction.errOutOfRange,
    bad_step: t.auction.errBadStep,
    insufficient_funds_for_fee: t.auction.insufficientBidFunds,
    "Auction ended": t.auction.ended
  })[code] || code;


  const toggleWatch = async () => {
    try {
      const u = await base44.auth.me();
      const cur = u?.watched_auction_ids || [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      await base44.auth.updateMe({ watched_auction_ids: next });
      setWatched(next.includes(id));
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t.auction.shareCopied);
    } catch {
      toast.error("Error");
    }
  };

  if (!auction) {
    return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;
  }

  const statusBadge = {
    open: "bg-primary/15 text-primary border-primary/30",
    live: "bg-success/15 text-success border-success/30 animate-pulse",
    ended: "bg-muted text-muted-foreground border-border"
  }[status];
  const statusLabel = { open: t.auction.statusOpen, live: t.auction.statusLive, ended: t.auction.statusEnded }[status];

  if (isMobile) {
    return (
      <MobileAuctionDetail
        auction={auction}
        bids={bids}
        user={user}
        status={status}
        totalMs={totalMs}
        nextBid={nextBid}
        bidAmount={bidAmount}
        setBidAmount={setBidAmount}
        maxBid={maxBid}
        setMaxBid={setMaxBid}
        onBid={() => placeBid()}
        sealed={sealed}
        bidState={bidState}
        onBuyCredits={buyCredits}
        buyingCredits={buyingCredits}
        balance={balance}
        onJoin={handleJoin}
        actionLoading={actionLoading}
        subscribed={subscribed}
        watched={watched}
        onWatch={toggleWatch}
        onShare={share}
        outbid={outbid}
        filled={filled}
        seatsLeft={seatsLeft}
        symbol={symbol}
        backTo="/auctions"
        t={t}
        dir={dir}
        onRefresh={refreshAll}
      />
    );
  }


  return (
    <div className={cn("min-h-[calc(100vh-4rem)] space-y-6 pb-28 sm:pb-4", showQuickBid && "pb-52 sm:pb-4")} dir={dir}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent">
        <ArrowLeft className={cn("w-4 h-4")} /> {t.auction.back}
      </Link>

      <div className="grid lg:grid-cols-2 gap-8">
        <AuctionGallery auction={auction} />
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className={cn("inline-block text-xs font-bold px-3 py-1 rounded-md border", statusBadge)}>{statusLabel}</span>
              <WatchShareBar watched={watched} onWatch={toggleWatch} onShare={share} />
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{auction.title}</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">{auction.description}</p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4 shadow-[0_16px_40px_-28px_hsl(var(--primary)/0.5)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{sealed ? t.auction.sealedTarget : t.auction.currentPrice}</p>
                <p className="font-display text-4xl font-extrabold text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.25)]">
                  <Money amount={sealed ? (status === "ended" ? auction.current_price : auction.target_price) : auction.current_price} codeClassName="text-primary/60" />
                </p>
              </div>
              <LiveCountdownRing auction={auction} total={totalMs} status={status} />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
              <Stat icon={Users} label={t.auction.seats} value={`${filled}/${auction.max_subscribers}`} color="text-accent" />
              <Stat icon={Clock} label={t.auction.duration} value={formatDuration(auction.duration_minutes, t)} color="text-primary" />
              <Stat icon={TrendingUp} label={t.auction.bidIncrement} value={`${symbol}${auction.bid_increment}`} color="text-success" />
            </div>
            {subscribed && <MyBidsCard auction={auction} bidState={bidState} />}
          </div>

          {user && user.is_verified === false && status !== "ended" && (
            <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold">{t.auction.verifyNoticeTitle || "Verification needed"}</p>
                <p className="text-xs mt-0.5">{t.auction.needVerification}</p>
                <Link to="/account" className="inline-block mt-1.5 text-xs font-bold underline">
                  {t.auction.verifyNoticeCta || "Complete verification"}
                </Link>
              </div>
            </div>
          )}

          {outbid && status === "live" && !sealed && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2 text-sm text-destructive font-bold">
              <AlertTriangle className="w-4 h-4" /> {t.auction.outbidAlert}
            </div>
          )}


          {status !== "ended" && !subscribed && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.auction.entryFee}</span>
                <span className="font-bold text-foreground">{symbol}{auction.entry_fee}</span>
              </div>
              <Button onClick={handleJoin} disabled={actionLoading} className="gold-button w-full h-12 text-base font-bold">
                {actionLoading ? t.auction.joining : t.auction.join.replace("{fee}", `${symbol}${Number(auction.entry_fee || 0)}`)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {seatsLeft > 0
                  ? <>{status === "open" && <>{t.auction.startsWhenFull} · </>}{t.auction.seatsLeft.replace("{count}", seatsLeft)}</>
                  : t.auction.seatsTargetMet}
              </p>
            </div>
          )}

          <ParticipantQuota auction={auction} status={status} />

          <AuctionTimeline auction={auction} status={status} />

          {subscribed && status === "open" && (
            <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
              {t.auction.startsWhenFull}
            </div>
          )}

          {subscribed && status === "live" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <BidPaceMeter rate={bidState?.rate} onExpire={loadBidState} />
              {sealed ? (
                <SealedBidPanel
                  auction={auction}
                  bidState={bidState}
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  onBid={() => placeBid()}
                  actionLoading={actionLoading}
                  symbol={symbol}
                  onBuyCredits={buyCredits}
                  buyingCredits={buyingCredits}
                  balance={balance}
                />
              ) : (
              <BidPanel
                subscribed={subscribed}
                status={status}
                nextBid={nextBid}
                bidIncrement={auction.bid_increment}
                bidAmount={bidAmount}
                setBidAmount={setBidAmount}
                onBid={() => placeBid()}
                actionLoading={actionLoading}
                maxBid={maxBid}
                setMaxBid={setMaxBid}
              />
              )}
            </div>
          )}


          <WinnerAnnouncement auction={auction} status={status} youWon={auction.winner_id === user?.id} />

          <WinnerCelebration status={status} auction={auction} userId={user?.id} />


          {status === "ended" && auction.winner_id === user?.id && (
            <WinnerClaim auction={auction} user={user} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Leaderboard
            bids={bids}
            currentUserId={user?.id}
            live={status === "live"}
            closest={sealed}
            target={Number(auction.target_price || 0)}
            names={bidState.names}
            allBids={bidState.all}
          />

          {!sealed && <ActivityFeed bids={bids} currentUserId={user?.id} names={bidState.names} />}
        </div>
        <AuctionChat auctionId={id} user={user} />
      </div>

      {showQuickBid && (
        <div className="sm:hidden fixed dock-above-tabbar inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl px-4 py-3 px-safe shadow-[0_-4px_20px_rgba(17,24,39,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.auction.currentPrice}</p>
              <Money amount={auction.current_price} className="font-display text-xl font-extrabold text-primary truncate" codeClassName="text-primary/60" />
            </div>
            <Button onClick={() => placeBid(nextBid)} disabled={actionLoading} className="gold-button h-11 px-6 font-bold gap-2 shrink-0">
              {actionLoading ? t.auction.bidding : <span className="flex items-center gap-2"><Zap className="w-4 h-4" />{t.auction.placeBid} · <Money amount={nextBid} /></span>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY = [];
const BID_PAGE = 50;
const BID_STATE_THROTTLE_MS = 1500;

const timeOrNull = (v) => (v ? new Date(v).getTime() : null);

/**
 * Update the cached auction from a realtime row. Only fields the cached row
 * already has are taken, so the stream never adds columns this visitor's own
 * read didn't include; columns missing from the event (e.g. unchanged large
 * values) keep their cached value.
 */
function mergeKnownFields(prev, row) {
  if (!prev || !row) return prev;
  const next = { ...prev };
  for (const key of Object.keys(row)) if (key in prev) next[key] = row[key];
  return next;
}

/** Apply one realtime bid event to the cached list (newest first, capped). */
function mergeBidEvent(prev = EMPTY, ev) {
  const row = ev.data || {};
  if (!row.id) return prev;
  const without = prev.filter((b) => b.id !== row.id);
  if (ev.type === "delete" || row.archived) return without;
  const existing = prev.find((b) => b.id === row.id);
  const next = [existing ? { ...existing, ...row } : row, ...without];
  next.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  return next.slice(0, BID_PAGE);
}

/** The only part of the page that re-renders every second. */
function LiveCountdownRing({ auction, total, status }) {
  const now = useNow(status === "live");
  return <CountdownRing remaining={status === "live" ? timeRemaining(auction, now) : 0} total={total} status={status} />;
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className={cn("w-3.5 h-3.5", color)} />{label}</div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function useMediaQueryLess640() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}