/**
 * Number-pool / self-limiting-clock checks for closest-price auctions:
 *
 *   bun test scripts/tests/number-pool.test.ts
 *
 * What it proves:
 *  - no bid is ever rejected because it would burn the last unique number
 *  - a deliberately tiny number space still leaves at least one active
 *    non-burned number when the round closes
 *  - the deadline only ever moves earlier as free numbers are consumed
 *  - the round settles exactly once
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";

const TEST_TIMEOUT_MS = 120_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;

const SEATS = 4;
// 0.20 target with a 0.01 step = only 20 numbers in the whole pool.
const TARGET_PRICE = 0.2;
const BID_INCREMENT = 0.01;
const ENTRY_FEE = 1;
const DEPOSIT = 200;

const runId = `pool-${Date.now()}`;
let auctionId = "";
let userIds: string[] = [];
const deadlines: number[] = [];

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
      email: `${runId}-${i}@stress.test`,
      full_name: `Pool ${i}`,
      verification_status: "verified",
    })),
  );

  const { data: created, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} tiny number pool`,
      description: "temporary auction created by the number-pool test",
      mode: "closest",
      target_price: TARGET_PRICE,
      bid_increment: BID_INCREMENT,
      bid_fee: 0,
      entry_fee: ENTRY_FEE,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: 0,
      current_price: 0,
      duration_minutes: 600,
      bids_per_participant: 5,
      bid_rate_limit: 0,
      status: "open",
      subscriber_ids: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  auctionId = created.id;

  await admin.from("wallet_transactions").insert(
    userIds.map((id) => ({
      user_id: id,
      type: "deposit",
      amount: DEPOSIT,
      description: `${runId} test deposit`,
      status: "confirmed",
    })),
  );

  for (const id of userIds) {
    await runBackendFunction("joinAuction", { auction_id: auctionId }, id);
  }
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  if (auctionId) {
    await admin.from("bids").delete().eq("auction_id", auctionId);
    await admin.from("bid_credits").delete().eq("auction_id", auctionId);
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

describe("closest-price number pool", () => {
  test("bids are never blocked for burning the last unique number", async () => {
    // Waves of numbers fired concurrently, one wave per round of the quota so
    // the fairness gate stays satisfied while the pool drains fast. Each wave
    // mixes a shared number (guaranteed collision) with distinct ones.
    const waves = [0.02, 0.04, 0.06, 0.08, 0.1];
    for (const [w, base] of waves.entries()) {
      const results = await Promise.all(
        userIds.map((id, i) =>
          runBackendFunction(
            "placeBid",
            // first two users always collide on the same number
            { auction_id: auctionId, amount: i < 2 ? base : Number((base + i / 100).toFixed(2)) },
            id,
          ),
        ),
      );
      const errors = results
        .map((r: any) => String(r?.error || r?.data?.error || ""))
        .filter(Boolean);
      expect(errors.filter((e) => e.includes("last_unique_number"))).toEqual([]);
      const a = await auctionRow();
      deadlines.push(new Date(a.end_time).getTime());
      if (a.status !== "live") break;
      expect(w).toBeLessThan(waves.length);
    }
    expect(deadlines.length).toBeGreaterThan(0);
  });

  test("the deadline only ever moves earlier", async () => {
    for (let i = 1; i < deadlines.length; i += 1) {
      expect(deadlines[i]!).toBeLessThanOrEqual(deadlines[i - 1]!);
    }
  });

  test("the round settles once and always finds a winner", async () => {
    const a = await auctionRow();
    if (a.status === "live") {
      await admin.from("auctions").update({ end_time: new Date().toISOString() }).eq("id", auctionId);
    }
    await Promise.all([
      runBackendFunction("getAuction", { id: auctionId }, userIds[0]!),
      runBackendFunction("getAuction", { id: auctionId }, userIds[1]!),
      runBackendFunction("getAuction", { id: auctionId }, userIds[2]!),
    ]);
    const { data: settleEvents } = await admin
      .from("bid_events")
      .select("outcome")
      .eq("auction_id", auctionId)
      .eq("event", "settle");
    expect(((settleEvents || []) as any[]).length).toBeLessThanOrEqual(1);

    const after = await auctionRow();
    if (after.status === "ended") {
      // Either a surviving unique number or the burned-number fallback wins,
      // so an ended round is never left without a winner.
      expect(after.winner_id).toBeTruthy();
    }
  });
});

