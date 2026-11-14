/**
 * A-to-Z auction flow check for BOTH auction types:
 *
 *   bun test scripts/tests/full-flow.test.ts
 *
 * Ascending mode:
 *   create -> fund wallets -> join seats (entry fee charged, round goes live)
 *   -> reject non-subscriber / too-low / underfunded bids -> valid bids raise the
 *   price -> clock expires with seats unfilled => round restarts -> seats full +
 *   clock expired => settle, one manual payment request created for the winner,
 *   nothing debited from their wallet, and the winner notified.
 *
 * Closest (sealed) mode:
 *   create -> join -> sealed numbers, cent granularity, duplicate burn, fairness
 *   gate, per-participant quota, paid extra credits, self-limiting clock, and
 *   settlement to the closest non-burned number <= selling price.
 *
 * Everything it creates is namespaced by run id and removed afterwards.
 */
import { describe, test as bunTest, expect, beforeAll, afterAll } from "bun:test";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction, finalizeAuctions } from "@/lib/backend/handlers.server";

const T = 120_000;
const test = (n: string, f: () => Promise<void>) => bunTest(n, f, T);
const admin: any = supabaseAdmin;
const uuid = () => crypto.randomUUID();
const runId = `flow-${Date.now()}`;

const SEATS = 3;
const ENTRY_FEE = 5;
const BID_INCREMENT = 1;
const START_PRICE = 10;

const TARGET_PRICE = 2; // 2.00 -> 200 cent numbers
const BID_FEE = 0.5;
const QUOTA = 2;
const EXTRA_BID_PRICE = 1;

let users: string[] = [];
let outsider = "";
let broke = "";
let ascId = "";
let closeId = "";

const call = (name: string, body: any, uid: string) => runBackendFunction(name, body, uid) as Promise<any>;

async function balance(uid: string) {
  const { data } = await admin.from("wallet_transactions").select("amount,status").eq("user_id", uid);
  return Number(
    (data || [])
      .filter((r: any) => r.status !== "pending" && r.status !== "failed")
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
      .toFixed(2),
  );
}
const auction = async (id: string) => (await admin.from("auctions").select("*").eq("id", id).single()).data;
const expire = (id: string) =>
  admin.from("auctions").update({ end_time: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
const bidsOf = async (id: string) =>
  (await admin.from("bids").select("*").eq("auction_id", id).order("created_date")).data || [];

async function makeAuction(extra: Record<string, unknown>) {
  const { data, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} ${extra["mode"]}`,
      description: "temporary auction created by the full-flow test",
      entry_fee: ENTRY_FEE,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: START_PRICE,
      current_price: START_PRICE,
      bid_increment: BID_INCREMENT,
      duration_minutes: 60,
      status: "open",
      subscriber_ids: [],
      bid_rate_limit: 0,
      min_round_minutes: 0,
      pool_warn_pct: 20,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

beforeAll(async () => {
  users = Array.from({ length: SEATS }, uuid);
  outsider = uuid();
  broke = uuid();
  const all = [...users, outsider, broke];

  await admin.from("profiles").insert(
    all.map((id, i) => ({ id, email: `${runId}-${i}@flow.test`, full_name: `Flow ${i}`, verification_status: "verified" })),
  );
  await admin.from("wallet_transactions").insert([
    ...users.map((id) => ({ user_id: id, type: "deposit", amount: 500, description: `${runId} deposit`, status: "confirmed" })),
    { user_id: outsider, type: "deposit", amount: 500, description: `${runId} deposit`, status: "confirmed" },
    { user_id: broke, type: "deposit", amount: ENTRY_FEE, description: `${runId} deposit`, status: "confirmed" },
  ]);

  ascId = await makeAuction({ mode: "highest" });
  closeId = await makeAuction({
    mode: "closest",
    target_price: TARGET_PRICE,
    bid_increment: 0.01,
    bid_fee: BID_FEE,
    bids_per_participant: QUOTA,
    extra_bid_price: EXTRA_BID_PRICE,
  });
}, T);

afterAll(async () => {
  const ids = [ascId, closeId].filter(Boolean);
  const all = [...users, outsider, broke];
  for (const table of ["bids", "bid_holds", "bid_credits", "bid_events", "notifications", "winner_payments"]) {
    if (ids.length) await admin.from(table).delete().in("auction_id", ids);
  }
  if (ids.length) await admin.from("wallet_transactions").delete().in("auction_id", ids);
  if (ids.length) await admin.from("auctions").delete().in("id", ids);
  await admin.from("wallet_transactions").delete().in("user_id", all);
  await admin.from("notifications").delete().in("user_id", all);
  await admin.from("bid_events").delete().in("user_id", all);
  await admin.from("profiles").delete().in("id", all);
});

describe("ascending auction, end to end", () => {
  test("joining charges the entry fee once and starts the clock", async () => {
    const before = await balance(users[0]!);
    const res = await call("joinAuction", { auction_id: ascId }, users[0]!);
    expect(res.data?.error).toBeFalsy();
    expect(await balance(users[0]!)).toBe(Number((before - ENTRY_FEE).toFixed(2)));

    const dup = await call("joinAuction", { auction_id: ascId }, users[0]!);
    expect(String(dup.data?.error || "")).toContain("already");
    expect(await balance(users[0]!)).toBe(Number((before - ENTRY_FEE).toFixed(2)));

    const a = await auction(ascId);
    expect(a.status).toBe("live");
    expect(a.start_time).toBeTruthy();
    expect(a.end_time).toBeTruthy();
    expect(a.subscriber_ids).toHaveLength(1);
  });

  test("an underfunded user cannot buy a seat", async () => {
    await admin.from("wallet_transactions").insert({
      user_id: broke, type: "bid_fee", amount: -ENTRY_FEE, description: `${runId} drain`, status: "confirmed",
    });
    const res = await call("joinAuction", { auction_id: ascId }, broke);
    expect(String(res.data?.error || "")).toContain("insufficient");
    const a = await auction(ascId);
    expect(a.subscriber_ids).not.toContain(broke);
  });

  test("non-subscribers and low bids are rejected; a bid above the wallet is allowed", async () => {
    const out = await call("placeBid", { auction_id: ascId, amount: 999 }, outsider);
    expect(out.data?.error).toBeTruthy();

    const low = await call("placeBid", { auction_id: ascId, amount: START_PRICE }, users[0]!);
    expect(low.data?.error).toBeTruthy();

    const a = await auction(ascId);
    expect(Number(a.current_price)).toBe(START_PRICE);
    expect(await bidsOf(ascId)).toHaveLength(0);

    // A bid is a promise, not a payment: the wallet never has to cover it.
    const huge = await call("placeBid", { auction_id: ascId, amount: 100000 }, users[0]!);
    expect(huge.data?.error).toBeFalsy();
    const after = await auction(ascId);
    expect(Number(after.current_price)).toBe(100000);
    // No money moved and nothing was reserved for that bid.
    const { data: holds } = await admin.from("bid_holds").select("id").eq("auction_id", ascId).eq("status", "held");
    expect((holds || []).length).toBe(0);

    // Reset the price so the following bid-wave test starts from the floor.
    await admin.from("bids").delete().eq("auction_id", ascId);
    await admin
      .from("auctions")
      .update({ current_price: START_PRICE, highest_bidder_id: null })
      .eq("id", ascId);
    expect(await bidsOf(ascId)).toHaveLength(0);
  });


  test("valid bids raise the price and concurrent bids stay monotonic", async () => {
    await call("joinAuction", { auction_id: ascId }, users[1]!);
    await call("joinAuction", { auction_id: ascId }, users[2]!);

    const first = await call("placeBid", { auction_id: ascId, amount: START_PRICE + BID_INCREMENT }, users[0]!);
    expect(first.data?.error).toBeFalsy();

    // Ten simultaneous bids at increasing amounts: exactly the accepted ones
    // must be reflected, and the price may only move up.
    const wave = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call("placeBid", { auction_id: ascId, amount: START_PRICE + BID_INCREMENT * (i + 2) }, users[i % SEATS]!),
      ),
    );
    const accepted = wave.filter((r) => !r.data?.error).length;
    expect(accepted).toBeGreaterThan(0);

    const a = await auction(ascId);
    const rows = await bidsOf(ascId);
    expect(rows).toHaveLength(accepted + 1);
    expect(Number(a.current_price)).toBe(Math.max(...rows.map((r: any) => Number(r.amount))));
    expect(a.highest_bidder_id).toBe(rows.reduce((m: any, r: any) => (Number(r.amount) > Number(m.amount) ? r : m)).user_id);
    expect(Number(a.current_price)).toBeGreaterThanOrEqual(START_PRICE + BID_INCREMENT);
  });

  test("the clock restarts while seats are still open, and settles when full", async () => {
    // Drop one seat so the participant target is not met yet.
    const a0 = await auction(ascId);
    const parked = a0.subscriber_ids.slice(0, SEATS - 1);
    await admin.from("auctions").update({ subscriber_ids: parked }).eq("id", ascId);

    await expire(ascId);
    await finalizeAuctions();
    const restarted = await auction(ascId);
    expect(restarted.status).toBe("live");
    expect(new Date(restarted.end_time).getTime()).toBeGreaterThan(Date.now());

    // Seats full + clock expired => settle.
    await admin.from("auctions").update({ subscriber_ids: a0.subscriber_ids }).eq("id", ascId);
    const winner = restarted.highest_bidder_id as string;
    const winnerBefore = await balance(winner);
    const price = Number(restarted.current_price);

    await expire(ascId);
    await finalizeAuctions();
    const ended = await auction(ascId);

    expect(ended.status).toBe("ended");
    expect(ended.winner_id).toBe(winner);
    expect(Number(ended.current_price)).toBe(price);
    // Manual payment model: the win is invoiced, never auto-debited.
    expect(await balance(winner)).toBe(winnerBefore);

    // Idempotent: extra sync passes must not invoice again or move the winner.
    await finalizeAuctions();
    await finalizeAuctions();
    expect(await balance(winner)).toBe(winnerBefore);

    const { data: charges } = await admin
      .from("wallet_transactions").select("id").eq("auction_id", ascId).eq("type", "winning_bid");
    expect(charges || []).toHaveLength(0);

    const { data: invoices } = await admin
      .from("winner_payments").select("*").eq("auction_id", ascId);
    expect(invoices).toHaveLength(1);
    expect(invoices![0].user_id).toBe(winner);
    expect(Number(invoices![0].amount)).toBe(price);

    const { data: notes } = await admin
      .from("notifications").select("id").eq("auction_id", ascId).eq("user_id", winner);
    expect((notes || []).length).toBeGreaterThan(0);

    const post = await call("placeBid", { auction_id: ascId, amount: price + BID_INCREMENT }, winner);
    expect(post.data?.error).toBeTruthy();
  });
});

describe("closest (sealed) auction, end to end", () => {
  test("seats fill and the sealed round goes live", async () => {
    for (const u of users) {
      const res = await call("joinAuction", { auction_id: closeId }, u);
      expect(res.data?.error).toBeFalsy();
    }
    const a = await auction(closeId);
    expect(a.status).toBe("live");
    expect(a.subscriber_ids).toHaveLength(SEATS);
    expect(Number(a.target_price)).toBe(TARGET_PRICE);
  });

  test("the number pool is cent-granular: 100 numbers per 1.00", async () => {
    const p = (await call("auctionNumberPool", { auction_id: closeId }, users[0]!)).data;
    expect(p.total_numbers).toBe(TARGET_PRICE * 100);
    expect(p.free_numbers).toBe(TARGET_PRICE * 100);
    expect(p.burned_numbers).toBe(0);
  });

  test("out-of-range and sub-cent numbers are rejected", async () => {
    for (const amount of [0, -1, TARGET_PRICE + 0.01, 0.005, 1.234]) {
      const res = await call("placeBid", { auction_id: closeId, amount }, users[0]!);
      expect(res.data?.error).toBeTruthy();
    }
    expect(await bidsOf(closeId)).toHaveLength(0);
  });

  test("a sealed number costs the bid fee and drains one free number", async () => {
    const before = await balance(users[0]!);
    const res = await call("placeBid", { auction_id: closeId, amount: 1.5 }, users[0]!);
    expect(res.data?.error).toBeFalsy();
    expect(await balance(users[0]!)).toBe(Number((before - BID_FEE).toFixed(2)));

    const p = (await call("auctionNumberPool", { auction_id: closeId }, users[0]!)).data;
    expect(p.free_numbers).toBe(TARGET_PRICE * 100 - 1);
  });

  test("the fairness gate makes a participant wait for the others", async () => {
    const res = await call("placeBid", { auction_id: closeId, amount: 1.6 }, users[0]!);
    expect(String(res.data?.error || "")).toBe("waiting_for_others");
  });

  test("a duplicate number burns both copies and nobody can reuse it", async () => {
    const a = await call("placeBid", { auction_id: closeId, amount: 1.2 }, users[1]!);
    expect(a.data?.error).toBeFalsy();
    const dup = await call("placeBid", { auction_id: closeId, amount: 1.2 }, users[2]!);
    expect(dup.data?.burned).toBe(true);

    const again = await call("placeBid", { auction_id: closeId, amount: 1.2 }, users[0]!);
    expect(String(again.data?.error || "")).toBe("number_burned");

    const p = (await call("auctionNumberPool", { auction_id: closeId }, users[0]!)).data;
    expect(p.burned_numbers).toBe(1);
    const burnedRows = (await bidsOf(closeId)).filter((r: any) => Number(r.amount) === 1.2);
    expect(burnedRows).toHaveLength(2);
    expect(burnedRows.every((r: any) => r.burned)).toBe(true);
  });

  test("a participant cannot submit the same number twice", async () => {
    const res = await call("placeBid", { auction_id: closeId, amount: 1.5 }, users[0]!);
    expect(String(res.data?.error || "")).toBe("duplicate_own");
  });

  test("the quota stops a participant, and paid credits reopen it", async () => {
    // users[0] has 1 of 2; spend the quota then hit the wall.
    expect((await call("placeBid", { auction_id: closeId, amount: 1.7 }, users[0]!)).data?.error).toBeFalsy();
    const blocked = await call("placeBid", { auction_id: closeId, amount: 1.8 }, users[0]!);
    expect(String(blocked.data?.error || "")).toBe("quota_reached");

    const before = await balance(users[0]!);
    const buy = await call("buyBidCredits", { auction_id: closeId, count: 2 }, users[0]!);
    expect(buy.data?.error).toBeFalsy();
    expect(await balance(users[0]!)).toBe(Number((before - 2 * EXTRA_BID_PRICE).toFixed(2)));

    const after = await call("placeBid", { auction_id: closeId, amount: 1.8 }, users[0]!);
    expect(after.data?.error).toBeFalsy();
    const state = (await call("auctionBidState", { auction_id: closeId }, users[0]!)).data;
    expect(Number(state.credits)).toBe(2);
  });

  test("the deadline only ever moves earlier as the pool drains", async () => {
    const before = await auction(closeId);
    const res = await call("placeBid", { auction_id: closeId, amount: 1.9 }, users[1]!);
    expect(res.data?.error).toBeFalsy();
    const after = await auction(closeId);
    expect(new Date(after.end_time).getTime()).toBeLessThanOrEqual(new Date(before.end_time).getTime());
  });

  test("settlement picks the closest non-burned number and invoices it once", async () => {
    const live = await bidsOf(closeId);
    const active = live.filter((r: any) => !r.burned && !r.archived);
    const best = active.reduce((m: any, r: any) => (Number(r.amount) > Number(m.amount) ? r : m));
    const winner = best.user_id as string;
    const winnerBefore = await balance(winner);

    await expire(closeId);
    await finalizeAuctions();
    await finalizeAuctions();

    const ended = await auction(closeId);
    expect(ended.status).toBe("ended");
    expect(ended.winner_id).toBe(winner);
    expect(Number(ended.current_price)).toBe(Number(best.amount));
    expect(Number(ended.current_price)).toBeLessThanOrEqual(TARGET_PRICE);
    // Manual payment model: the winner is invoiced, not debited.
    expect(await balance(winner)).toBe(winnerBefore);

    const { data: charges } = await admin
      .from("wallet_transactions").select("id").eq("auction_id", closeId).eq("type", "winning_bid");
    expect(charges || []).toHaveLength(0);

    const { data: invoices } = await admin
      .from("winner_payments").select("*").eq("auction_id", closeId);
    expect(invoices).toHaveLength(1);
    expect(invoices![0].user_id).toBe(winner);
    expect(Number(invoices![0].amount)).toBe(Number(best.amount));

    const { data: settles } = await admin
      .from("bid_events").select("id").eq("auction_id", closeId).eq("event", "settle");
    expect(settles).toHaveLength(1);
  });

  test("no error-severity anomalies were recorded for either auction", async () => {
    const { data } = await admin
      .from("bid_events").select("id,event,reason,details").in("auction_id", [ascId, closeId]).eq("severity", "error");
    if ((data || []).length) console.log("ERROR EVENTS", JSON.stringify(data, null, 2));
    expect(data || []).toHaveLength(0);
  });
});
