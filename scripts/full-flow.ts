/**
 * Full bid-flow walk: admin sets join fee + increment -> join -> bids -> my-bids -> settle.
 *   bun scripts/full-flow.ts
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBackendFunction } from "@/lib/backend/handlers.server";

const admin: any = supabaseAdmin;
const call = (name: string, body: any, uid: string) => runBackendFunction(name, body, uid) as Promise<any>;
const log = (...a: unknown[]) => console.log(...a);
const PASSWORD = "Test123456!";
const ENTRY_FEE = 20;
const INCREMENT = 0.1;
const TARGET = 250;
const MIN_PARTICIPANTS = 3;

const PEOPLE = [
  { email: "qa.flow1@mazadatna.com", name: "Flow One" },
  { email: "qa.flow2@mazadatna.com", name: "Flow Two" },
  { email: "qa.flow3@mazadatna.com", name: "Flow Three" },
];

async function balance(uid: string) {
  const { data } = await admin.from("wallet_transactions").select("amount,status").eq("user_id", uid);
  return Number(
    (data || [])
      .filter((r: any) => r.status !== "pending" && r.status !== "failed")
      .reduce((s: number, r: any) => s + Number(r.amount), 0)
      .toFixed(2),
  );
}

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
  }
  await admin.from("profiles").upsert({ id: u.id, email, full_name: name, verification_status: "verified" });
  const bal = await balance(u.id);
  if (bal < 300) {
    await admin.from("wallet_transactions").insert({
      user_id: u.id,
      type: "deposit",
      amount: 300 - bal,
      description: "QA flow funding",
      status: "confirmed",
    });
  }
  return u.id as string;
}

const uids: string[] = [];
for (const p of PEOPLE) {
  const id = await ensureUser(p.email, p.name);
  uids.push(id);
  log(`user ${p.email} -> wallet ${await balance(id)}`);
}

/* 1. admin creates the auction with join fee + increment */
const quota = Math.max(1, Math.round(ENTRY_FEE / INCREMENT));
const { data: created, error: createErr } = await admin
  .from("auctions")
  .insert({
    title: "QA Full Flow Closest Price",
    description: "QA automated full flow",
    mode: "closest",
    status: "open",
    entry_fee: ENTRY_FEE,
    bid_increment: INCREMENT,
    target_price: TARGET,
    start_price: 0,
    current_price: 0,
    duration_minutes: 60,
    min_participants: MIN_PARTICIPANTS,
    max_subscribers: 0,
    bids_per_participant: quota,
    bid_fee: 0,
    extra_bid_price: 1,
    min_round_minutes: 0,
  })
  .select("*")
  .single();
if (createErr) throw createErr;
const AID = created.id as string;
log(`\n[1] auction ${AID}: fee $${ENTRY_FEE}, increment $${INCREMENT} -> quota ${created.bids_per_participant} bids`);
if (created.bids_per_participant !== quota) log("  !! quota mismatch");

/* 2. join */
for (const uid of uids) {
  const res = await call("joinAuction", { auction_id: AID }, uid);
  log(`[2] join ${uid.slice(0, 8)} ->`, JSON.stringify(res?.data ?? res));
  log(`    wallet now ${await balance(uid)} (expected -${ENTRY_FEE})`);
}

/* 3. place bids */
const bidPlan: Array<[number, number]> = [
  [0, 249.5],
  [1, 249.9],
  [2, 240.0],
  [0, 249.9], // duplicate -> should burn
];
for (const [i, amount] of bidPlan) {
  const res = await call("placeBid", { auction_id: AID, amount, client_request_id: `qa-${i}-${amount}` }, uids[i]!);
  log(`[3] bid ${PEOPLE[i]!.name} $${amount} ->`, JSON.stringify(res?.data ?? res));
}

/* 4. my bids per auction */
for (const uid of uids) {
  const st = await call("auctionBidState", { auction_id: AID }, uid);
  const d = st?.data ?? st;
  const mine = d?.mine || [];
  const quotaTotal = quota + Number(d?.credits || 0);
  log(`[4] ${uid.slice(0, 8)} my bids ${mine.length}/${quotaTotal} amounts=${JSON.stringify(mine.map((m: any) => m.amount))} burned=${mine.filter((m: any) => m.burned).length}`);
}

/* 5. settle */
await admin.from("auctions").update({ end_time: new Date(Date.now() - 1000).toISOString() }).eq("id", AID);
const { data: adminRole } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
const fin = await call("finalizeAuctions", {}, adminRole.user_id);
log("[5] finalize ->", JSON.stringify(fin?.data ?? fin).slice(0, 400));
const { data: after } = await admin.from("auctions").select("*").eq("id", AID).single();
log(`[5] status=${after.status} winner=${after.winner_name} round=${after.round}`);
const { data: wp } = await admin.from("winner_payments").select("*").eq("auction_id", AID);
log("[5] winner payments:", JSON.stringify(wp));
const { data: bids } = await admin.from("bids").select("user_id,amount,burned,archived").eq("auction_id", AID);
log("[5] bids:", JSON.stringify(bids));
for (const uid of uids) log(`[5] wallet ${uid.slice(0, 8)} = ${await balance(uid)}`);
