/**
 * Server-only implementations of the app's backend operations
 * (ported from the original serverless functions).
 * Every handler runs with the service-role client after verifying the caller.
 */
import { supabaseAdmin } from "./client.ts";
import { createTestAuction, reconcileAuctionPayments } from "./testmode.ts";
import { getParticipantFile } from "./participantfile.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Payload = Record<string, any>;
type Result = { data: Record<string, any>; status: number };

const admin: any = supabaseAdmin;

const ok = (data: Row = { ok: true }): Result => ({ data, status: 200 });
const fail = (error: string, status = 400): Result => ({ data: { error }, status });


/** Run a write and raise when the database rejects it (never a silent success). */
async function mustWrite<T extends { error: unknown }>(q: PromiseLike<T>): Promise<T> {
  const res = await q;
  const err = res?.error as { message?: string } | null;
  if (err) throw new Error(err.message || "write_failed");
  return res;
}

const CAPS = ["join_auctions", "place_bids", "topup_wallet"] as const;
// The site trades in Philippine pesos only (Stripe: 100 centavos per peso).
const CURRENCY = "PHP";
const CURRENCY_UNIT = 100;

function permissionState(user: Row, cap: string) {
  const value = (user?.permissions || {})[cap];
  return value === "allow" || value === "deny" ? value : "inherit";
}
const isDenied = (user: Row, cap: string) => permissionState(user, cap) === "deny";
const isAllowed = (user: Row, cap: string) => permissionState(user, cap) === "allow";

/** Public-safe name: first initial + last initial (e.g. "A.S."). */
function publicDisplayName(p: Row): string {
  const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : "");
  const first = String(p["first_name"] || "").trim();
  const last = String(p["last_name"] || "").trim();
  if (first || last) {
    const l = last ? ` ${last[0]!.toUpperCase()}.` : "";
    return first ? `${cap(first)}${l}` : `${cap(last)}`;
  }
  const full = String(p["full_name"] || "").trim();
  if (full) {
    const parts = full.split(/\s+/);
    if (parts.length === 1) return cap(parts[0]!);
    return `${cap(parts[0]!)} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
  }
  const email = String(p["email"] || "");
  return email ? cap(email.split("@")[0]!) : "Bidder";
}



async function getRow(table: string, id: string) {
  const { data } = await admin.from(table).select("*").eq("id", id).maybeSingle();
  return data as Row | null;
}

async function getUser(userId: string): Promise<Row | null> {
  const profile = await getRow("profiles", userId);
  if (!profile) return null;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const role = (roles || []).some((r: Row) => r.role === "admin") ? "admin" : "user";
  return { ...profile, role, is_verified: profile["verification_status"] === "verified" };
}

async function getConfirmedBalance(userId: string) {
  // Authoritative total: summed in SQL over every transaction, never a page of them.
  const { data: exact, error } = await admin.rpc("wallet_confirmed_balance", { _user_id: userId });
  if (!error && exact !== null && exact !== undefined) return Math.round(Number(exact) * 100) / 100;

  const { data } = await admin
    .from("wallet_transactions")
    .select("amount, status")
    .eq("user_id", userId)
    .limit(50000);
  const sum = (data || [])
    .filter((t: Row) => t.status !== "pending" && t.status !== "failed")
    .reduce((acc: number, t: Row) => acc + Number(t.amount || 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Spendable balance: wallet total minus funds currently reserved (escrow holds)
 * on live rounds and on wins awaiting payment.
 */
async function availableBalance(userId: string) {
  try {
    const { data } = await admin.rpc("available_balance", { _user_id: userId });
    if (data !== null && data !== undefined) return Number(data);
  } catch {
    /* fall back to the raw wallet balance */
  }
  return getConfirmedBalance(userId);
}

async function notify(values: Row) {
  try {
    await admin.from("notifications").insert({ channel: "inapp", status: "sent", read: false, ...values });
  } catch {
    /* never block the main action on a failed alert */
  }
}

async function emailUser(to: string | null | undefined, subject: string, body: string) {
  if (!to) return;
  // Email delivery is logged as an email-channel notification record.
  await notify({ recipient: to, title: subject, body, channel: "email", status: "sent" });
}

/* ---------------------------- bid observability ------------------------- */

/**
 * Append-only audit trail for every bid/join/settlement attempt.
 * Never throws: monitoring must not break the action it records.
 */
async function logBidEvent(values: Row) {
  try {
    await admin.from("bid_events").insert({ severity: "info", ...values });
  } catch {
    /* observability is best-effort */
  }
}

/** Append-only admin audit entry. Never throws. */
async function logAdminAction(
  actor: Row,
  action: string,
  targetType: string,
  targetId: string,
  details?: string,
) {
  try {
    await admin.from("activity_logs").insert({
      actor_id: actor?.["id"] || null,
      actor_name: actor?.["full_name"] || actor?.["email"] || null,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    });
  } catch {
    /* observability is best-effort */
  }
}

/* ------------------------------ lifecycle ------------------------------ */
/*
 * open -> live -> ended -> (relaunch) open as the next round | archived
 *                       \-> voided -> (relaunch) open | archived
 * Every transition writes one activity_logs entry named after its event
 * (auction.started / ended / voided / relaunched / archived, queue.empty).
 * source "admin" = a staff member did it (actor recorded), "system" = the
 * clock / tick did it. Nothing ever moves an ended auction by itself.
 */

type Source = "admin" | "system";

async function logLifecycle(
  event: string,
  a: Row,
  source: Source,
  actor: Row = null,
  details: Record<string, unknown> = {},
) {
  try {
    await admin.from("activity_logs").insert({
      action: event,
      source,
      actor_id: source === "admin" ? actor?.["id"] || null : null,
      actor_name: source === "admin" ? actor?.["full_name"] || actor?.["email"] || null : "System",
      target_type: a ? "auction" : null,
      target_id: a ? String(a["id"]) : null,
      details: JSON.stringify({ title: a?.["title"] ?? null, round: a ? Number(a["round"] || 1) : null, ...details }),
    });
  } catch {
    /* observability is best-effort */
  }
}

/** Keeps a finished round's result, so relaunching the row never loses it. */
async function recordRound(a: Row, outcome: "won" | "no_winner" | "voided", extra: Row = {}) {
  try {
    await admin.from("auction_rounds").upsert(
      {
        auction_id: a["id"],
        round: Number(a["round"] || 1),
        outcome,
        winner_id: outcome === "won" ? a["winner_id"] || null : null,
        winner_name: outcome === "won" ? a["winner_name"] || null : null,
        final_price: Number(a["current_price"] || 0),
        start_time: a["start_time"] || null,
        end_time: a["end_time"] || null,
        ended_at: new Date().toISOString(),
        subscriber_count: (a["subscriber_ids"] || []).length,
        ...extra,
      },
      { onConflict: "auction_id,round", ignoreDuplicates: true },
    );
  } catch {
    /* history is best-effort; the round's bids and payments are kept anyway */
  }
}

/** Ended by the tick more than 2 minutes after its end time: the server was down. */
function isRecoveryEnd(a: Row, source: Source) {
  if (source !== "system" || !a?.["end_time"]) return false;
  return Date.now() - new Date(a["end_time"]).getTime() > 2 * 60_000;
}


/** Maps a handler result into an audit outcome + severity. */
function classify(reason: string | null): { outcome: string; severity: string } {
  if (!reason) return { outcome: "accepted", severity: "info" };
  const expected = [
    "not_live",
    "not_subscribed",
    "Auction ended",
    "tooLow",
    "seats_full",
    "already_joined",
    "duplicate_own",
    "number_burned",
    
    "quota_reached",
    "rate_limited",
    "waiting_for_others",
    "extra_bids_disabled",
    "invalid_count",
    "out_of_range",
    "bad_step",
    "permission_denied",
    "verification_pending",
    "account_suspended",
    "not_found",
    "Invalid request",
  ];
  // A wallet that cannot cover an entry fee, a bid fee, a bid or extra credits
  // is normal user behaviour, not a system anomaly.
  const isExpected =
    expected.some((e) => reason === e || reason.startsWith(e)) ||
    reason.startsWith("insufficient_balance") ||
    reason.startsWith("insufficient_funds");
  return { outcome: "rejected", severity: isExpected ? "warning" : "error" };
}

/* --------------------------- auction lifecycle -------------------------- */

/**
 * Brings a single auction row in line with the clock:
 * open -> live when its scheduled start passed or all seats sold,
 * live -> ended (charging the winner) once end_time passed.
 * Returns the up-to-date row.
 */
/**
 * Participant target that CLOSES a round. Reaching it ends the auction; it is
 * never a gate for starting one.
 */
function closeQuota(a: Row): number {
  // There is no maximum: the configured number is only the MINIMUM target that
  // must be reached before an expired timer can close the round.
  return Number(a["min_participants"] || 0) || Number(a["max_subscribers"] || 0);
}

async function ensureAuctionState(a: Row): Promise<Row> {
  if (!a || ["ended", "voided", "voiding", "archived"].includes(a["status"])) return a;

  const now = new Date();

  // A round goes live as soon as the first participant joins (or its schedule
  // hits) — no waiting for a quota of participants.
  if (
    a["status"] === "open" &&
    !a["start_time"] &&
    ((a["scheduled_start_time"] && now >= new Date(a["scheduled_start_time"])) ||
      (a["subscriber_ids"]?.length || 0) >= 1)
  ) {
    const patch = {
      status: "live",
      start_time: now.toISOString(),
      end_time: new Date(now.getTime() + Number(a["duration_minutes"]) * 60000).toISOString(),
    };
    // Conditional: only the request that still sees "open" starts the clock,
    // so parallel syncs cannot reset an already-running timer.
    const { data: started } = await admin
      .from("auctions")
      .update(patch)
      .eq("id", a["id"])
      .eq("status", "open")
      .is("start_time", null)
      .select("id");
    if (!started?.length) {
      a = (await getRow("auctions", a["id"])) || a;
    } else {
      a = { ...a, ...patch };
      // No admin click: the schedule hit or the first participant joined.
      await logLifecycle("auction.started", a, "system", null, {
        trigger: a["scheduled_start_time"] && now >= new Date(a["scheduled_start_time"]) ? "schedule" : "first_join",
      });
    }
  }


  // A live round closes ONLY when both conditions hold: the clock ran out AND
  // every seat (participant target) is taken. If the clock runs out while seats
  // are still open, the timer restarts for another full duration.
  if (a["status"] === "live" && a["start_time"] && a["duration_minutes"]) {
    const durationMs = Number(a["duration_minutes"]) * 60000;
    const quota = closeQuota(a);
    const joined = a["subscriber_ids"]?.length || 0;
    const seatsFull = quota > 0 ? joined >= quota : true;

    // Missing end_time (edited duration / reopened round): derive it.
    if (!a["end_time"]) {
      const expected = new Date(new Date(a["start_time"]).getTime() + durationMs).toISOString();
      await admin.from("auctions").update({ end_time: expected }).eq("id", a["id"]);
      a = { ...a, end_time: expected };
    }

    const timeUp = now >= new Date(a["end_time"]);
    if (timeUp && seatsFull) {
      return settleAuction(a);
    }
    if (timeUp && !seatsFull) {
      const maxRestarts = Number(a["max_restarts"] ?? 3);
      const nextCount = Number(a["restart_count"] || 0) + 1;

      // A round can only restart a limited number of times. Once the cap is
      // reached the round is voided and every participant is refunded once.
      if (maxRestarts > 0 && nextCount > maxRestarts) {
        const { data: claimed } = await admin
          .from("auctions")
          .update({ status: "voiding" })
          .eq("id", a["id"])
          .eq("status", "live")
          .eq("end_time", a["end_time"])
          .select("id");
        if (claimed?.length) {
          const { data: res } = await admin.rpc("void_auction_refund", {
            _auction_id: a["id"],
            _reason: "not_enough_participants",
          });
          for (const uid of (a["subscriber_ids"] || []) as string[]) {
            await notify({
              user_id: uid,
              title: "Auction cancelled",
              body: `"${a["title"]}" did not reach the minimum number of participants. Your entry fee and bid fees were refunded to your wallet.`,
              type: "announcement",
              auction_id: a["id"],
            });
          }
          await releaseHolds(a, null);
          await logBidEvent({
            auction_id: a["id"],
            user_id: null,
            event: "void",
            outcome: "voided",
            reason: "restart_cap_reached",
            mode: a["mode"] || "highest",
            round: Number(a["round"] || 1),
            severity: "warning",
            details: { restarts: nextCount, max_restarts: maxRestarts, refund: res ?? null },
          });
          await recordRound(a, "voided");
          await logLifecycle("auction.voided", a, "system", null, {
            reason: "not_enough_participants",
            restarts: nextCount,
          });
        }
        return (await getRow("auctions", a["id"])) || { ...a, status: "voided" };
      }

      const patch = {
        start_time: now.toISOString(),
        end_time: new Date(now.getTime() + durationMs).toISOString(),
        restart_count: nextCount,
      };
      // Only restart from the exact expired end_time we observed, so parallel
      // syncs restart the round once instead of stacking extra durations.
      const { data: restarted } = await admin
        .from("auctions")
        .update(patch)
        .eq("id", a["id"])
        .eq("status", "live")
        .eq("end_time", a["end_time"])
        .select("id");
      a = restarted?.length ? { ...a, ...patch } : (await getRow("auctions", a["id"])) || a;
    }

  }

  return a;
}


const isClosest = (a: Row) => a?.["mode"] === "closest";

/**
 * Escrow: money committed by a live bid is only ever RESERVED, never debited.
 * When a round closes, every hold is released except the winner's, which stays
 * reserved for the payment retry window and is freed automatically afterwards.
 */
async function releaseHolds(a: Row, winnerId: string | null) {
  try {
    const { data } = await admin.rpc("release_auction_holds", {
      _auction_id: a["id"],
      _round: Number(a["round"] || 1),
      _winner_id: winnerId,
      _retry_minutes: Number(a["hold_retry_minutes"] ?? 1440),
    });
    return data ?? null;
  } catch {
    return null;
  }
}

/** Frees one user's reserved funds for a round (payment settled or voided). */
async function releaseUserHold(auctionId: string, round: number, userId: string, reason: string) {
  try {
    await admin
      .from("bid_holds")
      .update({ status: "released", released_at: new Date().toISOString(), reason })
      .eq("auction_id", auctionId)
      .eq("round", round)
      .eq("user_id", userId)
      .eq("status", "held");
  } catch {
    /* hold bookkeeping must never break the money action */
  }
}

/**
 * Sealed "closest to the price" winner: the highest still-active (non-burned)
 * number of the current round that does not exceed the target price.
 */
async function closestWinner(a: Row): Promise<{ userId: string; amount: number } | null> {
  const target = Number(a["target_price"] || 0);
  const base = () => {
    let q = admin
      .from("bids")
      .select("user_id, amount, created_date")
      .eq("auction_id", a["id"])
      .eq("round", Number(a["round"] || 1))
      .eq("archived", false);
    if (target > 0) q = q.lte("amount", target);
    return q;
  };

  const { data } = await base()
    .eq("burned", false)
    .order("amount", { ascending: false })
    .limit(1);
  const row = (data || [])[0];
  if (row) return { userId: row.user_id, amount: Number(row.amount) };

  // Safety net: the last-unique guard in place_closest_bid should make this
  // impossible, but a round must never end without a winner. Fall back to the
  // highest burned number at or below target, earliest bidder on it wins.
  const { data: burnedRows } = await base()
    .eq("burned", true)
    .order("amount", { ascending: false })
    .order("created_date", { ascending: true })
    .limit(1);
  const fb = (burnedRows || [])[0];
  if (!fb) return null;
  return { userId: fb.user_id, amount: Number(fb.amount) };
}

/**
 * Records the win as an unpaid payment request with a unique link. Idempotent:
 * one row per (auction, round, winner), so repeated settlement attempts or a
 * runner-up promotion never create duplicates or double-bill anyone.
 */
async function ensureWinnerPayment(a: Row, userId: string, amount: number): Promise<Row | null> {
  const round = Number(a["round"] || 1);
  const { data: existing } = await admin
    .from("winner_payments")
    .select("*")
    .eq("auction_id", a["id"])
    .eq("round", round)
    .eq("user_id", userId)
    .limit(1);
  const found = (existing || [])[0] as Row | undefined;
  if (found) return found;

  const { data: created } = await admin
    .from("winner_payments")
    .insert({ auction_id: a["id"], user_id: userId, round, amount, status: "pending" })
    .select("*")
    .limit(1);
  const row = (created || [])[0] as Row | undefined;
  if (row) return row;

  // Unique-constraint race: another settlement path created it first.
  const { data: raced } = await admin
    .from("winner_payments")
    .select("*")
    .eq("auction_id", a["id"])
    .eq("round", round)
    .eq("user_id", userId)
    .limit(1);
  return ((raced || [])[0] as Row | undefined) || null;
}

/**
 * Ends a live auction whose time is up and records the winner's payment request.
 * The winner's wallet is never debited — payment is collected manually through a
 * unique link. Settlement is claimed atomically (live -> ended in one conditional
 * UPDATE) so concurrent clock syncs can never settle the same round twice.
 */

async function settleAuction(a: Row, source: Source = "system", actor: Row = null): Promise<Row> {
  // Judged before the claim: a late end means the tick missed the end time.
  const recovered = isRecoveryEnd(a, source);
  const { data: claimed } = await admin
    .from("auctions")
    .update({ status: "ended" })
    .eq("id", a["id"])
    .eq("status", "live")
    .eq("round", Number(a["round"] || 1))
    .select("id");
  if (!claimed?.length) {
    // Another request already settled this round: return the settled row.
    return (await getRow("auctions", a["id"])) || { ...a, status: "ended" };
  }

  // Re-read after claiming: a bid may have landed between the read that
  // triggered settlement and the claim, so the winner must come from the
  // committed row, not the stale snapshot.
  a = (await getRow("auctions", a["id"])) || a;

  let winnerId = a["highest_bidder_id"] || null;
  let closestAmount: number | null = null;
  if (isClosest(a)) {
    const w = await closestWinner(a);
    winnerId = w?.userId || null;
    closestAmount = w?.amount ?? null;
  }
  const patch: Row = { status: "ended", winner_id: winnerId };
  let paymentId: string | null = null;
  if (closestAmount !== null) patch["current_price"] = closestAmount;
  if (isClosest(a)) patch["highest_bidder_id"] = winnerId;

  if (winnerId) {
    const winningAmount = closestAmount !== null ? closestAmount : Number(a["current_price"] || 0);

    // Winners are NEVER charged from their wallet. The win is recorded as unpaid
    // with a unique payment link the winner can settle later (or manually with
    // the team). `paid` only turns true once an admin marks it paid.
    const payment = await ensureWinnerPayment(a, winnerId, winningAmount);
    paymentId = payment?.["id"] ? String(payment["id"]) : null;
    patch["paid"] = payment?.["status"] === "paid";
    patch["winner_notified"] = true;

    const link = payment?.["token"] ? `/pay/${payment["token"]}` : null;
    const text =
      `You won "${a["title"]}" with a winning bid of ${winningAmount}.` +
      (link ? ` Complete your payment here: ${link}` : "");
    await notify({
      user_id: winnerId,
      title: "You won the auction! 🎉",
      body: text,
      type: "announcement",
      auction_id: a["id"],
    });
    const winner = await getRow("profiles", winnerId);
    patch["winner_name"] =
      winner?.["full_name"] || (winner?.["email"] ? String(winner["email"]).split("@")[0] : "Winner");
    await emailUser(winner?.["email"], "You won the auction! 🎉", text);
  } else {
    patch["winner_name"] = null;
  }


  await mustWrite(admin.from("auctions").update(patch).eq("id", a["id"]));

  // Escrow settlement: losers are freed at once, the winner's funds stay
  // reserved for the payment retry window.
  const holds = await releaseHolds(a, winnerId);

  await logBidEvent({
    auction_id: a["id"],
    user_id: winnerId,
    event: "settle",
    outcome: winnerId ? "settled" : "settled_no_winner",
    reason: winnerId ? null : "no_valid_bids",
    mode: a["mode"] || "ascending",
    amount: closestAmount !== null ? closestAmount : Number(a["current_price"] || 0),
    price_before: Number(a["current_price"] || 0),
    price_after: Number(patch["current_price"] ?? a["current_price"] ?? 0),
    round: Number(a["round"] || 1),
    // Wins are invoiced manually, so an unpaid settlement is the normal path;
    // only a missing payment request is an anomaly worth flagging.
    severity: winnerId && !paymentId ? "warning" : "info",
    details: { paid: patch["paid"] ?? null, payment_id: paymentId, title: a["title"] || null, holds },
  });

  const settled = { ...a, ...patch };
  await recordRound(settled, winnerId ? "won" : "no_winner", { payment_id: paymentId, recovered });
  await logLifecycle("auction.ended", settled, source, actor, {
    winner_id: winnerId,
    winner_name: patch["winner_name"] ?? null,
    final_price: Number(settled["current_price"] || 0),
    ...(recovered ? { recovered: true, end_time: a["end_time"] } : {}),
  });

  return settled;
}

/** Any signed-in viewer can nudge one auction's clock forward. */
async function syncAuction(_user: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  const next = await ensureAuctionState(a);
  return ok({ status: next["status"], end_time: next["end_time"] || null });

}

/* ------------------------------- members ------------------------------- */


async function joinAuction(user: Row, body: Payload) {
  if (user["paused"]) return fail("account_suspended", 403);
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  if (isDenied(user, "join_auctions")) return fail("permission_denied", 403);
  if (user["role"] !== "admin" && !user["is_verified"] && !isAllowed(user, "join_auctions")) {
    return fail("verification_pending", 403);
  }

  const a = await ensureAuctionState(await getRow("auctions", auctionId));
  if (!a) return fail("not_found", 404);
  if (["ended", "archived", "voided", "voiding"].includes(a["status"])) return fail("Auction ended");


  // Seat + entry fee are taken atomically in Postgres (row lock inside the
  // A cancelled, voided or already-closed auction must never take an entry fee.
  const joinable = ["open", "live", "running", "active", "scheduled"];
  if (!joinable.includes(String(a["status"] || ""))) return fail("auction_not_joinable", 409);

  // function), so two simultaneous joins can never oversell a seat or leave a
  // charged fee without a seat.
  const { data, error } = await admin.rpc("join_auction_atomic", {
    _auction_id: auctionId,
    _user_id: user["id"],
  });
  if (error) return fail(error.message || "join_failed");
  const res = (data || {}) as Row;
  if (!res["ok"]) return fail(String(res["error"] || "join_failed"));
  return ok({ ok: true, status: res["status"] || a["status"] });
}

async function placeBid(user: Row, body: Payload) {
  if (user["paused"]) return fail("account_suspended", 403);
  const auctionId = body["auction_id"];
  const amount = Number(body["amount"]);
  // Client-supplied idempotency key: a retried or double-tapped submit with the
  // same key is recorded once and returns the original outcome.
  const requestId = body["client_request_id"] ? String(body["client_request_id"]).slice(0, 64) : null;
  if (!auctionId || !amount) return fail("Invalid request");
  if (isDenied(user, "place_bids")) return fail("permission_denied", 403);
  if (user["role"] !== "admin" && !user["is_verified"] && !isAllowed(user, "place_bids")) {
    return fail("verification_pending", 403);
  }

  const a = await ensureAuctionState(await getRow("auctions", auctionId));
  if (!a) return fail("not_found", 404);
  if (["ended", "archived", "voided", "voiding"].includes(a["status"])) return fail("Auction ended");

  if (a["status"] !== "live" || !a["end_time"]) return fail("not_live");
  if (Date.now() >= new Date(a["end_time"]).getTime()) return fail("Auction ended");
  if (!(a["subscriber_ids"] || []).includes(user["id"])) return fail("not_subscribed");

  // No wallet gate on the bid amount itself, in either mode: a bid is a promise,
  // not a payment. The winner pays afterwards through their payment link. Money
  // is only ever needed for a per-bid fee or for buying extra bids, and that is
  // checked inside the database functions below.



  // Sealed "closest to the price" mode: numbers are unique, duplicates burn.
  if (isClosest(a)) {
    const { data, error } = await admin.rpc("place_closest_bid", {
      _auction_id: auctionId,
      _user_id: user["id"],
      _amount: amount,
      _client_request_id: requestId,
    });
    if (error) return fail(error.message || "bid_failed");
    const res = (data || {}) as Row;
    if (!res["ok"]) {
      if (res["error"] === "rate_limited") {
        return fail(`rate_limited:${res["limit"] || 0}:${res["window_minutes"] || 0}:${res["retry_after"] || 0}`);
      }
      return fail(String(res["error"] || "bid_failed"));
    }
    return ok({ ok: true, burned: !!res["burned"], duplicate: !!res["duplicate"] });
  }

  // Ascending mode: one locked database round-trip validates status, seats,
  // balance and the minimum next bid, then writes the bid + price together.
  // This is what keeps simultaneous bids from both "winning" or from moving
  // the price backwards.
  const { data: ascData, error: ascError } = await admin.rpc("place_ascending_bid", {
    _auction_id: auctionId,
    _user_id: user["id"],
    _amount: amount,
    _client_request_id: requestId,
  });
  if (ascError) return fail(ascError.message || "bid_failed");
  const asc = (ascData || {}) as Row;
  if (!asc["ok"]) {
    if (asc["error"] === "rate_limited") {
      return fail(`rate_limited:${asc["limit"] || 0}:${asc["window_minutes"] || 0}:${asc["retry_after"] || 0}`);
    }
    if (asc["error"] === "insufficient_funds_for_fee") {
      return fail(`insufficient_funds_for_fee:${asc["balance"] || 0}:${asc["fee"] || 0}`);
    }
    if (asc["error"] === "quota_reached") {
      return fail(`quota_reached:${asc["quota"] || 0}:${asc["used"] || 0}:${asc["extra_price"] || 0}`);
    }

    return fail(String(asc["error"] || "bid_failed"));
  }

  const prevBidder = asc["prev_bidder"];
  if (prevBidder && prevBidder !== user["id"]) {
    await notify({
      user_id: prevBidder as string,
      title: "OUTBID",
      body: a["title"] || "",
      type: "warning",
      auction_id: auctionId,
    });
  }
  return ok({
    ok: true,
    current_price: Number(asc["current_price"] ?? amount),
    duplicate: !!asc["duplicate"],
    // Anti-sniping: a last-second bid pushes the deadline forward.
    extended: !!asc["extended"],
    end_time: asc["end_time"] || a["end_time"] || null,
    held: Number(asc["held"] || 0),
  });
}

/**
 * Sealed-mode read: burned numbers (public) plus the caller's own numbers.
 * Never returns other users' active numbers.
 */
async function auctionBidState(user: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  const round = Number(a["round"] || 1);
  const { data } = await admin
    .from("bids")
    .select("user_id, amount, burned, created_date")
    .eq("auction_id", auctionId)
    .eq("round", round)
    .eq("archived", false)
    .limit(2000);
  const rows = (data || []) as Row[];
  const burned = [...new Set(rows.filter((r) => r.burned).map((r) => Number(r.amount)))].sort((x, y) => x - y);
  const mine = rows
    .filter((r) => r.user_id === user["id"])
    .map((r) => ({ amount: Number(r.amount), burned: !!r.burned, created_date: r.created_date }))
    .sort((x, y) => y.amount - x.amount);
  const ended = a["status"] === "ended" || a["status"] === "archived";
  // Extra numbers the caller bought for this round on top of the free quota.
  const { data: creditRow } = await admin
    .from("bid_credits")
    .select("credits")
    .eq("auction_id", auctionId)
    .eq("user_id", user["id"])
    .eq("round", round)
    .maybeSingle();
  const { data: rate } = await admin.rpc("bid_rate_status", {
    _auction_id: auctionId,
    _user_id: user["id"],
  });
  // Size of the number pool: every whole currency unit holds exactly 100 numbers
  // (cent granularity), independent of bid_increment. The clock shortens as the
  // free pool empties, so the UI shows how much of it is left.
  const totalNumbers = Math.max(Math.round(Number(a["target_price"] || 0) * 100), 0);
  // Counted in the database so a busy round is never under-reported by the
  // row limit above.
  const { data: exactCounts } = await admin.rpc("auction_round_counts", {
    _auction_id: auctionId,
    _round: round,
  });
  const counts = (Array.isArray(exactCounts) ? exactCounts[0] : exactCounts) as Row | null;
  const usedNumbers = counts
    ? Number(counts["taken_count"] || 0)
    : new Set(rows.map((r) => Number(r["amount"]))).size;

  // Public display names for bidders: first initial + last name only, so the
  // leaderboard/activity feed stay readable without exposing full identities.
  const bidderIds = [...new Set(rows.map((r) => String(r["user_id"])).filter(Boolean))];
  const names: Record<string, string> = {};
  if (bidderIds.length) {
    const { data: people } = await admin
      .from("profiles")
      .select("id, first_name, last_name, full_name, email")
      .in("id", bidderIds);
    for (const p of (people || []) as Row[]) {
      names[String(p["id"])] = publicDisplayName(p);
    }
  }

  // Full round log: every number is public, live included.
  const all = rows
    .slice()
    .sort((x, y) => new Date(String(y["created_date"])).getTime() - new Date(String(x["created_date"])).getTime())
    .map((r) => ({
      user_id: r["user_id"],
      amount: Number(r["amount"]),
      burned: !!r["burned"],
      created_date: r["created_date"],
      masked: false,
    }));

  return ok({
    burned,
    mine,
    names,
    all,
    revealed: ended,
    rate: (rate || {}) as Row,
    round,
    ended,
    credits: Number((creditRow as Row | null)?.["credits"] || 0),
    extra_bid_price: Number(a["extra_bid_price"] || 0),
    total_numbers: totalNumbers,
    free_numbers: Math.max(totalNumbers - usedNumbers, 0),
    ...(ended ? { winner_id: a["winner_id"] || null, winning_amount: Number(a["current_price"] || 0) } : {}),
  });


}

/**
 * Nearest still-free number to the one the caller just tried. Only the single
 * suggestion is returned, so the full set of taken numbers stays private.
 */
async function auctionFreeNumber(_user: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  const round = Number(a["round"] || 1);
  const target = Number(a["target_price"] || 0);
  const maxCents = Math.round(target * 100);
  if (maxCents < 1) return ok({ suggestion: null });

  const { data } = await admin
    .from("bids")
    .select("amount")
    .eq("auction_id", auctionId)
    .eq("round", round)
    .eq("archived", false)
    .limit(50000);
  const taken = new Set(((data || []) as Row[]).map((r) => Math.round(Number(r["amount"]) * 100)));

  const wanted = Math.min(Math.max(Math.round(Number(body["near"] || 0) * 100), 1), maxCents);
  for (let step = 0; step <= maxCents; step++) {
    for (const c of [wanted - step, wanted + step]) {
      if (c >= 1 && c <= maxCents && !taken.has(c)) return ok({ suggestion: c / 100 });
    }
  }
  return ok({ suggestion: null });
}

/**
 * Single source of truth for the number pool of one auction: total, taken,

 * burned and free numbers plus the live deadline, the configured warning
 * threshold and the fairness-guarded earliest possible end. Every UI surface
 * (participant panel, admin cards, live monitor) reads these same numbers.
 */
async function auctionNumberPool(_user: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);

  const round = Number(a["round"] || 1);
  const { data } = await admin
    .from("bids")
    .select("amount, burned, created_date")
    .eq("auction_id", auctionId)
    .eq("round", round)
    .eq("archived", false)
    .order("created_date", { ascending: true })
    .limit(5000);
  const rows = (data || []) as Row[];

  const sealed = a["mode"] === "closest";
  const total = sealed ? Math.max(Math.round(Number(a["target_price"] || 0) * 100), 0) : 0;
  const takenSet = new Set<number>();
  const burnedSet = new Set<number>();
  // Free-number history: one point per bid, so charts can plot the drain.
  const history: { t: string; free: number; burned: number }[] = [];
  for (const r of rows) {
    const amount = Number(r["amount"]);
    takenSet.add(amount);
    if (r["burned"]) burnedSet.add(amount);
    history.push({
      t: String(r["created_date"]),
      free: Math.max(total - takenSet.size, 0),
      burned: burnedSet.size,
    });
  }

  const used = Math.min(takenSet.size, total || takenSet.size);
  const free = Math.max(total - used, 0);
  const freePct = total > 0 ? Math.round((free / total) * 100) : 0;
  const warnPct = Math.max(0, Math.min(100, Number(a["pool_warn_pct"] ?? 20)));
  const minRoundMinutes = Math.max(0, Number(a["min_round_minutes"] ?? 0));
  const startTime = a["start_time"] ? new Date(String(a["start_time"])).getTime() : null;
  const endTime = a["end_time"] ? new Date(String(a["end_time"])).getTime() : null;
  const guardEnd =
    startTime && minRoundMinutes > 0
      ? Math.min(startTime + minRoundMinutes * 60_000, endTime ?? Infinity)
      : null;
  // The clock is compressed by the free ratio on the next accepted bid, so the
  // projected end never sits later than the current deadline.
  const remaining = endTime ? Math.max(endTime - Date.now(), 0) : 0;
  const projectedEnd = endTime
    ? Math.max(endTime - remaining * (1 - (total > 0 ? free / total : 1)), guardEnd || 0)
    : null;

  return ok({
    auction_id: String(auctionId),
    round,
    mode: a["mode"],
    sealed,
    total_numbers: total,
    used_numbers: used,
    burned_numbers: burnedSet.size,
    free_numbers: free,
    free_pct: freePct,
    burned: [...burnedSet].sort((x, y) => x - y),
    warn_pct: warnPct,
    warning: total > 0 && freePct <= warnPct,
    floor_numbers: total > 0 ? Math.max(Math.ceil(total * 0.05), 3) : 0,
    min_round_minutes: minRoundMinutes,
    status: a["status"],
    end_time: endTime ? new Date(endTime).toISOString() : null,
    earliest_end_time: guardEnd ? new Date(guardEnd).toISOString() : null,
    projected_end_time: projectedEnd ? new Date(projectedEnd).toISOString() : null,
    history,
    bids: rows.length,
    server_time: new Date().toISOString(),
  });
}


/**
 * Buys extra numbers (beyond the free quota) for a closest-price auction.
 * The wallet charge and the credit increment happen atomically in Postgres.
 */
async function buyBidCredits(user: Row, body: Payload) {
  if (user["paused"]) return fail("account_suspended", 403);
  const auctionId = body["auction_id"];
  const count = Math.floor(Number(body["count"]));
  if (!auctionId || !count || count < 1) return fail("invalid_count");

  const a = await ensureAuctionState(await getRow("auctions", auctionId));
  if (!a) return fail("not_found", 404);

  const { data, error } = await admin.rpc("buy_bid_credits", {
    _auction_id: auctionId,
    _user_id: user["id"],
    _count: count,
  });
  if (error) return fail(error.message || "buy_credits_failed");
  const res = (data || {}) as Row;
  if (!res["ok"]) {
    if (res["error"] === "insufficient_funds_for_credits") {
      return fail(`insufficient_funds_for_credits:${res["balance"] || 0}:${res["total"] || 0}`);
    }
    return fail(String(res["error"] || "buy_credits_failed"));
  }
  return ok({ ok: true, credits: Number(res["credits"] || 0), charged: Number(res["charged"] || 0) });
}


async function topup(user: Row, body: Payload) {
  if (user["paused"]) return fail("account_suspended", 403);
  if (isDenied(user, "topup_wallet")) return fail("permission_denied", 403);

  const action = body["action"] || "init";

  if (action === "confirm") {
    const sessionId = body["session_id"];
    const methodId = body["method_id"];
    if (!sessionId || !methodId) return fail("Missing session data");

    const { data: existing } = await admin
      .from("wallet_transactions")
      .select("*")
      .eq("provider_txn_id", sessionId)
      .limit(1);
    if (existing?.length) {
      const prior = existing[0] as Row;
      if (prior["user_id"] !== user["id"]) return fail("Forbidden", 403);
      return ok({ status: "confirmed", already: true, amount: prior["amount"] });
    }

    const cred = await credentialFor(methodId);
    if (!cred?.secret_key) return fail("Payment method not configured");

    const sres = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${cred.secret_key}` },
    });
    const sess: Row = await sres.json();
    if (!sess || sess["error"]) return fail(sess?.["error"]?.message || "Stripe lookup failed");
    if (sess["payment_status"] !== "paid") return fail("unpaid");

    // The session must belong to the caller and to the method that created it.
    const meta = (sess["metadata"] || {}) as Row;
    if (String(meta["user_id"] || "") !== String(user["id"])) return fail("Forbidden", 403);
    if (meta["payment_method_id"] && String(meta["payment_method_id"]) !== String(methodId)) {
      return fail("Forbidden", 403);
    }

    const creditAmount = Number(meta["amount"] || 0);
    if (creditAmount <= 0) return fail("Invalid amount");

    // The unique index on provider_txn_id makes a concurrent second confirm fail
    // here instead of crediting the wallet twice.
    const { error: insErr } = await admin.from("wallet_transactions").insert({
      user_id: user["id"],
      type: "topup",
      amount: creditAmount,
      description: "Card top-up",
      status: "confirmed",
      payment_method_id: methodId,
      provider: "stripe",
      provider_txn_id: sessionId,
      reference: String(sess["id"] || ""),
    });
    if (insErr) {
      if (String(insErr.code) === "23505") return ok({ status: "confirmed", already: true, amount: creditAmount });
      return fail(insErr.message || "topup_failed");
    }
    return ok({ status: "confirmed", amount: creditAmount });
  }

  const amount = Number(body["amount"]);
  const methodId = body["payment_method_id"];
  if (!methodId || !amount || amount <= 0) return fail("Invalid request");

  const method = await getRow("payment_methods", methodId);
  if (!method || !method["enabled"]) return fail("Method not available");

  if (method["type"] === "live_gateway" && method["provider"] === "stripe") {
    const cred = await credentialFor(methodId);
    if (!cred?.secret_key) return fail("Payment method not configured");

    // Currency is fixed on the server (PHP), never chosen by the caller.
    const currency = CURRENCY;
    const unit = CURRENCY_UNIT;
    const origin = body["app_url"] || String(body["success_url"] || "").replace(/\/wallet.*$/, "") || "";

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("payment_method_types[0]", "card");
    form.set("line_items[0][name]", "Wallet top-up");
    form.set("line_items[0][amount]", String(Math.round(amount * unit)));
    form.set("line_items[0][currency]", currency.toLowerCase());
    form.set("line_items[0][quantity]", "1");
    form.set("success_url", `${origin}/wallet?session_id={CHECKOUT_SESSION_ID}&method_id=${methodId}`);
    form.set("cancel_url", `${origin}/wallet`);
    form.set("metadata[user_id]", user["id"]);
    form.set("metadata[payment_method_id]", methodId);
    form.set("metadata[amount]", String(amount));

    const sres = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const sess: Row = await sres.json();
    if (!sess["id"]) return fail(sess["error"]?.message || "Stripe error");
    return ok({ status: "redirect", url: sess["url"] });
  }

  await admin.from("wallet_transactions").insert({
    user_id: user["id"],
    type: "topup",
    amount,
    description: method["name"],
    status: "pending",
    payment_method_id: methodId,
    reference: body["reference"] || "",
    provider: method["provider"] || method["type"],
  });
  return ok({ status: "pending" });
}

async function credentialFor(methodId: string) {
  const { data } = await admin
    .from("payment_method_credentials")
    .select("*")
    .eq("payment_method_id", methodId)
    .limit(1);
  return (data?.[0] as Row) || null;
}

async function requestRefund(user: Row, body: Payload) {
  const txnId = body["original_transaction_id"];
  if (!txnId) return fail("Missing transaction");

  const txn = await getRow("wallet_transactions", txnId);
  if (!txn || txn["user_id"] !== user["id"]) return fail("not_found");
  if (txn["status"] !== "confirmed") return fail("not_confirmed");

  const { data: existing } = await admin
    .from("refund_requests")
    .select("id")
    .eq("original_transaction_id", txnId)
    .eq("status", "pending")
    .limit(1);
  if (existing?.length) return fail("already_requested");

  await admin.from("refund_requests").insert({
    user_id: user["id"],
    original_transaction_id: txnId,
    reason: body["reason"] || "",
    status: "pending",
  });
  return ok();
}

async function claimFulfilment(user: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");

  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  if (!["ended", "archived", "live"].includes(a["status"])) return fail("auction_not_ended");
  if (a["winner_id"] !== user["id"]) return fail("not_winner");

  // One fulfilment per round: the same user may win this auction again after
  // a relaunch. Rows from before rounds were recorded have round = null.
  const round = Number(a["round"] || 1);
  const { data: existing } = await admin
    .from("fulfilments")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("winner_id", user["id"])
    .or(`round.eq.${round},round.is.null`)
    .limit(1);
  if (existing?.length) return ok({ ok: true, fulfilment: existing[0], already: true });

  const method = body["method"] === "pickup" ? "pickup" : "shipping";
  const values: Row = { auction_id: auctionId, winner_id: user["id"], method, status: "pending", round };

  if (method === "shipping") {
    const addr = body["address"] || {};
    if (!addr.line1 || !addr.city || !addr.name) return fail("incomplete_address");
    Object.assign(values, {
      address_name: addr.name,
      address_phone: addr.phone || "",
      address_line1: addr.line1,
      address_line2: addr.line2 || "",
      address_city: addr.city,
      address_country: addr.country || "",
      address_zip: addr.zip || "",
    });
  } else {
    values["pickup_notes"] = body["pickup_notes"] || "";
  }

  const { data: created, error } = await admin.from("fulfilments").insert(values).select().single();
  if (error) return fail(error.message, 500);
  return ok({ ok: true, fulfilment: created });
}

/* -------------------------------- admin -------------------------------- */

/**
 * One page of users for the admin Users / Participants tables. Search, filters,
 * sort, the page slice and the total count all run in Postgres, so the screens
 * stay correct however many accounts exist.
 *   payload: { page, pageSize, search, status, role, idsOnly, counts }
 *   status: "all" | one status | a list of statuses
 *   -> { users, notes, total, page, pageSize, pageCount }
 *   idsOnly -> { ids, total }     counts -> { counts: { pending, verified, rejected } }
 */
async function listUsers(actor: Row, body: Payload = {}) {
  const page = Math.max(1, Number(body["page"]) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(body["pageSize"]) || 25));
  // PostgREST `or` syntax: commas, parens and wildcards in the term would break the filter.
  const search = String(body["search"] || "").replace(/[%,()*\\]/g, " ").trim();
  const statuses: string[] = Array.isArray(body["status"])
    ? (body["status"] as unknown[]).map(String)
    : body["status"] && body["status"] !== "all" ? [String(body["status"])] : [];
  const status = statuses.length ? statuses.join(",") : "all";
  const roleFilter = String(body["role"] || "all");
  const idsOnly = body["idsOnly"] === true;
  const countsOnly = body["counts"] === true;

  // Signups older than the handle_new_user trigger get their profile row here
  // (one INSERT ... WHERE NOT EXISTS), on the unfiltered first page only.
  if (page === 1 && !search && status === "all" && roleFilter === "all" && !idsOnly && !countsOnly) {
    await admin.rpc("backfill_missing_profiles").then(() => undefined, () => undefined);
  }

  const { data: adminRows } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = [...new Set((adminRows || []).map((r: Row) => String(r.user_id)))];

  const build = (fields: string, opts: { head?: boolean; statuses?: string[] } = {}) => {
    let q = admin.from("profiles").select(fields, { count: "exact", head: !!opts.head });
    const only = opts.statuses ?? statuses;
    // Super admins are invisible to everyone except other super admins.
    if (!actor["is_super"]) q = q.eq("is_super", false);
    if (search) {
      q = q.or(["full_name", "email", "phone", "country"].map((c) => `${c}.ilike.%${search}%`).join(","));
    }
    if (only.length === 1) q = q.eq("verification_status", only[0]);
    else if (only.length > 1) q = q.in("verification_status", only);
    if (roleFilter === "admin") q = q.in("id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
    else if (roleFilter === "user" && adminIds.length) q = q.not("id", "in", `(${adminIds.join(",")})`);
    return q.order("created_date", { ascending: false });
  };

  if (countsOnly) {
    // Verification stat cards: one head-only count per status.
    const keys = ["pending", "verified", "rejected"];
    const results = await Promise.all(keys.map((k) => build("id", { head: true, statuses: [k] })));
    const counts: Record<string, number> = {};
    keys.forEach((k, i) => { counts[k] = Number(results[i].count || 0); });
    return ok({ counts });
  }

  if (idsOnly) {
    // "Select all matching" in Participants: ids only, in batches past the row cap.
    const ids: string[] = [];
    let total = 0;
    for (let from = 0; ; from += 1000) {
      const { data, count, error } = await build("id").range(from, from + 999);
      if (error) return fail(error.message, 500);
      total = Number(count || 0);
      ids.push(...(data || []).map((r: Row) => String(r["id"])));
      if (!data?.length || ids.length >= total) break;
    }
    return ok({ ids, total });
  }

  const from = (page - 1) * pageSize;
  const { data: profiles, count, error } = await build("*").range(from, from + pageSize - 1);
  if (error) return fail(error.message, 500);
  const rows = (profiles || []) as Row[];
  const total = Number(count || 0);

  const pageIds = rows.map((p) => p["id"]);
  const { data: notes } = pageIds.length
    ? await admin.from("participant_notes").select("*").in("user_id", pageIds).order("created_date", { ascending: false })
    : { data: [] };

  const adminSet = new Set(adminIds);
  return ok({
    users: rows.map((u) => {
      const base = adminSet.has(String(u["id"])) ? "admin" : "user";
      return {
        ...u,
        role: base,
        // The staff role is the named role from Roles & permissions; it falls
        // back to the base admin/user role when no custom role is assigned.
        staff_role: u["staff_role"] || base,
        is_verified: u["verification_status"] === "verified",
      };
    }),
    notes: notes || [],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

async function updateUser(actor: Row, body: Payload) {
  const userId = body["user_id"];
  if (!userId) return fail("Missing user_id");

  const target = await getUser(userId);
  if (!target) return fail("User not found", 404);
  if (target["is_super"] && !actor["is_super"]) return fail("Cannot edit a super admin", 403);

  const patch: Row = {};
  if (body["full_name"] !== undefined) patch["full_name"] = body["full_name"];
  if (body["verification_status"] !== undefined) {
    if (["pending", "verified", "rejected"].includes(body["verification_status"])) {
      patch["verification_status"] = body["verification_status"];
    }
    if (body["verification_note"] !== undefined) patch["verification_note"] = body["verification_note"];
  }
  if (body["permissions"] && typeof body["permissions"] === "object") {
    const out = { ...(target["permissions"] || {}) };
    for (const cap of CAPS) {
      const v = body["permissions"][cap];
      if (v === "allow" || v === "deny" || v === "inherit") out[cap] = v;
    }
    patch["permissions"] = out;
  }

  // Roles: "user" and "admin" are built in; any role defined in Roles &
  // permissions can also be assigned. A custom role grants admin-panel access
  // (via user_roles) whenever it enables at least one admin module.
  let roleChanged = false;
  const wanted = body["role"];
  const currentStaffRole = target["staff_role"] || target["role"];
  if (wanted !== undefined && wanted !== currentStaffRole) {
    if (!actor["is_super"]) return fail("Only a super admin can change roles", 403);

    let grantsAdmin = wanted === "admin";
    if (wanted !== "admin" && wanted !== "user") {
      const { data: defined } = await admin
        .from("roles")
        .select("name, permissions")
        .eq("name", wanted)
        .maybeSingle();
      if (!defined) return fail("Invalid role", 400);
      grantsAdmin = Object.values((defined["permissions"] as Row) || {}).some(Boolean);
    }

    if (grantsAdmin) {
      await mustWrite(admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" }));
    } else {
      await mustWrite(admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin"));
    }
    patch["staff_role"] = wanted === "user" || wanted === "admin" ? null : wanted;
    roleChanged = true;
  }

  if (!Object.keys(patch).length && !roleChanged) return ok({ ok: true, unchanged: true });
  if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", userId);
  return ok();
}

async function pauseUser(actor: Row, body: Payload) {
  if (!actor["is_super"]) return fail("Forbidden", 403);
  const userId = body["user_id"];
  if (!userId) return fail("Missing user_id");
  const pause = !!body["pause"];

  const target = await getUser(userId);
  if (!target) return fail("User not found", 404);
  if (target["is_super"]) return fail("Cannot suspend a super admin", 403);
  if (userId === actor["id"]) return fail("Cannot suspend yourself");

  await mustWrite(admin.from("profiles").update({ paused: pause }).eq("id", userId));

  const title = pause ? "Account suspended" : "Account reactivated";
  const text = pause
    ? "Your account has been suspended by an administrator. You can no longer log in or participate in auctions."
    : "Your account has been reactivated. You can log in and bid again.";
  await notify({ user_id: userId, title, body: text, type: pause ? "warning" : "success" });
  await emailUser(target["email"], title, text);
  return ok({ ok: true, paused: pause });
}

/**
 * Admin gift: adds free bid credits (extra numbers beyond the free quota) to
 * one or many participants for a specific auction. No wallet charge.
 */
async function grantBidCredits(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  const ids = Array.isArray(body["user_ids"]) ? (body["user_ids"] as string[]) : [];
  const count = Math.floor(Number(body["count"] ?? 1));
  if (!auctionId) return fail("Missing auction_id");
  if (!ids.length) return fail("No participants selected");
  if (!count || count < 1 || count > 100) return fail("invalid_count");

  const a = await getRow("auctions", String(auctionId));
  if (!a) return fail("Auction not found", 404);
  const round = Number(a["round"] || 1);

  const { data: existing } = await admin
    .from("bid_credits")
    .select("user_id, credits")
    .eq("auction_id", auctionId)
    .eq("round", round)
    .in("user_id", ids);

  const current = new Map<string, number>();
  (existing || []).forEach((r: Row) => current.set(String(r["user_id"]), Number(r["credits"] || 0)));

  const rows = ids.map((uid) => ({
    auction_id: String(auctionId),
    user_id: uid,
    round,
    credits: (current.get(uid) || 0) + count,
    updated_date: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("bid_credits")
    .upsert(rows, { onConflict: "auction_id,user_id,round" });
  if (error) return fail(error.message || "grant_failed");

  for (const uid of ids) {
    await notify({
      user_id: uid,
      title: "Free bids added",
      body: `You received ${count} free bid${count > 1 ? "s" : ""} for "${a["title"]}".`,
      type: "success",
      auction_id: String(auctionId),
    });
  }
  await logAdminAction(actor, "bid_credits_granted", "auction", String(auctionId), JSON.stringify({ count, users: ids.length }));
  return ok({ ok: true, granted: ids.length, count });
}



async function deleteUser(actor: Row, body: Payload) {
  if (!actor["is_super"]) return fail("Forbidden", 403);
  const userId = body["user_id"];
  if (!userId) return fail("Missing user_id");
  if (userId === actor["id"]) return fail("Cannot delete yourself");

  const target = await getUser(userId);
  if (!target) return fail("User not found", 404);
  if (target["is_super"]) return fail("Cannot delete a super admin", 403);

  await admin.auth.admin.deleteUser(userId).catch(() => null);
  await mustWrite(admin.from("profiles").delete().eq("id", userId));
  return ok();
}

async function resolveVerification(_actor: Row, body: Payload) {
  const userId = body["user_id"];
  if (!userId) return fail("Missing user_id");
  const decision = body["decision"] === "reject" ? "rejected" : "verified";

  await admin
    .from("profiles")
    .update({ verification_status: decision, verification_note: body["note"] || "" })
    .eq("id", userId);

  const text =
    decision === "verified"
      ? "Your identity has been verified. You can now join and bid in auctions."
      : `Your identity verification was rejected. ${body["note"] || ""}`.trim();
  const title = decision === "verified" ? "Identity verified" : "Verification rejected";

  await notify({ user_id: userId, title, body: text, type: decision === "verified" ? "success" : "warning" });
  const target = await getRow("profiles", userId);
  await emailUser(target?.["email"], title, text);
  return ok({ ok: true, status: decision });
}

async function approveTopup(actor: Row, body: Payload) {
  const txnId = body["transaction_id"];
  const decision = body["decision"] === "reject" ? "reject" : "approve";
  if (!txnId) return fail("Missing transaction_id");

  const txn = await getRow("wallet_transactions", txnId);
  if (!txn) return fail("not_found", 404);
  if (txn["status"] !== "pending") return fail("Transaction not pending");

  const approved = decision === "approve";
  const reason = String(body["reason"] || "").trim().slice(0, 300);
  // Conditional on "pending": two admins clicking at once cannot credit twice.
  const { data: updated, error: updErr } = await admin
    .from("wallet_transactions")
    .update({
      status: approved ? "confirmed" : "failed",
      notes: `${approved ? "Approved" : "Rejected"} by ${actor["email"] || actor["id"]}${reason ? `: ${reason}` : ""}`,
    })
    .eq("id", txnId)
    .eq("status", "pending")
    .select("id");
  if (updErr) return fail(updErr.message || "write_failed", 500);
  if (!updated?.length) return fail("Transaction not pending", 409);

  await notify({
    user_id: txn["user_id"],
    title: approved ? "Top-up approved" : "Top-up rejected",
    body: approved
      ? "Your wallet top-up has been confirmed."
      : reason
        ? `Your wallet top-up request was rejected: ${reason}`
        : "Your wallet top-up request was rejected. Please contact support.",
    type: approved ? "success" : "warning",
  });
  return ok({ status: approved ? "approved" : "rejected" });
}

async function resolveRefund(_actor: Row, body: Payload) {
  const id = body["request_id"];
  const decision = body["decision"] === "reject" ? "rejected" : "approved";
  if (!id) return fail("Missing request_id");

  const r = await getRow("refund_requests", id);
  if (!r) return fail("not_found", 404);
  if (r["status"] !== "pending") return fail("already_resolved");

  const patch: Row = { status: decision, admin_note: body["note"] || "" };

  // Claim the request first: only the caller that flips it away from
  // "pending" is allowed to move money.
  const { data: claimed, error: claimErr } = await admin
    .from("refund_requests")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (claimErr) return fail(claimErr.message || "write_failed", 500);
  if (!claimed?.length) return fail("already_resolved", 409);

  if (decision === "approved") {
    const txn = await getRow("wallet_transactions", r["original_transaction_id"]);
    // The refunded charge must belong to the person being refunded.
    if (!txn || txn["user_id"] !== r["user_id"]) return fail("refund_transaction_mismatch", 409);
    const credit = Math.abs(Number(txn["amount"] || 0));
    if (!(credit > 0)) return fail("refund_amount_invalid", 409);
    const { data: refundTx, error: refundErr } = await admin
      .from("wallet_transactions")
      .insert({
        user_id: r["user_id"],
        type: "refund",
        amount: credit,
        description: `Refund: ${txn["description"] || ""}`,
        auction_id: txn["auction_id"] || null,
        status: "confirmed",
        // Unique per refunded charge, so the same charge can never be
        // credited back twice.
        provider_txn_id: `refund:${txn["id"]}`,
      })
      .select()
      .single();
    if (refundErr) {
      if (String(refundErr.code) === "23505") return fail("already_refunded", 409);
      return fail(refundErr.message || "write_failed", 500);
    }
    await mustWrite(
      admin.from("refund_requests").update({ refund_transaction_id: refundTx?.id ?? null }).eq("id", id),
    );
  }

  const text =
    decision === "approved"
      ? "Your refund request has been approved and credited to your wallet."
      : `Your refund request was rejected. ${body["note"] || ""}`.trim();
  const title = decision === "approved" ? "Refund approved" : "Refund rejected";
  await notify({ user_id: r["user_id"], title, body: text, type: decision === "approved" ? "success" : "warning" });
  const member = await getRow("profiles", r["user_id"]);
  await emailUser(member?.["email"], title, text);
  return ok({ ok: true, status: decision });
}

/**
 * True once the winner's payment for this auction is settled. The payment
 * record (winner_payments, set by markWinnerPaid) is the source of truth;
 * auctions.paid is also accepted for wins marked paid before that existed.
 */
async function winnerHasPaid(auctionId: string, winnerId: string): Promise<boolean> {
  const { data } = await admin
    .from("winner_payments")
    .select("status")
    .eq("auction_id", auctionId)
    .eq("user_id", winnerId)
    .eq("status", "paid")
    .limit(1);
  if ((data || []).length) return true;
  const a = await getRow("auctions", auctionId);
  return !!a?.["paid"] && a?.["winner_id"] === winnerId;
}

async function updateFulfilment(_actor: Row, body: Payload) {
  const id = body["fulfilment_id"];
  if (!id) return fail("Missing fulfilment_id");

  const f = await getRow("fulfilments", id);
  if (!f) return fail("not_found", 404);

  // The winner may enter delivery details before paying, but nothing ships
  // (or is handed over) until the win is paid.
  const nextStatus = String(body["status"] || f["status"]);
  if (nextStatus !== String(f["status"]) && nextStatus !== "pending") {
    if (!(await winnerHasPaid(String(f["auction_id"]), String(f["winner_id"])))) {
      return fail("payment_required", 409);
    }
  }

  const patch: Row = { status: nextStatus };
  if (body["carrier"] !== undefined) patch["carrier"] = body["carrier"];
  if (body["tracking_number"] !== undefined) patch["tracking_number"] = body["tracking_number"];
  if (body["notes"] !== undefined) patch["notes"] = body["notes"];
  await mustWrite(admin.from("fulfilments").update(patch).eq("id", id));

  const a = await getRow("auctions", f["auction_id"]);
  const title = a?.["title"] || "Your auction";
  const text = `Delivery update for "${title}": ${patch["status"]}${
    patch["tracking_number"] ? ` — tracking ${patch["tracking_number"]}` : ""
  }`;
  await notify({ user_id: f["winner_id"], title: "Delivery update", body: text, type: "info", auction_id: f["auction_id"] });
  const winner = await getRow("profiles", f["winner_id"]);
  await emailUser(winner?.["email"], "Delivery update", text);
  return ok({ ok: true, status: patch["status"] });
}

/**
 * Admin: set a member's password directly (for someone who can't receive the
 * reset email). Staff accounts can only be changed by a super admin, and a
 * super admin only by another super admin.
 */
async function setUserPassword(actor: Row, body: Payload) {
  const userId = body["user_id"];
  const password = typeof body["password"] === "string" ? body["password"] : "";
  if (!userId) return fail("Missing user_id");
  if (password.length < 8) return fail("password_too_short", 422);
  if (password.length > 72) return fail("password_too_long", 422);

  const target = await getUser(String(userId));
  if (!target) return fail("User not found", 404);
  if (target["is_super"] && !actor["is_super"]) return fail("Cannot edit a super admin", 403);
  if (target["role"] === "admin" && !actor["is_super"]) return fail("Only a super admin can change a staff password", 403);

  const { error } = await admin.auth.admin.updateUserById(String(userId), { password });
  if (error) return fail(error.message, 422);

  await logAdminAction(actor, "user_password_set", "user", String(userId), String(target["email"] || ""));
  await notify({
    user_id: userId,
    title: "Password changed",
    body: "An administrator set a new password for your account. If you didn't ask for this, contact support.",
    type: "warning",
  });
  return ok({ ok: true });
}

async function inviteUser(actor: Row, body: Payload) {
  const email = body["email"];
  if (!email) return fail("Missing email");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) return fail(error.message);
  const invitedId = data?.user?.id;
  const role = body["role"];
  if (invitedId && role && role !== "user") {
    if (!actor["is_super"]) return fail("Only a super admin can invite staff with a role", 403);
    // Reuse the same validation/assignment path as a role change so an invited
    // staff member lands on exactly the same permissions as an existing one.
    const res = await updateUser(actor, { user_id: invitedId, role });
    if (res.status >= 400) return res;
  }
  return ok();
}

async function sendEmail(_actor: Row, body: Payload) {
  await emailUser(body["to"], body["subject"] || "", body["body"] || "");
  return ok();
}

/**
 * The scheduled tick (and any viewer's list sync): starts due auctions, ends
 * expired ones, invoices winners and notifies them. It never reopens an ended
 * auction: when nothing is left open or live it only logs queue.empty.
 */
export async function finalizeAuctions() {
  const { data: auctions } = await admin
    .from("auctions")
    .select("*")
    .in("status", ["open", "live"])
    .order("updated_date", { ascending: false })
    .limit(500);
  const ids: string[] = [];
  let closed = 0;

  for (const a of (auctions || []) as Row[]) {
    const next = await ensureAuctionState(a);
    if (next["status"] !== a["status"]) {
      ids.push(a["id"]);
      if (["ended", "voided", "voiding"].includes(next["status"])) closed++;
    }
  }

  // Only on the tick that closed the last one, not every minute after.
  if (closed > 0) {
    const { count } = await admin
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "live"]);
    if ((count || 0) === 0) await logLifecycle("queue.empty", null, "system", null, { closed });
  }

  // Automatic hold release: expired retry windows and holds left on rounds that
  // are no longer live are freed on every tick.
  let holds: Row = null;
  try {
    const { data } = await admin.rpc("release_expired_holds");
    holds = data ?? null;
  } catch {
    holds = null;
  }

  return { finalized: ids.length, ids, holds, at: new Date().toISOString() };
}

/** Admin: open -> live now (instead of waiting for the first join / schedule). */
async function startAuction(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  if (a["status"] !== "open" || a["start_time"]) return fail(`This auction is already ${a["status"]}.`, 409);

  const now = Date.now();
  const patch = {
    status: "live",
    start_time: new Date(now).toISOString(),
    end_time: new Date(now + Number(a["duration_minutes"] || 5) * 60000).toISOString(),
  };
  const { data: started } = await admin
    .from("auctions")
    .update(patch)
    .eq("id", auctionId)
    .eq("status", "open")
    .is("start_time", null)
    .select("*");
  if (!started?.length) return fail("This auction was started by someone else.", 409);

  await logLifecycle("auction.started", started[0], "admin", actor, { trigger: "manual" });
  return ok({ auction: started[0] });
}

/** Admin: close one live auction immediately through the normal settlement path. */
async function closeAuction(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const auction = await getRow("auctions", auctionId);
  if (!auction) return fail("not_found", 404);
  if (auction["status"] !== "live") return fail("Only a live auction can be closed", 409);

  const settled = await settleAuction(auction, "admin", actor);
  return ok({
    auction_id: settled["id"],
    status: settled["status"],
    winner_id: settled["winner_id"] || null,
    winning_amount: Number(settled["current_price"] || 0),
  });
}

const FULFILMENT_DONE = ["delivered", "collected", "confirmed", "cancelled"];

/**
 * Why this ended round cannot be relaunched yet, or null. A won round must be
 * settled first: no payment request still pending, and every paid win's
 * delivery / pickup finished (or cancelled).
 */
async function relaunchBlocker(a: Row): Promise<string | null> {
  if (a["status"] !== "ended" || !a["winner_id"]) return null;
  const round = Number(a["round"] || 1);
  const { data: payments } = await admin
    .from("winner_payments")
    .select("user_id, status")
    .eq("auction_id", a["id"])
    .eq("round", round);
  const list = (payments || []) as Row[];
  if (list.some((p) => p["status"] === "pending")) {
    return "The winner's payment is still pending. Mark it paid or void the win first.";
  }
  for (const p of list.filter((x) => x["status"] === "paid")) {
    const { data: orders } = await admin
      .from("fulfilments")
      .select("status, round")
      .eq("auction_id", a["id"])
      .eq("winner_id", p["user_id"]);
    const order = ((orders || []) as Row[]).find((o) => o["round"] == null || Number(o["round"]) === round);
    if (!order) return "The winner has paid but has not chosen delivery or pickup yet. Finish the fulfilment first.";
    if (!FULFILMENT_DONE.includes(order["status"])) {
      return "The winner's delivery or pickup is not finished yet. Complete the fulfilment first.";
    }
  }
  return null;
}

/**
 * Admin: an ended or cancelled auction goes back to Open as the next round on
 * the same row. The finished round stays in auction_rounds, its bids are
 * archived and its payments are keyed by round, so nothing of it is lost.
 * Two clicks at once: only the first applies, the second gets 409.
 */
async function relaunchAuction(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  if (a["status"] !== "ended" && a["status"] !== "voided") {
    return fail(`Only an ended or cancelled auction can be relaunched (this one is ${a["status"]}).`, 409);
  }
  const blocker = await relaunchBlocker(a);
  if (blocker) return fail(blocker, 422);

  const round = Number(a["round"] || 1);
  await recordRound(a, a["status"] === "voided" ? "voided" : a["winner_id"] ? "won" : "no_winner");

  const { data: relaunched } = await admin
    .from("auctions")
    .update({
      status: "open",
      start_time: null,
      end_time: null,
      scheduled_start_time: null,
      winner_id: null,
      winner_name: null,
      winner_notified: false,
      paid: false,
      highest_bidder_id: null,
      current_price: Number(a["start_price"] || 0),
      subscriber_ids: [],
      round: round + 1,
      restart_count: 0,
      relaunch_count: Number(a["relaunch_count"] || 0) + 1,
    })
    .eq("id", auctionId)
    .eq("status", a["status"])
    .eq("round", round)
    .select("*");
  if (!relaunched?.length) return fail("This auction was already relaunched.", 409);

  // A clean leaderboard for the new round; the old bids stay for history.
  await admin.from("bids").update({ archived: true }).eq("auction_id", auctionId).eq("archived", false);

  await logLifecycle("auction.relaunched", relaunched[0], "admin", actor, { from_round: round, to_round: round + 1 });
  return ok({ auction: relaunched[0] });
}

/** Admin: an ended or cancelled auction leaves the active list (read-only). */
async function archiveAuction(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  if (a["status"] !== "ended" && a["status"] !== "voided") {
    return fail(`Only an ended or cancelled auction can be archived (this one is ${a["status"]}).`, 409);
  }
  const { data: archived } = await admin
    .from("auctions")
    .update({ status: "archived", featured: false, featured_order: 0 })
    .eq("id", auctionId)
    .eq("status", a["status"])
    .select("*");
  if (!archived?.length) return fail("This auction changed in the meantime. Refresh and try again.", 409);

  await logLifecycle("auction.archived", archived[0], "admin", actor, { from: a["status"] });
  return ok({ auction: archived[0] });
}


/* --------------------------- winner payments --------------------------- */

/** Winner (or admin) reads a payment request by its link token or auction id. */
async function winnerPayment(user: Row, body: Payload) {
  const token = body["token"] ? String(body["token"]) : null;
  const auctionId = body["auction_id"] ? String(body["auction_id"]) : null;
  if (!token && !auctionId) return fail("Missing token");

  let q = admin.from("winner_payments").select("*");
  q = token ? q.eq("token", token) : q.eq("auction_id", auctionId!).eq("user_id", user["id"]);
  const { data } = await q.order("created_date", { ascending: false }).limit(1);
  const p = (data || [])[0] as Row | undefined;
  if (!p) return fail("not_found", 404);
  if (p["user_id"] !== user["id"] && user["role"] !== "admin") return fail("Forbidden", 403);

  const a = await getRow("auctions", p["auction_id"]);
  return ok({
    payment: {
      id: p["id"],
      token: p["token"],
      amount: Number(p["amount"] || 0),
      status: p["status"],
      round: p["round"],
      paid_at: p["paid_at"] || null,
      paid_reference: p["paid_reference"] || null,
      created_date: p["created_date"],
    },
    auction: a
      ? {
          id: a["id"],
          title: a["title"],
          image_url: a["image_url"] || null,
          mode: a["mode"] || "highest",
          end_time: a["end_time"] || null,
        }
      : null,
  });
}

/** Member: wallet total, reserved (escrow) funds and what is actually spendable. */
async function walletExposure(user: Row, _body: Payload) {
  const total = await getConfirmedBalance(user["id"]);
  const available = await availableBalance(user["id"]);
  const { data } = await admin
    .from("bid_holds")
    .select("auction_id, round, amount, status, reason, retry_until")
    .eq("user_id", user["id"])
    .eq("status", "held")
    .limit(100);
  const holds = (data || []) as Row[];
  return ok({
    balance: total,
    available,
    held: Math.round((total - available) * 100) / 100,
    holds,
  });
}

/**
 * Admin: one page of wins and whether each manual payment has been collected.
 *   payload: { page, pageSize, status, auction_id, search }
 *   search matches the auction title, the winner name / email, the pay token or the paid reference.
 *   -> { payments, total, page, pageSize, pageCount }
 */
async function listWinnerPayments(_actor: Row, body: Payload) {
  const page = Math.max(1, Number(body["page"]) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(body["pageSize"]) || 25));
  const search = String(body["search"] || "").replace(/[%,()*\\"]/g, " ").trim();

  let q = admin.from("winner_payments").select("*", { count: "exact" }).order("created_date", { ascending: false });
  if (body["status"] && body["status"] !== "all") q = q.eq("status", String(body["status"]));
  if (body["auction_id"]) q = q.eq("auction_id", String(body["auction_id"]));
  if (search) {
    // Title and name live on other tables: resolve them to ids first (bounded lookups).
    const [{ data: aRows }, { data: uRows }] = await Promise.all([
      admin.from("auctions").select("id").ilike("title", `%${search}%`).limit(1000),
      admin.from("profiles").select("id").or(`full_name.ilike.%${search}%,email.ilike.%${search}%`).limit(1000),
    ]);
    const parts = [`token.ilike.%${search}%`, `paid_reference.ilike.%${search}%`];
    const aIds = (aRows || []).map((r: Row) => r["id"]);
    const uIds = (uRows || []).map((r: Row) => r["id"]);
    if (aIds.length) parts.push(`auction_id.in.(${aIds.join(",")})`);
    if (uIds.length) parts.push(`user_id.in.(${uIds.join(",")})`);
    q = q.or(parts.join(","));
  }
  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.range(from, from + pageSize - 1);
  if (error) return fail(error.message, 500);
  const total = Number(count || 0);
  return ok({ payments: data || [], total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
}

/** Admin: mark a win as paid outside the wallet (bank transfer, cash, link). */
async function markWinnerPaid(actor: Row, body: Payload) {
  const id = body["payment_id"];
  if (!id) return fail("Missing payment_id");
  const { data } = await admin
    .from("winner_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_reference: body["reference"] ? String(body["reference"]) : null,
      note: body["note"] ? String(body["note"]) : null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*");
  const p = (data || [])[0] as Row | undefined;
  if (!p) return fail("not_pending", 409);

  await admin.from("auctions").update({ paid: true }).eq("id", p["auction_id"]);
  // Payment collected outside the wallet: the escrow hold is no longer needed.
  await releaseUserHold(String(p["auction_id"]), Number(p["round"] || 1), String(p["user_id"]), "payment_received");
  await notify({
    user_id: p["user_id"],
    title: "Payment received",
    body: "Your payment was confirmed. We will contact you about delivery.",
    type: "success",
    auction_id: p["auction_id"],
  });
  await logAdminAction(actor, "winner_payment_paid", "winner_payment", String(p["id"]), `${p["amount"]}`);
  return ok({ payment: p });
}

/**
 * Admin: void an unpaid win and promote the runner-up once. The promoted
 * runner-up gets their own payment link; if there is nobody left the auction
 * closes without a winner.
 */
async function voidWin(actor: Row, body: Payload) {
  const id = body["payment_id"];
  if (!id) return fail("Missing payment_id");
  const { data } = await admin
    .from("winner_payments")
    .update({ status: "void", note: body["note"] ? String(body["note"]) : null })
    .eq("id", id)
    .eq("status", "pending")
    .select("*");
  const p = (data || [])[0] as Row | undefined;
  if (!p) return fail("not_pending", 409);

  const a = await getRow("auctions", p["auction_id"]);
  if (!a) return fail("not_found", 404);
  await releaseUserHold(String(p["auction_id"]), Number(p["round"] || 1), String(p["user_id"]), "win_voided");

  // Everyone who already had a payment request for this round is skipped, so a
  // win is only ever offered once per participant.
  const { data: previous } = await admin
    .from("winner_payments")
    .select("user_id")
    .eq("auction_id", a["id"])
    .eq("round", Number(a["round"] || 1));
  const excluded = new Set<string>((previous || []).map((r: Row) => String(r["user_id"])));

  const runnerUp = await findRunnerUp(a, excluded);
  const patch: Row = { paid: false, winner_id: runnerUp?.userId || null };
  if (runnerUp) {
    patch["current_price"] = runnerUp.amount;
    if (isClosest(a)) patch["highest_bidder_id"] = runnerUp.userId;
    const payment = await ensureWinnerPayment(
      { ...a, round: Number(a["round"] || 1) },
      runnerUp.userId,
      runnerUp.amount,
    );
    const winner = await getRow("profiles", runnerUp.userId);
    patch["winner_name"] =
      winner?.["full_name"] || (winner?.["email"] ? String(winner["email"]).split("@")[0] : "Winner");
    const link = payment?.["token"] ? `/pay/${payment["token"]}` : null;
    const text =
      `You won "${a["title"]}" with ${runnerUp.amount}.` +
      (link ? ` Complete your payment here: ${link}` : "");
    await notify({
      user_id: runnerUp.userId,
      title: "You won the auction! 🎉",
      body: text,
      type: "announcement",
      auction_id: a["id"],
    });
    await emailUser(winner?.["email"], "You won the auction! 🎉", text);
  } else {
    patch["winner_name"] = null;
    patch["winner_notified"] = false;
  }
  await mustWrite(admin.from("auctions").update(patch).eq("id", a["id"]));
  await logAdminAction(actor, "winner_payment_void", "winner_payment", String(p["id"]), String(runnerUp?.userId || "no_runner_up"));
  return ok({ promoted: runnerUp?.userId || null, amount: runnerUp?.amount ?? null });
}

/** Next best bidder for the round, ignoring anyone already offered the win. */
async function findRunnerUp(a: Row, excluded: Set<string>): Promise<{ userId: string; amount: number } | null> {
  const round = Number(a["round"] || 1);
  let q = admin
    .from("bids")
    .select("user_id, amount, created_date, burned")
    .eq("auction_id", a["id"])
    .eq("round", round)
    .eq("archived", false);
  if (isClosest(a) && Number(a["target_price"] || 0) > 0) q = q.lte("amount", Number(a["target_price"]));
  const { data } = await q.order("amount", { ascending: false }).order("created_date", { ascending: true });

  const rows = (data || []) as Row[];
  const pick = (burned: boolean) =>
    rows.find((r) => !excluded.has(String(r["user_id"])) && Boolean(r["burned"]) === burned);
  const row = pick(false) || (isClosest(a) ? pick(true) : undefined);
  return row ? { userId: String(row["user_id"]), amount: Number(row["amount"]) } : null;
}

/** Admin: cancel a round and refund every participant exactly once. */
async function voidAuction(actor: Row, body: Payload) {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction_id");
  const a = await getRow("auctions", auctionId);
  if (!a) return fail("not_found", 404);
  const { data: res } = await admin.rpc("void_auction_refund", {
    _auction_id: auctionId,
    _reason: body["reason"] ? String(body["reason"]) : "cancelled_by_admin",
  });
  for (const uid of (a["subscriber_ids"] || []) as string[]) {
    await notify({
      user_id: uid,
      title: "Auction cancelled",
      body: `"${a["title"]}" was cancelled. Your entry fee and bid fees were refunded to your wallet.`,
      type: "announcement",
      auction_id: a["id"],
    });
  }
  await recordRound(a, "voided");
  await logLifecycle("auction.voided", a, "admin", actor, { reason: body["reason"] || "cancelled_by_admin", refund: res ?? null });
  return ok({ refund: res ?? null });
}

/** Any signed-in viewer can nudge every auction's clock forward (list pages). */
async function syncAuctions(_user: Row, _body: Payload) {
  return ok(await finalizeAuctions());
}


const MEMBER_HANDLERS: Record<string, (user: Row, body: Payload) => Promise<Result>> = {
  joinAuction,
  placeBid,
  auctionBidState,
  auctionFreeNumber,
  auctionNumberPool,


  buyBidCredits,
  syncAuction,
  syncAuctions,

  topup,
  requestRefund,
  claimFulfilment,
  winnerPayment,
  walletExposure,
};


/**
 * Business overview for the admin Overview screen. All aggregation happens in
 * Postgres (admin_dashboard) so the browser never downloads raw ledgers.
 */
async function adminDashboard(_actor: Row, body: Payload) {
  const days = Math.min(Math.max(Number(body["days"]) || 30, 1), 365);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const { data, error } = await admin.rpc("admin_dashboard", {
    _from: from.toISOString(),
    _to: new Date(to.getTime() + 1).toISOString(),
  });
  if (error) return fail(error.message, 500);
  return ok({ days, ...(data || {}) });
}

/** Capabilities the signed-in staff member holds (drives the admin UI). */
async function myAdminCapabilities(actor: Row) {
  const isAdmin = actor["role"] === "admin";
  if (!isAdmin) return ok({ is_admin: false, capabilities: [], is_super: false, staff_role: null });
  const { data, error } = await admin.rpc("my_admin_capabilities_for", { _user_id: actor["id"] });
  if (error) return fail(error.message, 500);
  return ok({ is_admin: true, capabilities: data || [], is_super: !!actor["is_super"], staff_role: actor["staff_role"] || null });
}

/** Full role hierarchy + capability matrix for the Roles & access screen. */
async function listRoleAccess() {
  const [caps, roles, grants] = await Promise.all([
    admin.from("admin_capabilities").select("*").order("sort_order"),
    admin.from("roles").select("*").order("level", { ascending: false }),
    admin.from("role_capabilities").select("role_id, capability_key, allowed"),
  ]);
  if (caps.error || roles.error || grants.error) {
    return fail((caps.error || roles.error || grants.error)!.message, 500);
  }
  return ok({ capabilities: caps.data || [], roles: roles.data || [], grants: grants.data || [] });
}

/** Save a role's rank and which admin actions it may perform. */
async function saveRoleAccess(actor: Row, body: Payload) {
  const roleId = body["role_id"];
  if (!roleId) return fail("Missing role_id");
  const role = await getRow("roles", roleId);
  if (!role) return fail("not_found", 404);

  if (body["level"] != null) {
    const level = Math.min(Math.max(Number(body["level"]) || 0, 0), 100);
    if (level >= 100 && !actor["is_super"]) return fail("Only a super admin can grant top-level access", 403);
    await mustWrite(admin.from("roles").update({ level }).eq("id", roleId));
  }

  const grants = body["capabilities"];
  if (grants && typeof grants === "object") {
    const { data: known } = await admin.from("admin_capabilities").select("key");
    const valid = new Set((known || []).map((c: Row) => String(c.key)));
    const rows = Object.entries(grants as Record<string, unknown>)
      .filter(([key]) => valid.has(key))
      .map(([key, allowed]) => ({ role_id: roleId, capability_key: key, allowed: !!allowed }));
    if (rows.length) {
      const { error } = await admin.from("role_capabilities").upsert(rows, { onConflict: "role_id,capability_key" });
      if (error) return fail(error.message, 500);
    }
  }

  await logAdminAction(actor, "role_access_updated", "role", String(roleId), String(role["name"] || ""));
  return listRoleAccess();
}

const ADMIN_HANDLERS: Record<string, (actor: Row, body: Payload) => Promise<Result>> = {
  adminDashboard,
  updateUser,
  setUserPassword,
  pauseUser,
  grantBidCredits,

  deleteUser,
  resolveVerification,
  approveTopup,
  resolveRefund,
  updateFulfilment,
  inviteUser,
  sendEmail,
  createTestAuction,
  reconcileAuctionPayments,
  getParticipantFile,
  listWinnerPayments,
  markWinnerPaid,
  voidWin,
  voidAuction,
  startAuction,
  closeAuction,
  relaunchAuction,
  archiveAuction,
  listRoleAccess,
  saveRoleAccess,
};

/**
 * Which capability each admin action requires. The database decides whether the
 * signed-in staff role holds it (public.has_admin_capability).
 */
const ACTION_CAPABILITY: Record<string, string> = {
  adminDashboard: "dashboard.view",
  listUsers: "users.view",
  getParticipantFile: "users.view",
  updateUser: "users.edit",
  setUserPassword: "users.edit",
  resolveVerification: "users.verify",
  pauseUser: "users.suspend",
  deleteUser: "users.delete",
  inviteUser: "users.invite",
  grantBidCredits: "credits.grant",
  approveTopup: "payments.approve",
  resolveRefund: "refunds.resolve",
  listWinnerPayments: "finance.view",
  markWinnerPaid: "winners.manage",
  voidWin: "winners.manage",
  updateFulfilment: "fulfilment.manage",
  sendEmail: "messaging.send",
  voidAuction: "auctions.void",
  startAuction: "auctions.manage",
  closeAuction: "auctions.manage",
  relaunchAuction: "auctions.manage",
  archiveAuction: "auctions.manage",
  createTestAuction: "auctions.testmode",
  reconcileAuctionPayments: "auctions.testmode",
  finalizeAuctions: "auctions.manage",
  listRoleAccess: "roles.manage",
  saveRoleAccess: "roles.manage",
};

async function allowedTo(userId: string, capability: string) {
  const { data, error } = await admin.rpc("has_admin_capability", { _user_id: userId, _key: capability });
  if (error) return false;
  return data === true;
}


export async function runBackendFunction(name: string, payload: Payload, userId: string): Promise<Result> {
  const user = await getUser(userId);
  if (!user) return fail("Unauthorized", 401);

  const memberHandler = MEMBER_HANDLERS[name];
  if (memberHandler) {
    if (name !== "placeBid" && name !== "joinAuction") return memberHandler(user, payload);

    // Every bid/join attempt is audited with its latency, outcome and reason so
    // rare inconsistencies can be reconstructed after the fact.
    const startedAt = Date.now();
    const auctionId = payload["auction_id"] || null;
    const before = auctionId ? await getRow("auctions", auctionId) : null;
    let result: Result;
    let thrown: unknown = null;
    try {
      result = await memberHandler(user, payload);
    } catch (e) {
      thrown = e;
      result = fail(e instanceof Error ? e.message : "unhandled_error", 500);
    }

    const reason = result.status >= 400 || result.data["error"] ? String(result.data["error"] || "error") : null;
    const cls = thrown ? { outcome: "error", severity: "error" } : classify(reason);
    const after = auctionId ? await getRow("auctions", auctionId) : null;
    const priceBefore = Number(before?.["current_price"] || 0);
    const priceAfter = Number(after?.["current_price"] || 0);
    // A price that moves backwards can only be a concurrency defect.
    const regression = priceAfter < priceBefore;

    await logBidEvent({
      auction_id: auctionId,
      user_id: user["id"],
      event: name === "placeBid" ? "bid" : "join",
      outcome: cls.outcome,
      reason,
      mode: before?.["mode"] || null,
      amount: payload["amount"] != null ? Number(payload["amount"]) : null,
      price_before: priceBefore,
      price_after: priceAfter,
      round: before ? Number(before["round"] || 1) : null,
      latency_ms: Date.now() - startedAt,
      severity: regression ? "error" : cls.severity,
      details: {
        ...(regression ? { anomaly: "price_regression" } : {}),
        ...(result.data["burned"] ? { burned: true } : {}),
        status: result.status,
        auction_status: after?.["status"] || null,
        seats: after ? (after["subscriber_ids"]?.length || 0) : null,
      },
    });

    return result;
  }

  if (name === "myAdminCapabilities") return myAdminCapabilities(user);

  if (name === "listUsers" || ADMIN_HANDLERS[name] || name === "finalizeAuctions") {
    if (user["role"] !== "admin") return fail("Forbidden", 403);

    // The role hierarchy in the database decides which admin actions this
    // staff member may perform. Super admins hold every capability.
    const capability = ACTION_CAPABILITY[name];
    if (capability && !(await allowedTo(user["id"], capability))) {
      return fail(`Your role cannot perform this action (${capability})`, 403);
    }

    // A write that the database rejects must surface as a failure, never as
    // a silent success the screen reports as "saved".
    try {
      if (name === "listUsers") return listUsers(user, payload);
      if (name === "finalizeAuctions") return ok(await finalizeAuctions());
      return await ADMIN_HANDLERS[name]!(user, payload);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "write_failed", 500);
    }
  }


  return fail(`Unknown function: ${name}`, 404);
}
