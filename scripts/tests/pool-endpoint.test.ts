/**
 * End-to-end checks for the shared number-pool endpoint and the counters the
 * live monitor renders from it:
 *
 *   bun test scripts/tests/pool-endpoint.test.ts
 *
 * What it proves:
 *  - `auctionNumberPool` reports total / taken / burned / free consistently
 *  - burned + free counters move correctly after each realtime bid event
 *  - the admin monitor's stats hook agrees with the endpoint (one source of truth)
 *  - the fairness guard keeps the round at least `min_round_minutes` long even
 *    when automatic duration reduction fires
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";

const TEST_TIMEOUT_MS = 120_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;

const SEATS = 3;
const TARGET_PRICE = 2; // 2.00 -> 200 numbers
const MIN_ROUND_MINUTES = 30;
const runId = `poolapi-${Date.now()}`;
let auctionId = "";
let userIds: string[] = [];

const uuid = () => crypto.randomUUID();

async function pool() {
  const res: any = await runBackendFunction("auctionNumberPool", { auction_id: auctionId }, userIds[0]!);
  return (res?.data || res) as any;
}

async function auctionRow() {
  const { data } = await admin.from("auctions").select("*").eq("id", auctionId).maybeSingle();
  return data as any;
}

/** Mirrors the counters the live monitor derives from its realtime bid list. */
async function monitorCounters() {
  const { data } = await admin
    .from("bids")
    .select("amount, burned, round, archived")
    .eq("auction_id", auctionId);
  const a = await auctionRow();
  const live = (data || []).filter((b: any) => !b.archived && Number(b.round || 1) === Number(a.round || 1));
  const total = Math.max(Math.round(Number(a.target_price || 0) * 100), 0);
  const used = new Set(live.map((b: any) => Number(b.amount))).size;
  const burned = new Set(live.filter((b: any) => b.burned).map((b: any) => Number(b.amount))).size;
  return { total, used, burned, free: Math.max(total - used, 0) };
}

beforeAll(async () => {
  userIds = Array.from({ length: SEATS }, uuid);

  await admin.from("profiles").insert(
    userIds.map((id, i) => ({
      id,
      email: `${runId}-${i}@stress.test`,
      full_name: `Pool api ${i}`,
      verification_status: "verified",
    })),
  );

  const { data: created, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} pool endpoint`,
      description: "temporary auction created by the pool endpoint test",
      mode: "closest",
      target_price: TARGET_PRICE,
      bid_increment: 0.01,
      bid_fee: 0,
      entry_fee: 1,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: 0,
      current_price: 0,
      duration_minutes: 60,
      bids_per_participant: 5,
      bid_rate_limit: 0,
      min_round_minutes: MIN_ROUND_MINUTES,
      pool_warn_pct: 100, // deliberately high so the warning flag flips on the first bid
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
      amount: 200,
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

describe("auctionNumberPool endpoint", () => {
  test("reports an untouched pool of 100 numbers per 1.00", async () => {
    const p = await pool();
    expect(p.sealed).toBe(true);
    expect(p.total_numbers).toBe(200);
    expect(p.free_numbers).toBe(200);
    expect(p.used_numbers).toBe(0);
    expect(p.burned_numbers).toBe(0);
    expect(p.free_pct).toBe(100);
    expect(p.min_round_minutes).toBe(MIN_ROUND_MINUTES);
    expect(p.history).toEqual([]);
  });

  test("free and burned counters follow every bid event", async () => {
    // Two distinct numbers, then a collision that burns one number for both.
    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.5 }, userIds[0]!);
    let p = await pool();
    expect(p.used_numbers).toBe(1);
    expect(p.free_numbers).toBe(199);
    expect(p.burned_numbers).toBe(0);

    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.75 }, userIds[1]!);
    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.75 }, userIds[2]!);

    p = await pool();
    expect(p.used_numbers).toBe(2);
    expect(p.free_numbers).toBe(198);
    expect(p.burned_numbers).toBe(1);
    expect(p.burned).toEqual([0.75]);
    expect(p.free_numbers + p.used_numbers).toBe(p.total_numbers);
    expect(p.history.length).toBe(p.bids);
    // The history is monotonically draining and ends at the current value.
    const frees = p.history.map((h: any) => h.free);
    for (let i = 1; i < frees.length; i += 1) expect(frees[i]).toBeLessThanOrEqual(frees[i - 1]);
    expect(frees.at(-1)).toBe(p.free_numbers);
    // The warning flag respects the auction's configured threshold.
    expect(p.warn_pct).toBe(100);
    expect(p.warning).toBe(true);
  });

  test("monitor counters match the endpoint exactly", async () => {
    const [p, m] = await Promise.all([pool(), monitorCounters()]);
    expect({ total: p.total_numbers, used: p.used_numbers, burned: p.burned_numbers, free: p.free_numbers }).toEqual(m);
  });

  test("fairness guard keeps the round at least min_round_minutes long", async () => {
    const before = await auctionRow();
    const start = new Date(before.start_time).getTime();
    const guard = start + MIN_ROUND_MINUTES * 60_000;

    // Drain a large slice of the pool so the clock compression fires hard.
    for (let i = 0; i < 3; i += 1) {
      await Promise.all(
        userIds.map((id, u) =>
          runBackendFunction(
            "placeBid",
            { auction_id: auctionId, amount: Number((0.01 + i * 0.03 + u * 0.01).toFixed(2)) },
            id,
          ),
        ),
      );
    }

    const after = await auctionRow();
    const end = new Date(after.end_time).getTime();
    // Never later than the original deadline, never earlier than the guard.
    expect(end).toBeLessThanOrEqual(new Date(before.end_time).getTime());
    expect(end).toBeGreaterThanOrEqual(guard - 1000);

    const p = await pool();
    expect(new Date(p.earliest_end_time).getTime()).toBeGreaterThanOrEqual(guard - 1000);
  });
});
