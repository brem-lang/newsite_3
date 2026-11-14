/**
 * Live end-to-end walk of the auction flow with REAL sign-in-able users.
 *   bun scripts/tmp/live-e2e.ts
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;
const call = (name: string, body: any, uid: string) => runBackendFunction(name, body, uid) as Promise<any>;
const log = (...a: unknown[]) => console.log(...a);

const PASSWORD = "Test123456!";
const PEOPLE = [
  { email: "qa.bidder1@mazadatna.com", name: "QA Bidder One" },
  { email: "qa.bidder2@mazadatna.com", name: "QA Bidder Two" },
  { email: "qa.bidder3@mazadatna.com", name: "QA Bidder Three" },
];
const FUND = 500;

async function balance(uid: string) {
  const { data } = await admin.from("wallet_transactions").select("amount,status").eq("user_id", uid);
  return Number(
    (data || [])
      .filter((r: any) => r.status !== "pending" && r.status !== "failed")
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
      .toFixed(2),
  );
}
async function spendable(uid: string) {
  const { data } = await admin.rpc("available_balance", { _user_id: uid });
  return data == null ? null : Number(data);
}
const auction = async (id: string) => (await admin.from("auctions").select("*").eq("id", id).single()).data;

async function ensureUser(email: string, name: string) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let u = (list?.users || []).find((x: any) => x.email === email);
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    u = data.user;
  } else {
    await admin.auth.admin.updateUserById(u.id, { password: PASSWORD, email_confirm: true });
  }
  await admin.from("profiles").upsert({
    id: u.id,
    email,
    full_name: name,
    verification_status: "verified",
    country: "Jordan",
  });
  const bal = await balance(u.id);
  if (bal < FUND) {
    await admin.from("wallet_transactions").insert({
      user_id: u.id,
      type: "deposit",
      amount: FUND - bal,
      description: "QA test funding",
      status: "confirmed",
    });
  }
  return u.id as string;
}

const ids: string[] = [];
for (const p of PEOPLE) {
  const id = await ensureUser(p.email, p.name);
  ids.push(id);
  log(`user ${p.email} -> ${id} | wallet ${await balance(id)}`);
}

/* --------------------------- ascending auction -------------------------- */
const { data: liveAsc } = await admin
  .from("auctions")
  .select("*")
  .eq("mode", "highest")
  .in("status", ["open", "live"])
  .limit(1);
const asc = liveAsc?.[0];
if (asc) {
  log(`\n=== ASCENDING: ${asc.title} (${asc.id}) entry=${asc.entry_fee} price=${asc.current_price} step=${asc.bid_increment}`);
  for (const [i, uid] of ids.entries()) {
    const before = await balance(uid);
    const r = await call("joinAuction", { auction_id: asc.id }, uid);
    log(`  join #${i + 1}: ${r.data?.error ? "REJECTED " + r.data.error : "ok"} | wallet ${before} -> ${await balance(uid)}`);
  }
  let a = await auction(asc.id);
  log(`  status=${a.status} seats=${(a.subscriber_ids || []).length} end=${a.end_time}`);
  for (let i = 0; i < 4; i++) {
    const uid = ids[i % ids.length]!;
    a = await auction(asc.id);
    const amount = Number(a.current_price) + Number(a.bid_increment || 1);
    const r = await call("placeBid", { auction_id: asc.id, amount, client_request_id: `qa-${Date.now()}-${i}` }, uid);
    log(
      `  bid ${amount}: ${r.data?.error ? "REJECTED " + r.data.error : "ok"} | wallet ${await balance(uid)} spendable ${await spendable(uid)}`,
    );
  }
  a = await auction(asc.id);
  log(`  price now ${a.current_price} leader ${a.highest_bidder_id}`);
  const { data: holds } = await admin
    .from("bid_holds")
    .select("user_id,amount,status")
    .eq("auction_id", asc.id)
    .eq("status", "held");
  log(`  active escrow holds: ${JSON.stringify(holds)}`);
}

/* ---------------------------- closest auction --------------------------- */
const { data: liveClose } = await admin
  .from("auctions")
  .select("*")
  .eq("mode", "closest")
  .in("status", ["open", "live"])
  .limit(1);
const cl = liveClose?.[0];
if (cl) {
  log(
    `\n=== CLOSEST: ${cl.title} (${cl.id}) entry=${cl.entry_fee} target=${cl.target_price} bid_fee=${cl.bid_fee} quota=${cl.bids_per_participant} extra=${cl.extra_bid_price}`,
  );
  for (const [i, uid] of ids.entries()) {
    const before = await balance(uid);
    const r = await call("joinAuction", { auction_id: cl.id }, uid);
    log(`  join #${i + 1}: ${r.data?.error ? "REJECTED " + r.data.error : "ok"} | wallet ${before} -> ${await balance(uid)}`);
  }
  const quota = Number(cl.bids_per_participant || 0) || 3;
  for (const [i, uid] of ids.entries()) {
    for (let k = 0; k < quota + 1; k++) {
      const amount = Number((1 + i * 0.5 + k * 0.01).toFixed(2));
      const before = await balance(uid);
      const r = await call("placeBid", { auction_id: cl.id, amount, client_request_id: `qac-${Date.now()}-${i}-${k}` }, uid);
      log(
        `  u${i + 1} number ${amount}: ${r.data?.error ? "REJECTED " + r.data.error : `ok${r.data?.burned ? " (burned duplicate)" : ""}`} | wallet ${before} -> ${await balance(uid)}`,
      );
    }
  }
  // duplicate number across two users -> both burn
  const dupAmount = 1.77;
  for (const uid of ids.slice(0, 2)) {
    const r = await call("placeBid", { auction_id: cl.id, amount: dupAmount, client_request_id: `qad-${Date.now()}-${uid}` }, uid);
    log(`  duplicate ${dupAmount} by ${uid.slice(0, 8)}: ${r.data?.error ? "REJECTED " + r.data.error : `ok burned=${!!r.data?.burned}`}`);
  }
  // buy extra credits for user 1 then bid again
  const buy = await call("buyBidCredits", { auction_id: cl.id, count: 2 }, ids[0]!);
  log(`  buy 2 extra bids: ${buy.data?.error ? "REJECTED " + buy.data.error : "ok"} | wallet ${await balance(ids[0]!)}`);
  const extra = await call("placeBid", { auction_id: cl.id, amount: 1.91, client_request_id: `qae-${Date.now()}` }, ids[0]!);
  log(`  bid after credits: ${extra.data?.error ? "REJECTED " + extra.data.error : "ok"} | wallet ${await balance(ids[0]!)}`);

  const { data: bids } = await admin.from("bids").select("user_id,amount,burned,archived").eq("auction_id", cl.id);
  const live = (bids || []).filter((b: any) => !b.archived);
  log(`  bids on round: ${live.length} | burned: ${live.filter((b: any) => b.burned).length}`);
  const a = await auction(cl.id);
  log(`  status=${a.status} seats=${(a.subscriber_ids || []).length} end=${a.end_time}`);
}

log("\n=== FINAL LEDGER ===");
for (const [i, uid] of ids.entries()) {
  const { data: tx } = await admin
    .from("wallet_transactions")
    .select("type,amount,status,description")
    .eq("user_id", uid)
    .order("created_date", { ascending: true });
  log(`\n${PEOPLE[i]!.email} | wallet ${await balance(uid)} | spendable ${await spendable(uid)}`);
  for (const t of tx || []) log(`   ${t.status.padEnd(9)} ${String(t.amount).padStart(8)}  ${t.type}  ${t.description || ""}`);
}
