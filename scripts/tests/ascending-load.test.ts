/**
 * Load check for ascending ("highest bid") auctions:
 *
 *   bun test scripts/tests/ascending-load.test.ts
 *
 * Many users hammer the same auction with simultaneous bids over several
 * waves. Invariants asserted afterwards:
 *  - the price only ever moves up (no lost update / price regression)
 *  - the stored price equals the highest accepted bid and its bidder
 *  - every accepted bid respects the minimum increment at the time it landed
 *  - no accepted bid exceeds the bidder's wallet balance
 *  - the audit trail contains no anomalies
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;
const TEST_TIMEOUT_MS = 180_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);

const SEATS = 25;
const WAVES = 6;
const ENTRY_FEE = 2;
const DEPOSIT = 5000;
const START_PRICE = 10;
const INCREMENT = 5;

const runId = `load-${Date.now()}`;
let auctionId = "";
let userIds: string[] = [];

const uuid = () => crypto.randomUUID();

async function auctionRow() {
  const { data } = await admin.from("auctions").select("*").eq("id", auctionId).maybeSingle();
  return data as any;
}

beforeAll(async () => {
  userIds = Array.from({ length: SEATS }, uuid);
  await admin.from("profiles").insert(
    userIds.map((id, i) => ({
      id,
      email: `${runId}-${i}@load.test`,
      full_name: `Load ${i}`,
      verification_status: "verified",
    })),
  );

  const { data, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} ascending load`,
      description: "temporary auction created by the load test",
      mode: "highest",
      entry_fee: ENTRY_FEE,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: START_PRICE,
      current_price: START_PRICE,
      bid_increment: INCREMENT,
      duration_minutes: 120,
      status: "open",
      subscriber_ids: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  auctionId = data.id;

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
}, TEST_TIMEOUT_MS);

describe("ascending auction under load", () => {
  test("all seats fill exactly once", async () => {
    const results = await Promise.all(
      userIds.map((id) => runBackendFunction("joinAuction", { auction_id: auctionId }, id)),
    );
    const joinErrors = results.filter((r) => r.data["error"]);
    if (joinErrors.length) console.log("join errors:", joinErrors.slice(0, 3).map((r) => r.data["error"]));
    expect(joinErrors.length).toBe(0);

    const a = await auctionRow();
    expect((a.subscriber_ids || []).length).toBe(SEATS);
    expect(a.status).toBe("live");
  });

  test("simultaneous bid waves keep the price consistent and monotonic", async () => {
    const prices: number[] = [];

    for (let wave = 0; wave < WAVES; wave++) {
      const a = await auctionRow();
      const base = Number(a.current_price || START_PRICE);
      // Everyone aims at (almost) the same price at the same instant: only the
      // first writer per level may win, the rest must be told they are too low.
      await Promise.all(
        userIds.map((id, i) =>
          runBackendFunction(
            "placeBid",
            { auction_id: auctionId, amount: base + INCREMENT * (1 + (i % 3)) },
            id,
          ),
        ),
      );
      const after = await auctionRow();
      prices.push(Number(after.current_price));
    }

    // Price never went backwards across waves.
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
    }

    const { data: bidData } = await admin
      .from("bids")
      .select("*")
      .eq("auction_id", auctionId)
      .order("created_date", { ascending: true });
    const bids = (bidData || []) as any[];
    expect(bids.length).toBeGreaterThan(0);

    // Accepted bids are strictly increasing and always cleared the increment.
    let prev = START_PRICE;
    for (const b of bids) {
      const amount = Number(b.amount);
      expect(amount).toBeGreaterThanOrEqual(prev + INCREMENT);
      prev = amount;
    }

    const top = bids[bids.length - 1]!;
    const final = await auctionRow();
    expect(Number(final.current_price)).toBe(Number(top.amount));
    expect(final.highest_bidder_id).toBe(top.user_id);

    // No accepted bid ever exceeded the bidder's wallet.
    expect(Number(top.amount)).toBeLessThanOrEqual(DEPOSIT);
  });

  test("concurrent settlement passes emit exactly one settlement event", async () => {
    await admin
      .from("auctions")
      .update({ end_time: new Date(Date.now() - 1000).toISOString() })
      .eq("id", auctionId);

    const before = await auctionRow();
    const seated: string[] = before.subscriber_ids || [];

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        runBackendFunction("syncAuction", { auction_id: auctionId }, seated[i % seated.length]!),
      ),
    );

    const a = await auctionRow();
    expect(a.status).toBe("ended");
    expect(a.winner_id).toBe(before.highest_bidder_id);

    const { data: settleData } = await admin
      .from("bid_events")
      .select("outcome, round, amount")
      .eq("auction_id", auctionId)
      .eq("event", "settle");
    const settles = (settleData || []) as any[];
    expect(settles.length).toBe(1);
    expect(settles[0]!.outcome).toBe("settled");
    expect(Number(settles[0]!.round)).toBe(Number(a.round || 1));

    // Manual payment model: exactly one invoice, no wallet debit.
    const { data: chargeData } = await admin
      .from("wallet_transactions")
      .select("user_id, amount")
      .eq("auction_id", auctionId)
      .eq("type", "winning_bid");
    expect((chargeData || []).length).toBe(0);

    const { data: invoiceData } = await admin
      .from("winner_payments")
      .select("user_id, amount")
      .eq("auction_id", auctionId);
    const invoices = (invoiceData || []) as any[];
    expect(invoices.length).toBe(1);
    expect(invoices[0]!.user_id).toBe(a.winner_id);
  });

  test("the audit trail flags no anomalies", async () => {
    const { data } = await admin
      .from("bid_events")
      .select("details, severity, reason")
      .eq("auction_id", auctionId);
    const events = (data || []) as any[];
    expect(events.length).toBeGreaterThan(0);
    expect(events.filter((e) => e.details?.anomaly)).toEqual([]);
  });
});
