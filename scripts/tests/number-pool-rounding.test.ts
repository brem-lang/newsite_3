/**
 * Live-database rounding invariants for the closest-price number pool:
 *
 *   bun test scripts/tests/number-pool-rounding.test.ts
 *
 * What it proves against the real RPC:
 *  - a 0.1 bid_increment still yields exactly 100 numbers per 1.00 of target
 *  - off-increment cent numbers (0.25, 0.37) are accepted
 *  - sub-cent numbers are refused
 *  - reported free numbers = total - distinct numbers taken
 *  - the deadline never moves later while the pool drains
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";

const TEST_TIMEOUT_MS = 120_000;
const test = (name: string, fn: () => Promise<void>) => bunTest(name, fn, TEST_TIMEOUT_MS);
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;

const SEATS = 2;
const TARGET_PRICE = 1; // 1.00 -> must be exactly 100 numbers
const BID_INCREMENT = 0.1; // must NOT shrink the pool to 10 numbers
const runId = `round-${Date.now()}`;
let auctionId = "";
let userIds: string[] = [];

const uuid = () => crypto.randomUUID();

async function bidState(userId: string) {
  const res: any = await runBackendFunction("auctionBidState", { auction_id: auctionId }, userId);
  return (res?.data || res) as any;
}

beforeAll(async () => {
  userIds = Array.from({ length: SEATS }, uuid);

  await admin.from("profiles").insert(
    userIds.map((id, i) => ({
      id,
      email: `${runId}-${i}@stress.test`,
      full_name: `Round ${i}`,
      verification_status: "verified",
    })),
  );

  const { data: created, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} rounding pool`,
      description: "temporary auction created by the rounding test",
      mode: "closest",
      target_price: TARGET_PRICE,
      bid_increment: BID_INCREMENT,
      bid_fee: 0,
      entry_fee: 1,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: 0,
      current_price: 0,
      duration_minutes: 600,
      bids_per_participant: 4,
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

describe("target / increment rounding", () => {
  test("1.00 target with a 0.1 increment exposes 100 numbers", async () => {
    const s = await bidState(userIds[0]!);
    expect(Number(s.total_numbers)).toBe(100);
    expect(Number(s.free_numbers)).toBe(100);
  });

  test("cent numbers that are not multiples of the increment are accepted", async () => {
    for (const [i, amount] of [0.25, 0.37].entries()) {
      const res: any = await runBackendFunction(
        "placeBid",
        { auction_id: auctionId, amount },
        userIds[i]!,
      );
      const err = String(res?.error || res?.data?.error || "");
      expect(err).not.toContain("bad_step");
      expect(err).not.toContain("out_of_range");
    }
    const s = await bidState(userIds[0]!);
    expect(Number(s.total_numbers)).toBe(100);
    expect(Number(s.free_numbers)).toBe(100 - 2);
  });

  test("sub-cent numbers are refused", async () => {
    const res: any = await runBackendFunction(
      "placeBid",
      { auction_id: auctionId, amount: 0.255 },
      userIds[0]!,
    );
    const err = String(res?.error || res?.data?.error || "");
    expect(err.length).toBeGreaterThan(0);
  });

  test("free numbers stay consistent and the deadline never grows", async () => {
    const before = await admin.from("auctions").select("end_time").eq("id", auctionId).maybeSingle();
    const firstEnd = new Date(before.data.end_time).getTime();

    await Promise.all([
      runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.5 }, userIds[0]!),
      runBackendFunction("placeBid", { auction_id: auctionId, amount: 0.5 }, userIds[1]!),
    ]);

    const { data: rows } = await admin
      .from("bids")
      .select("amount")
      .eq("auction_id", auctionId)
      .eq("archived", false);
    const distinct = new Set(((rows || []) as any[]).map((r) => Number(r.amount))).size;

    const s = await bidState(userIds[0]!);
    expect(Number(s.free_numbers)).toBe(100 - distinct);

    const after = await admin.from("auctions").select("end_time").eq("id", auctionId).maybeSingle();
    expect(new Date(after.data.end_time).getTime()).toBeLessThanOrEqual(firstEnd);
  });
});
