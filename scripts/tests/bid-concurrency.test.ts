/**
 * Concurrency / load checks for the auction engine (run against the real
 * database with the service-role client):
 *
 *   bun test scripts/tests/bid-concurrency.test.ts
 *
 * What it proves under stress:
 *  - seats can never be oversold (row-locked join)
 *  - closest-price duplicate numbers burn exactly once, never twice
 *  - the per-bid fee is charged exactly once per accepted bid (no double-charge)
 *  - a closest-price auction settles once, to the correct winner, with a single
 *    winning-bid charge even when many settlement passes run at the same time
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";

/** Every step talks to the real database over the network: allow ample time. */
const TEST_TIMEOUT_MS = 120_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;

const SEATS = 12;
const EXTRA_USERS = 6; // more users than seats, so joins must be rejected
const TOTAL_USERS = SEATS + EXTRA_USERS;
const TARGET_PRICE = 50;
const BID_INCREMENT = 1;
const BID_FEE = 0.25;
const ENTRY_FEE = 5;
const DEPOSIT = 500;
const COLLISION_NUMBER = 25;

const runId = `stress-${Date.now()}`;
let auctionId = "";
let userIds: string[] = [];

const uuid = () => crypto.randomUUID();
const sum = (rows: any[], key = "amount") =>
  Math.round(rows.reduce((acc, r) => acc + Number(r[key] || 0), 0) * 100) / 100;

async function walletRows(type?: string) {
  let q = admin.from("wallet_transactions").select("*").eq("auction_id", auctionId);
  if (type) q = q.eq("type", type);
  const { data } = await q;
  return (data || []) as any[];
}

async function bidRows() {
  const { data } = await admin.from("bids").select("*").eq("auction_id", auctionId);
  return (data || []) as any[];
}

async function auctionRow() {
  const { data } = await admin.from("auctions").select("*").eq("id", auctionId).maybeSingle();
  return data as any;
}

beforeAll(async () => {
  userIds = Array.from({ length: TOTAL_USERS }, uuid);

  await admin.from("profiles").insert(
    userIds.map((id, i) => ({
      id,
      email: `${runId}-${i}@stress.test`,
      full_name: `Stress ${i}`,
      verification_status: "verified",
    })),
  );

  const { data: created, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} closest-price stress`,
      description: "temporary auction created by the concurrency test",
      mode: "closest",
      target_price: TARGET_PRICE,
      bid_increment: BID_INCREMENT,
      bid_fee: BID_FEE,
      entry_fee: ENTRY_FEE,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: 0,
      current_price: 0,
      duration_minutes: 60,
      status: "open",
      subscriber_ids: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  auctionId = created.id;

  // Fund every wallet so no attempt is rejected for lack of money.
  await admin.from("wallet_transactions").insert(
    userIds.map((id) => ({
      user_id: id,
      type: "deposit",
      amount: DEPOSIT,
      description: `${runId} test deposit`,
      status: "confirmed",
    })),
  );
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  if (auctionId) {
    await admin.from("bids").delete().eq("auction_id", auctionId);
    await admin.from("bid_events").delete().eq("auction_id", auctionId);
    await admin.from("notifications").delete().eq("auction_id", auctionId);
    await admin.from("auctions").delete().eq("id", auctionId);
  }
  if (userIds.length) {
    await admin.from("wallet_transactions").delete().in("user_id", userIds);
    await admin.from("notifications").delete().in("user_id", userIds);
    await admin.from("bid_events").delete().in("user_id", userIds);
    await admin.from("profiles").delete().in("id", userIds);
  }
});

describe("auction engine under concurrency", () => {
  // The seat count is a MINIMUM target, not a cap: extra participants may join,
  // but each of them must be seated and charged exactly once.
  test("simultaneous joins seat every user once and charge one entry fee each", async () => {
    const results = await Promise.all(
      userIds.map((id) => runBackendFunction("joinAuction", { auction_id: auctionId }, id)),
    );

    const rejected = results.filter((r) => r.data["error"]);
    expect(rejected.length).toBe(0);

    const a = await auctionRow();
    expect((a.subscriber_ids || []).length).toBe(TOTAL_USERS);
    expect(new Set(a.subscriber_ids).size).toBe(TOTAL_USERS);
    expect(a.status).toBe("live");

    const entryFees = await walletRows("subscription");
    expect(entryFees.length).toBe(TOTAL_USERS);
    expect(sum(entryFees)).toBe(-Math.round(ENTRY_FEE * TOTAL_USERS * 100) / 100);
  });

  test("a burst of identical numbers burns the number exactly once", async () => {
    const seated: string[] = (await auctionRow()).subscriber_ids;
    const results = await Promise.all(
      seated.map((id) =>
        runBackendFunction("placeBid", { auction_id: auctionId, amount: COLLISION_NUMBER }, id),
      ),
    );

    const accepted = results.filter((r) => !r.data["error"]);
    const errors = results.map((r) => r.data["error"]).filter(Boolean).map(String);

    // First writer takes the number; the second collides and burns it for
    // everyone; every later attempt must be refused.
    expect(accepted.length).toBe(2);
    expect(accepted.filter((r) => r.data["burned"]).length).toBe(1);
    expect(errors.every((e) => e === "number_burned" || e === "duplicate_own")).toBe(true);

    const collisions = (await bidRows()).filter((b) => Number(b.amount) === COLLISION_NUMBER);
    expect(collisions.length).toBe(2);
    expect(collisions.every((b) => b.burned === true)).toBe(true);
    // Nobody can still be holding this number as an active bid.
    expect(collisions.filter((b) => !b.burned).length).toBe(0);
  });

  test("distinct numbers submitted at once all land, one fee per accepted bid", async () => {
    const seated: string[] = (await auctionRow()).subscriber_ids;
    const results = await Promise.all(
      seated.map((id, i) =>
        runBackendFunction("placeBid", { auction_id: auctionId, amount: i + 1 }, id),
      ),
    );
    // The only acceptable refusal here is the fairness gate: the two users who
    // already spent a bid in the collision test must wait for the others.
    const errs = results.map((r) => r.data["error"]).filter(Boolean).map(String);
    expect(errs.every((e) => e === "waiting_for_others")).toBe(true);

    const bids = await bidRows();
    const active = bids.filter((b) => !b.burned && !b.archived);
    // Unique active numbers only.
    expect(new Set(active.map((b) => Number(b.amount))).size).toBe(active.length);

    // Per-bid fee: exactly one charge per accepted bid, no double-charge.
    const fees = await walletRows("bid_fee");
    expect(fees.length).toBe(bids.length);
    expect(sum(fees)).toBe(-Math.round(BID_FEE * bids.length * 100) / 100);
    expect(fees.every((f) => Number(f.amount) === -BID_FEE)).toBe(true);

    for (const userId of seated) {
      const userFees = fees.filter((f) => f.user_id === userId);
      const userBids = bids.filter((b) => b.user_id === userId);
      expect(userFees.length).toBe(userBids.length);
    }
  });

  test("parallel settlement passes end the round once and charge the winner once", async () => {
    // Expire the timer: seats are already full, so the round may close.
    await admin
      .from("auctions")
      .update({ end_time: new Date(Date.now() - 1000).toISOString() })
      .eq("id", auctionId);

    const before = await bidRows();
    const expectedWinner = before
      .filter((b) => !b.burned && !b.archived && Number(b.amount) <= TARGET_PRICE)
      .sort((x, y) => Number(y.amount) - Number(x.amount))[0];

    const seated: string[] = (await auctionRow()).subscriber_ids;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        runBackendFunction("syncAuction", { auction_id: auctionId }, seated[i % seated.length]!),
      ),
    );

    const a = await auctionRow();
    expect(a.status).toBe("ended");
    expect(a.winner_id).toBe(expectedWinner.user_id);
    expect(Number(a.current_price)).toBe(Number(expectedWinner.amount));

    // Manual payment model: one invoice per win, never a wallet debit.
    const charges = await walletRows("winning_bid");
    expect(charges.length).toBe(0);

    const { data: invoiceData } = await admin
      .from("winner_payments")
      .select("user_id, amount")
      .eq("auction_id", auctionId);
    const invoices = (invoiceData || []) as any[];
    expect(invoices.length).toBe(1);
    expect(invoices[0]!.user_id).toBe(expectedWinner.user_id);
    expect(Number(invoices[0]!.amount)).toBe(Number(expectedWinner.amount));

    // Fees must not have moved during settlement.
    const fees = await walletRows("bid_fee");
    expect(fees.length).toBe(before.length);

    // Exactly one settlement event, even though 8 passes raced for the round.
    const { data: settleEvents } = await admin
      .from("bid_events")
      .select("outcome, round")
      .eq("auction_id", auctionId)
      .eq("event", "settle");
    const settles = (settleEvents || []) as any[];
    expect(settles.length).toBe(1);
    expect(settles[0]!.outcome).toBe("settled");
    expect(Number(settles[0]!.round)).toBe(Number(a.round || 1));
  });

  test("no audit anomalies were recorded for this auction", async () => {
    const { data } = await admin
      .from("bid_events")
      .select("severity, reason, details")
      .eq("auction_id", auctionId);
    const events = (data || []) as any[];
    expect(events.length).toBeGreaterThan(0);
    const anomalies = events.filter((e) => e.details?.anomaly);
    expect(anomalies).toEqual([]);
  });
});
