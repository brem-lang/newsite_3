/**
 * Admin-only "participant file": one round-trip that returns everything the
 * platform knows about a single participant — auctions, bids, payments,
 * audit events and support history.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Payload = Record<string, any>;
type Result = { data: Record<string, any>; status: number };

const admin: any = supabaseAdmin;
const sel = (s: string): string => s;

async function safe<T>(p: Promise<{ data: T | null }>): Promise<T[]> {
  try {
    const { data } = await p;
    return (data || []) as unknown as T[];
  } catch {
    return [];
  }
}

export async function getParticipantFile(_actor: Row, body: Payload): Promise<Result> {
  const userId = body["user_id"];
  if (!userId) return { data: { error: "Missing user_id" }, status: 400 };

  const [profileRes, rolesRes] = await Promise.all([
    admin.from("profiles").select(sel("*")).eq("id", userId).maybeSingle(),
    admin.from("user_roles").select(sel("role")).eq("user_id", userId),
  ]);
  const profile = profileRes?.data || null;
  const roles = (rolesRes?.data || []).map((r: Row) => r["role"]);

  let authUser: Row = null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    authUser = data?.user || null;
  } catch {
    /* auth lookup is best-effort */
  }
  if (!profile && !authUser) return { data: { error: "User not found" }, status: 404 };

  const [bids, txns, credits, events, notes, notifications, tickets, fulfilments, refunds, logs] =
    await Promise.all([
      safe<Row>(admin.from("bids").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(5000)),
      safe<Row>(admin.from("wallet_transactions").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(5000)),
      safe<Row>(admin.from("bid_credits").select(sel("*")).eq("user_id", userId).limit(2000)),
      safe<Row>(admin.from("bid_events").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(2000)),
      safe<Row>(admin.from("participant_notes").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(500)),
      safe<Row>(admin.from("notifications").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(500)),
      safe<Row>(admin.from("support_tickets").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(500)),
      safe<Row>(admin.from("fulfilments").select(sel("*")).eq("winner_id", userId).order("created_date", { ascending: false }).limit(500)),
      safe<Row>(admin.from("refund_requests").select(sel("*")).eq("user_id", userId).order("created_date", { ascending: false }).limit(500)),
      safe<Row>(admin.from("activity_logs").select(sel("*")).eq("target_id", String(userId)).order("created_date", { ascending: false }).limit(500)),
    ]);

  // Auctions the user touched: seated (subscriber_ids), bid on, or won.
  const seated = await safe<Row>(
    admin.from("auctions").select(sel("*")).contains("subscriber_ids", [String(userId)]).limit(1000)
  );
  const idSet = new Set<string>(seated.map((a: Row) => a["id"]));
  const extraIds = new Set<string>();
  for (const b of bids) if (b["auction_id"] && !idSet.has(b["auction_id"])) extraIds.add(b["auction_id"]);
  for (const tx of txns) if (tx["auction_id"] && !idSet.has(tx["auction_id"])) extraIds.add(tx["auction_id"]);
  for (const f of fulfilments) if (f["auction_id"] && !idSet.has(f["auction_id"])) extraIds.add(f["auction_id"]);

  let auctions = seated;
  if (extraIds.size > 0) {
    const rest = await safe<Row>(
      admin.from("auctions").select(sel("*")).in("id", Array.from(extraIds)).limit(1000)
    );
    auctions = auctions.concat(rest);
  }

  // Everyone's bids on those auctions, so per-auction rank/gap can be computed.
  const auctionIds = auctions.map((a: Row) => a["id"]);
  let peerBids: Row[] = [];
  if (auctionIds.length > 0) {
    peerBids = await safe<Row>(
      admin
        .from("bids")
        .select(sel("id, auction_id, user_id, amount, round, archived, burned, created_date"))
        .in("auction_id", auctionIds)
        .limit(20000)
    );
  }

  return {
    data: {
      ok: true,
      profile: {
        ...(profile || {}),
        id: userId,
        email: profile?.["email"] || authUser?.email || null,
        created_date: profile?.["created_date"] || authUser?.created_at || null,
        roles,
        role: roles.includes("admin") ? "admin" : "user",
        last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
      },
      auctions,
      bids,
      peerBids,
      transactions: txns,
      credits,
      events,
      notes,
      notifications,
      tickets,
      fulfilments,
      refunds,
      logs,
    },
    status: 200,
  };
}
