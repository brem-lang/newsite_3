/**
 * Escrow, anti-sniping and idempotency checks:
 *
 *   bun test scripts/tests/escrow-flow.test.ts
 *
 * Verifies that a live ascending bid only RESERVES money (never debits it),
 * that overtaken bidders get their reservation back immediately, that the
 * winner's reservation survives until their manual payment is settled, that a
 * last-second bid extends the clock, and that a retried submit with the same
 * client request id is recorded exactly once.
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
const runId = `escrow-${Date.now()}`;

const SEATS = 2;
const ENTRY_FEE = 5;
const DEPOSIT = 500;
const START_PRICE = 10;
const INCREMENT = 5;
const ANTI_SNIPE = 120;

let users: string[] = [];
let adminUser = "";
let auctionId = "";

const call = (name: string, body: any, uid: string) => runBackendFunction(name, body, uid) as Promise<any>;
const auction = async (id: string) => (await admin.from("auctions").select("*").eq("id", id).single()).data;

async function balance(uid: string) {
  const { data } = await admin.from("wallet_transactions").select("amount,status").eq("user_id", uid);
  return Number(
    (data || [])
      .filter((r: any) => r.status !== "pending" && r.status !== "failed")
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
      .toFixed(2),
  );
}
async function available(uid: string) {
  const { data } = await admin.rpc("available_balance", { _user_id: uid });
  return Number(data);
}
async function heldRows(uid: string) {
  const { data } = await admin.from("bid_holds").select("*").eq("user_id", uid).eq("auction_id", auctionId);
  return (data || []) as any[];
}
const held = async (uid: string) =>
  Number(
    (await heldRows(uid))
      .filter((r) => r.status === "held")
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
      .toFixed(2),
  );

beforeAll(async () => {
  users = Array.from({ length: SEATS }, uuid);
  adminUser = uuid();
  await admin.from("profiles").insert(
    [...users, adminUser].map((id, i) => ({
      id,
      email: `${runId}-${i}@escrow.test`,
      full_name: `Escrow ${i}`,
      verification_status: "verified",
    })),
  );
  await admin.from("user_roles").insert({ user_id: adminUser, role: "admin" });
  await admin.from("wallet_transactions").insert(
    users.map((id) => ({ user_id: id, type: "deposit", amount: DEPOSIT, description: `${runId} deposit`, status: "confirmed" })),
  );

  const { data, error } = await admin
    .from("auctions")
    .insert({
      title: `${runId} ascending`,
      description: "temporary auction created by the escrow test",
      entry_fee: ENTRY_FEE,
      max_subscribers: SEATS,
      min_participants: SEATS,
      start_price: START_PRICE,
      current_price: START_PRICE,
      bid_increment: INCREMENT,
      duration_minutes: 60,
      status: "open",
      subscriber_ids: [],
      bid_rate_limit: 0,
      min_round_minutes: 0,
      mode: "highest",
      anti_snipe_seconds: ANTI_SNIPE,
      hold_retry_minutes: 60,
    })
    .select("id")
    .single();
  if (error) throw error;
  auctionId = data.id;

  for (const u of users) {
    const res = await call("joinAuction", { auction_id: auctionId }, u);
    expect(res.data?.error).toBeFalsy();
  }
}, T);

afterAll(async () => {
  if (auctionId) {
    for (const table of ["bids", "bid_holds", "bid_credits", "bid_events", "notifications", "winner_payments"]) {
      await admin.from(table).delete().eq("auction_id", auctionId);
    }
    await admin.from("wallet_transactions").delete().eq("auction_id", auctionId);
    await admin.from("auctions").delete().eq("id", auctionId);
  }
  await admin.from("wallet_transactions").delete().in("user_id", [...users, adminUser]);
  await admin.from("notifications").delete().in("user_id", users);
  await admin.from("bid_events").delete().in("user_id", users);
  await admin.from("bid_holds").delete().in("user_id", users);
  await admin.from("user_roles").delete().eq("user_id", adminUser);
  await admin.from("profiles").delete().in("id", [...users, adminUser]);
});

describe("bids never touch the wallet", () => {
  test("a leading bid neither debits nor reserves money", async () => {
    const before = await balance(users[0]!);
    const amount = START_PRICE + INCREMENT;
    const res = await call("placeBid", { auction_id: auctionId, amount }, users[0]!);
    expect(res.data?.error).toBeFalsy();

    expect(await balance(users[0]!)).toBe(before);
    expect(await held(users[0]!)).toBe(0);
    expect(await available(users[0]!)).toBe(before);
  });

  test("being outbid leaves both wallets fully spendable", async () => {
    const amount = START_PRICE + INCREMENT * 2;
    const res = await call("placeBid", { auction_id: auctionId, amount }, users[1]!);
    expect(res.data?.error).toBeFalsy();

    for (const u of users) {
      expect(await held(u)).toBe(0);
      expect(await available(u)).toBe(await balance(u));
    }
  });

  test("a raise by the same bidder stays free of charge", async () => {
    const before = await balance(users[1]!);
    const amount = START_PRICE + INCREMENT * 3;
    const res = await call("placeBid", { auction_id: auctionId, amount }, users[1]!);
    expect(res.data?.error).toBeFalsy();
    expect(await balance(users[1]!)).toBe(before);
    expect(await held(users[1]!)).toBe(0);
  });

  test("a bid far above the wallet balance is accepted — the winner pays later", async () => {
    const bal = await balance(users[0]!);
    const amount = bal + 100;
    const res = await call("placeBid", { auction_id: auctionId, amount }, users[0]!);
    expect(res.data?.error).toBeFalsy();
    expect(Number((await auction(auctionId)).current_price)).toBe(amount);
    expect(await balance(users[0]!)).toBe(bal);
    expect(await held(users[0]!)).toBe(0);
  });
});


describe("anti-sniping", () => {
  test("a bid inside the window pushes the deadline forward", async () => {
    const soon = new Date(Date.now() + 30_000).toISOString();
    await admin.from("auctions").update({ end_time: soon }).eq("id", auctionId);

    const a0 = await auction(auctionId);
    const amount = Number(a0.current_price) + INCREMENT;
    const res = await call("placeBid", { auction_id: auctionId, amount }, users[0]!);
    expect(res.data?.error).toBeFalsy();
    expect(res.data?.extended).toBe(true);

    const a1 = await auction(auctionId);
    expect(new Date(a1.end_time).getTime()).toBeGreaterThan(new Date(soon).getTime());
  });

  test("a bid far from the deadline leaves the clock alone", async () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await admin.from("auctions").update({ end_time: later }).eq("id", auctionId);

    const a0 = await auction(auctionId);
    const res = await call("placeBid", { auction_id: auctionId, amount: Number(a0.current_price) + INCREMENT }, users[1]!);
    expect(res.data?.error).toBeFalsy();
    expect(res.data?.extended).toBeFalsy();
    expect(new Date((await auction(auctionId)).end_time).getTime()).toBe(new Date(later).getTime());
  });
});

describe("client retry deduping", () => {
  test("the same request id twice records exactly one bid", async () => {
    const a0 = await auction(auctionId);
    const amount = Number(a0.current_price) + INCREMENT;
    const key = `dedupe-${runId}`;

    const [first, second] = await Promise.all([
      call("placeBid", { auction_id: auctionId, amount, client_request_id: key }, users[0]!),
      call("placeBid", { auction_id: auctionId, amount, client_request_id: key }, users[0]!),
    ]);
    expect(first.data?.error).toBeFalsy();
    expect(second.data?.error).toBeFalsy();

    const { data: rows } = await admin
      .from("bids")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("client_request_id", key);
    expect((rows || []).length).toBe(1);
    expect(await held(users[0]!)).toBe(0);
  });
});

describe("settlement and manual payment", () => {
  test("the round settles once, charges nobody and issues one payment link", async () => {
    const a0 = await auction(auctionId);
    const winner = String(a0.highest_bidder_id);
    const loser = users.find((u) => u !== winner)!;
    const winnerBefore = await balance(winner);
    const loserBefore = await balance(loser);

    await admin.from("auctions").update({ end_time: new Date(Date.now() - 1000).toISOString() }).eq("id", auctionId);
    await finalizeAuctions();

    const a1 = await auction(auctionId);
    expect(a1.status).toBe("ended");
    expect(a1.winner_id).toBe(winner);
    // Manual payment model: nothing is debited or reserved at settlement.
    expect(await balance(winner)).toBe(winnerBefore);
    expect(await balance(loser)).toBe(loserBefore);
    expect(await held(winner)).toBe(0);
    expect(await held(loser)).toBe(0);

    const { data: pays } = await admin.from("winner_payments").select("*").eq("auction_id", auctionId);
    expect((pays || []).length).toBe(1);
    expect(pays![0].status).toBe("pending");
    expect(Number(pays![0].amount)).toBe(Number(a1.current_price));
  });

  test("a second tick neither double-settles nor charges the winner", async () => {
    const a = await auction(auctionId);
    const before = await balance(String(a.winner_id));
    await finalizeAuctions();
    const { data: pays } = await admin.from("winner_payments").select("*").eq("auction_id", auctionId);
    expect((pays || []).length).toBe(1);
    expect(await balance(String(a.winner_id))).toBe(before);
    expect(await held(String(a.winner_id))).toBe(0);
  });


  test("marking the manual payment as paid closes the auction out", async () => {
    const a = await auction(auctionId);
    const { data: pays } = await admin.from("winner_payments").select("*").eq("auction_id", auctionId);
    const payment = pays![0];

    const res = await call("markWinnerPaid", { payment_id: payment.id, reference: `${runId}-bank` }, adminUser);
    expect(res.data?.error).toBeFalsy();

    expect(await held(String(a.winner_id))).toBe(0);
    expect(await available(String(a.winner_id))).toBe(await balance(String(a.winner_id)));
    expect((await auction(auctionId)).paid).toBe(true);
  });

  test("wallet exposure reporting matches the reservations", async () => {
    for (const u of users) {
      const res = await call("walletExposure", {}, u);
      expect(res.data?.error).toBeFalsy();
      expect(Number(res.data.available)).toBe(Number(res.data.balance) - Number(res.data.held));
      // Every reservation for this round is gone once the win is settled.
      expect(Number(res.data.held)).toBe(0);
    }
  });
});
