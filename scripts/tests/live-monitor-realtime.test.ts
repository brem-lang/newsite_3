/**
 * End-to-end integration test for the live monitor's burned / free counters,
 * driven by *real* Supabase realtime bid events (no polling, no local guesses):
 *
 *   bun test scripts/tests/live-monitor-realtime.test.ts
 *
 * What it proves:
 *  - the `bids` table actually broadcasts INSERT/UPDATE events for an auction
 *  - counters derived only from those realtime payloads (exactly what
 *    LiveAuctionMonitor keeps in state) match the shared `auctionNumberPool`
 *    endpoint after every bid
 *  - a duplicate number produces the burn UPDATE events the monitor needs, so
 *    burned goes up and free stays correct without a refetch
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const TEST_TIMEOUT_MS = 120_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);

const admin: any = supabaseAdmin;

const SEATS = 3;
const TARGET_PRICE = 2; // 2.00 -> 200 cent-granular numbers
const runId = `rtmon-${Date.now()}`;

let auctionId = "";
let userIds: string[] = [];
let realtime: any = null;
let channel: any = null;

/** Local mirror of the monitor's realtime bid state: id -> { amount, burned }. */
const liveBids = new Map<string, { amount: number; burned: boolean }>();
let eventCount = 0;

const uuid = () => crypto.randomUUID();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pool() {
  const res: any = await runBackendFunction("auctionNumberPool", { auction_id: auctionId }, userIds[0]!);
  return (res?.data || res) as any;
}

/** Counters computed purely from what realtime delivered. */
function realtimeCounters(total: number) {
  const amounts = [...liveBids.values()];
  const used = new Set(amounts.map((b) => b.amount)).size;
  const burned = new Set(amounts.filter((b) => b.burned).map((b) => b.amount)).size;
  return { total, used, burned, free: Math.max(total - used, 0) };
}

/** Waits until the realtime mirror agrees with the endpoint (or times out). */
async function waitForRealtime(expected: { used: number; burned: number }, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const c = realtimeCounters(0);
    if (c.used === expected.used && c.burned === expected.burned) return true;
    await sleep(250);
  }
  return false;
}

beforeAll(async () => {
  userIds = Array.from({ length: SEATS }, uuid);

  await admin.from("profiles").insert(
    userIds.map((id, i) => ({
      id,
      email: `${runId}-${i}@stress.test`,
      full_name: `Realtime monitor ${i}`,
      verification_status: "verified",
    })),
  );

  const { data: created, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} realtime monitor`,
      description: "temporary auction created by the live monitor realtime test",
      mode: "closest",
      target_price: TARGET_PRICE,
      bid_increment: 0.01,
      bid_fee: 0,
      entry_fee: 1,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: 0,
      current_price: 0,
      duration_minutes: 120,
      bids_per_participant: 5,
      bid_rate_limit: 0,
      min_round_minutes: 60,
      pool_warn_pct: 20,
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

  // Subscribe the same way LiveAuctionMonitor does, but with a server client.
  realtime = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("realtime subscription timed out")), 20_000);
    channel = realtime
      .channel(`${runId}-bids`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` },
        (payload: any) => {
          eventCount += 1;
          const row = payload.new || payload.old;
          if (!row?.id) return;
          if (payload.eventType === "DELETE") {
            liveBids.delete(row.id);
            return;
          }
          if (row.archived) {
            liveBids.delete(row.id);
            return;
          }
          liveBids.set(row.id, { amount: Number(row.amount), burned: Boolean(row.burned) });
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`realtime subscribe failed: ${status}`));
        }
      });
  });
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  if (channel && realtime) await realtime.removeChannel(channel);
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

describe("live monitor counters over realtime", () => {
  test("a single bid arrives over realtime and drains one free number", async () => {
    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.5 }, userIds[0]!);

    expect(await waitForRealtime({ used: 1, burned: 0 })).toBe(true);

    const p = await pool();
    expect(realtimeCounters(p.total_numbers)).toEqual({
      total: 200,
      used: p.used_numbers,
      burned: p.burned_numbers,
      free: p.free_numbers,
    });
    expect(p.free_numbers).toBe(199);
    expect(eventCount).toBeGreaterThan(0);
  });

  test("a duplicate number broadcasts burn updates and bumps the burned counter", async () => {
    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.75 }, userIds[1]!);
    await runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.75 }, userIds[2]!);

    expect(await waitForRealtime({ used: 2, burned: 1 })).toBe(true);

    const p = await pool();
    const c = realtimeCounters(p.total_numbers);
    expect(c).toEqual({
      total: p.total_numbers,
      used: p.used_numbers,
      burned: p.burned_numbers,
      free: p.free_numbers,
    });
    expect(c.burned).toBe(1);
    expect(c.free).toBe(198);
    expect(c.free + c.used).toBe(c.total);
  });

  test("counters stay consistent after a concurrent burst of bids", async () => {
    await Promise.all(
      userIds.map((id, i) =>
        runBackendFunction("placeBid", { auction_id: auctionId, amount: Number((0.1 + i * 0.01).toFixed(2)) }, id),
      ),
    );

    const p = await pool();
    expect(await waitForRealtime({ used: p.used_numbers, burned: p.burned_numbers })).toBe(true);

    const c = realtimeCounters(p.total_numbers);
    expect(c.used).toBe(p.used_numbers);
    expect(c.burned).toBe(p.burned_numbers);
    expect(c.free).toBe(p.free_numbers);
    expect(c.free).toBeLessThanOrEqual(198);
  });
});
