/**
 * Admin test-mode helpers.
 *
 * 1. createTestAuction — builds a reproducible closest-price auction with a
 *    predefined selling price, seat count and per-seat numbers, seating real
 *    test accounts through the SAME atomic RPCs the app uses, so an A-to-Z
 *    flow can be replayed at any time.
 * 2. reconcileAuctionPayments — reconciles every money movement of one auction
 *    (entry fees, bid fees, extra bid credits, winner charge) against what the
 *    auction state implies, flagging missing / duplicated / mismatched charges.
 */
import { supabaseAdmin } from "./client.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Payload = Record<string, any>;
type Result = { data: Record<string, any>; status: number };

const admin: any = supabaseAdmin;
const ok = (data: Row = { ok: true }): Result => ({ data, status: 200 });
const fail = (error: string, status = 400): Result => ({ data: { error }, status });

const round2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;
const TEST_PASSWORD = "TestSeat!2024";
const TEST_DOMAIN = "seat.bidkita.test";

/* ------------------------------ test seats ------------------------------ */

async function ensureTestUser(index: number) {
  const email = `testseat${index}@${TEST_DOMAIN}`;
  const { data: existing } = await admin.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existing) return existing as Row;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test Seat ${index}`, first_name: "Test", last_name: `Seat ${index}` },
  });
  if (error || !created?.user?.id) throw new Error(error?.message || "test_user_create_failed");
  const id = created.user.id;

  // The signup trigger normally creates the profile; make sure it exists.
  const { data: profile } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  if (profile) return profile as Row;
  const { data: inserted } = await admin
    .from("profiles")
    .upsert({ id, email, full_name: `Test Seat ${index}`, verification_status: "verified" })
    .select("*")
    .maybeSingle();
  return (inserted as Row) || { id, email };
}

async function balanceOf(userId: string) {
  const { data } = await admin
    .from("wallet_transactions")
    .select("amount, status")
    .eq("user_id", userId)
    .limit(5000);
  return round2(
    (data || [])
      .filter((t: Row) => t.status !== "pending" && t.status !== "failed")
      .reduce((acc: number, t: Row) => acc + Number(t.amount || 0), 0)
  );
}

async function fundUser(userId: string, target: number) {
  const balance = await balanceOf(userId);
  if (balance >= target) return balance;
  const delta = round2(target - balance);
  await admin.from("wallet_transactions").insert({
    user_id: userId,
    type: "adjustment",
    amount: delta,
    description: "Test-mode funding",
    status: "confirmed",
  });
  return round2(balance + delta);
}

/** Parses "19.90, 19.5 | 18.2" style input into one number list per seat. */
function parseNumbers(input: unknown, seats: number): number[][] {
  if (Array.isArray(input)) {
    return Array.from({ length: seats }, (_, i) => {
      const row = Array.isArray(input[i]) ? input[i] : input[i] != null ? [input[i]] : [];
      return row.map((n: unknown) => round2(Number(n))).filter((n: number) => n > 0);
    });
  }
  const groups = String(input || "")
    .split(/[|\n]/)
    .map((g) => g.split(/[,;\s]+/).map((n) => round2(Number(n))).filter((n) => n > 0));
  return Array.from({ length: seats }, (_, i) => groups[i] || []);
}

export async function createTestAuction(actor: Row, body: Payload): Promise<Result> {
  const seats = Math.max(1, Math.min(30, Number(body["seats"] || 3)));
  const target = round2(Number(body["target_price"] || 0));
  if (target <= 0) return fail("invalid_selling_price");

  const entryFee = round2(Number(body["entry_fee"] ?? 5));
  const bidFee = round2(Number(body["bid_fee"] ?? 0));
  const extraBidPrice = round2(Number(body["extra_bid_price"] ?? 1));
  const quota = Math.max(1, Number(body["bids_per_participant"] ?? 5));
  const durationMinutes = Math.max(1, Number(body["duration_minutes"] ?? 120));
  const seed = round2(Number(body["seed_balance"] ?? 500));
  const perSeatNumbers = parseNumbers(body["numbers"], seats);

  const { data: auction, error } = await admin
    .from("auctions")
    .insert({
      title: String(body["title"] || `TEST · closest price ${target}`),
      description: "Auto-generated test auction (test mode).",
      image_url: body["image_url"] || null,
      mode: "closest",
      status: "open",
      target_price: target,
      start_price: 0,
      current_price: 0,
      bid_increment: 0.01,
      entry_fee: entryFee,
      bid_fee: bidFee,
      extra_bid_price: extraBidPrice,
      bids_per_participant: quota,
      max_subscribers: seats,
      min_participants: seats,
      duration_minutes: durationMinutes,
      subscriber_ids: [],
      created_by: actor?.["id"] || null,
    })
    .select("*")
    .maybeSingle();
  if (error || !auction) return fail(error?.message || "create_failed", 500);

  const report: Row[] = [];
  for (let i = 1; i <= seats; i++) {
    const line: Row = { seat: i, bids: [] as Row[] };
    try {
      const user = await ensureTestUser(i);
      line["user_id"] = user["id"];
      line["email"] = user["email"];
      line["balance"] = await fundUser(user["id"], seed);

      const { data: joined } = await admin.rpc("join_auction_atomic", {
        _auction_id: auction["id"],
        _user_id: user["id"],
      });
      line["joined"] = joined?.ok === true;
      if (!line["joined"]) line["join_error"] = joined?.error || "join_failed";

      for (const amount of perSeatNumbers[i - 1] || []) {
        const { data: res } = await admin.rpc("place_closest_bid", {
          _auction_id: auction["id"],
          _user_id: user["id"],
          _amount: amount,
        });
        line["bids"].push({ amount, ok: res?.ok === true, burned: !!res?.burned, error: res?.error || null });
      }
    } catch (e) {
      line["error"] = e instanceof Error ? e.message : "seat_failed";
    }
    report.push(line);
  }

  const fresh = await admin.from("auctions").select("*").eq("id", auction["id"]).maybeSingle();
  return ok({ ok: true, auction: fresh.data || auction, seats: report, password: TEST_PASSWORD });
}

/* --------------------------- reconciliation ----------------------------- */

type Line = {
  category: string;
  user_id: string | null;
  expected_count: number;
  actual_count: number;
  expected_amount: number;
  actual_amount: number;
  status: "ok" | "missing" | "duplicate" | "mismatch";
  note?: string;
};

function verdict(line: Omit<Line, "status">): Line {
  let status: Line["status"] = "ok";
  if (line.actual_count > line.expected_count) status = "duplicate";
  else if (line.actual_count < line.expected_count) status = "missing";
  else if (Math.abs(round2(line.actual_amount) - round2(line.expected_amount)) > 0.011) status = "mismatch";
  return { ...line, status };
}

export async function reconcileAuctionPayments(_actor: Row, body: Payload): Promise<Result> {
  const auctionId = body["auction_id"];
  if (!auctionId) return fail("Missing auction");
  const { data: auction } = await admin.from("auctions").select("*").eq("id", auctionId).maybeSingle();
  if (!auction) return fail("not_found", 404);

  const [{ data: txns }, { data: bids }, { data: credits }] = await Promise.all([
    admin.from("wallet_transactions").select("*").eq("auction_id", auctionId).limit(5000),
    admin.from("bids").select("*").eq("auction_id", auctionId).limit(20000),
    admin.from("bid_credits").select("*").eq("auction_id", auctionId).limit(5000),
  ]);

  const settled = (txns || []).filter((t: Row) => t.status !== "failed");
  const byType = (type: string) => settled.filter((t: Row) => t.type === type);
  const spentOf = (rows: Row[]) => round2(rows.reduce((a: number, t: Row) => a + Math.abs(Number(t.amount || 0)), 0));

  const seats: string[] = (auction["subscriber_ids"] || []).map(String);
  const entryFee = round2(Number(auction["entry_fee"] || 0));
  const bidFee = round2(Number(auction["bid_fee"] || 0));
  const extraPrice = round2(Number(auction["extra_bid_price"] || 0));
  const lines: Line[] = [];

  /* Entry fees: exactly one 'subscription' charge per seated participant. */
  const entryTxns = byType("subscription");
  for (const uid of seats) {
    const rows = entryTxns.filter((t: Row) => String(t.user_id) === uid);
    lines.push(
      verdict({
        category: "entry_fee",
        user_id: uid,
        expected_count: entryFee > 0 ? 1 : 0,
        actual_count: entryFee > 0 ? rows.length : rows.length,
        expected_amount: entryFee,
        actual_amount: spentOf(rows),
      })
    );
  }
  for (const t of entryTxns.filter((t: Row) => !seats.includes(String(t.user_id)))) {
    lines.push(
      verdict({
        category: "entry_fee",
        user_id: String(t.user_id),
        expected_count: 0,
        actual_count: 1,
        expected_amount: 0,
        actual_amount: Math.abs(Number(t.amount || 0)),
        note: "charged_but_not_seated",
      })
    );
  }

  /* Bid fees: one charge per placed bid, for every round including archived. */
  const feeTxns = byType("bid_fee");
  const bidUsers = Array.from(new Set([...(bids || []).map((b: Row) => String(b.user_id)), ...feeTxns.map((t: Row) => String(t.user_id))]));
  for (const uid of bidUsers) {
    const count = (bids || []).filter((b: Row) => String(b.user_id) === uid).length;
    const rows = feeTxns.filter((t: Row) => String(t.user_id) === uid);
    lines.push(
      verdict({
        category: "bid_fee",
        user_id: uid,
        expected_count: bidFee > 0 ? count : 0,
        actual_count: rows.length,
        expected_amount: bidFee > 0 ? round2(bidFee * count) : 0,
        actual_amount: spentOf(rows),
        note: bidFee > 0 ? `${count} bids × ${bidFee}` : "free bids",
      })
    );
  }

  /* Extra bid credits: charged amount must equal purchased credits × price. */
  const creditTxns = byType("bid_credits");
  const creditUsers = Array.from(new Set([...(credits || []).map((c: Row) => String(c.user_id)), ...creditTxns.map((t: Row) => String(t.user_id))]));
  for (const uid of creditUsers) {
    const bought = (credits || [])
      .filter((c: Row) => String(c.user_id) === uid)
      .reduce((a: number, c: Row) => a + Number(c.credits || 0), 0);
    const rows = creditTxns.filter((t: Row) => String(t.user_id) === uid);
    const expectedAmount = round2(bought * extraPrice);
    const actualAmount = spentOf(rows);
    lines.push({
      category: "extra_credits",
      user_id: uid,
      expected_count: bought > 0 ? 1 : 0,
      actual_count: rows.length ? 1 : 0,
      expected_amount: expectedAmount,
      actual_amount: actualAmount,
      status: Math.abs(expectedAmount - actualAmount) > 0.011 ? "mismatch" : "ok",
      note: `${bought} credits × ${extraPrice}`,
    });
  }

  /* Winner charge: at most one 'winning_bid' at the settled price. */
  const winTxns = byType("winning_bid");
  const winnerId = auction["winner_id"] ? String(auction["winner_id"]) : null;
  const winningAmount = round2(Number(auction["current_price"] || 0));
  const expectWinner = !!winnerId && auction["status"] === "ended" && auction["paid"] === true;
  lines.push(
    verdict({
      category: "winner_charge",
      user_id: winnerId,
      expected_count: expectWinner ? 1 : 0,
      actual_count: winTxns.length,
      expected_amount: expectWinner ? winningAmount : 0,
      actual_amount: spentOf(winTxns),
      note: expectWinner ? "winner charged once" : auction["status"] !== "ended" ? "not ended yet" : "unpaid / no winner",
    })
  );
  for (const t of winTxns.filter((t: Row) => winnerId && String(t.user_id) !== winnerId)) {
    lines.push({
      category: "winner_charge",
      user_id: String(t.user_id),
      expected_count: 0,
      actual_count: 1,
      expected_amount: 0,
      actual_amount: Math.abs(Number(t.amount || 0)),
      status: "duplicate",
      note: "charged_but_not_winner",
    });
  }

  const totals = {
    entry_fees: spentOf(entryTxns),
    bid_fees: spentOf(feeTxns),
    extra_credits: spentOf(creditTxns),
    winner_charges: spentOf(winTxns),
  };
  const problems = lines.filter((l) => l.status !== "ok");

  return ok({
    ok: problems.length === 0,
    auction: {
      id: auction["id"],
      title: auction["title"],
      status: auction["status"],
      mode: auction["mode"],
      paid: auction["paid"],
      round: auction["round"],
      seats: seats.length,
      entry_fee: entryFee,
      bid_fee: bidFee,
      extra_bid_price: extraPrice,
      winner_id: winnerId,
      settled_price: winningAmount,
    },
    totals,
    gross: round2(totals.entry_fees + totals.bid_fees + totals.extra_credits + totals.winner_charges),
    lines,
    problems: problems.length,
    transactions: settled
      .map((t: Row) => ({
        id: t.id,
        user_id: t.user_id,
        type: t.type,
        amount: Number(t.amount || 0),
        status: t.status,
        description: t.description,
        created_date: t.created_date,
      }))
      .sort((a: Row, b: Row) => String(b.created_date).localeCompare(String(a.created_date))),
  });
}
