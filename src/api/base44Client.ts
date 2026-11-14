/**
 * Compatibility layer that keeps the app's original `base44.*` call surface
 * while talking to Lovable Cloud (Postgres + Auth + Realtime) underneath.
 *
 *   base44.entities.<Entity>.list/filter/get/create/update/delete/subscribe
 *   base44.auth.me, updateMe, login, register, logout, ...
 *   base44.functions.invoke(name, payload)
 */
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { invokeBackend } from "@/lib/backend.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// The generated Supabase types are per-table; this shim addresses tables
// dynamically by name, so it uses an untyped view of the client.
const db: any = supabase;

const TABLES: Record<string, string> = {
  ActivityLog: "activity_logs",
  ApiKey: "api_keys",
  Auction: "auctions",
  AuctionCostItem: "auction_cost_items",
  AuctionFinanceOverride: "auction_finance_overrides",
  AuctionFinanceChange: "auction_finance_changes",
  AuctionMessage: "auction_messages",
  Bid: "bids",
  BidCredit: "bid_credits",
  BidEvent: "bid_events",
  Brand: "brands",
  Category: "categories",
  Content: "contents",
  Coupon: "coupons",
  Fulfilment: "fulfilments",
  Notification: "notifications",
  Page: "pages",
  ParticipantNote: "participant_notes",
  PaymentMethod: "payment_methods",
  PaymentMethodCredential: "payment_method_credentials",
  RefundRequest: "refund_requests",
  Report: "reports",
  Role: "roles",
  ShippingMethod: "shipping_methods",
  SiteSettings: "site_settings",
  SupportTicket: "support_tickets",
  Template: "templates",
  Theme: "themes",
  User: "profiles",
  WalletTransaction: "wallet_transactions",
  WinnerPayment: "winner_payments",
};

/** "-created_date" -> desc, "display_order" -> asc, "" -> no ordering */
function applySort(query: any, sort?: string | number, limit?: number) {
  // list(sort, limit) but some call sites do list(limit)
  if (typeof sort === "number") {
    limit = sort;
    sort = undefined;
  }
  if (sort && typeof sort === "string") {
    const desc = sort.startsWith("-");
    query = query.order(desc ? sort.slice(1) : sort, { ascending: !desc });
  }
  if (limit) query = query.limit(limit);
  return query;
}

function applyWhere(query: any, where: Row) {
  for (const [key, value] of Object.entries(where || {})) {
    if (value === undefined) continue;
    query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value);
  }
  return query;
}

/** Attach the role from user_roles so `user.role === "admin"` keeps working. */
async function withRoles(rows: Row[]): Promise<Row[]> {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r["id"]).filter(Boolean);
  const { data } = await db.from("user_roles").select("user_id, role").in("user_id", ids);
  const byUser = new Map<string, string>();
  for (const r of data || []) {
    if (r.role === "admin") byUser.set(r.user_id, "admin");
    else if (!byUser.has(r.user_id)) byUser.set(r.user_id, r.role);
  }
  return rows.map((r) => ({
    ...r,
    role: byUser.get(r["id"]) || "user",
    is_verified: r["verification_status"] === "verified",
  }));
}

/**
 * Global config tables are read by several providers on every page load
 * (settings, currency, theme, i18n copy). They change rarely, so identical
 * reads within a short window share one in-flight request instead of each
 * component paying its own round-trip. Any write to the table clears it.
 */
const CACHEABLE = new Set(["site_settings", "themes", "categories", "brands", "pages", "contents", "shipping_methods", "payment_methods"]);
const READ_TTL = 60_000;
const readCache = new Map<string, { at: number; promise: Promise<Row[]> }>();

function clearReadCache(table?: string) {
  if (!table) return readCache.clear();
  for (const key of readCache.keys()) if (key.startsWith(`${table}|`)) readCache.delete(key);
}

function cachedRead(table: string, key: string, run: () => Promise<Row[]>) {
  if (!CACHEABLE.has(table)) return run();
  const cacheKey = `${table}|${key}`;
  const hit = readCache.get(cacheKey);
  if (hit && Date.now() - hit.at < READ_TTL) return hit.promise;
  const promise = run().catch((err) => {
    readCache.delete(cacheKey);
    throw err;
  });
  readCache.set(cacheKey, { at: Date.now(), promise });
  return promise;
}

function makeEntity(name: string) {
  const table = TABLES[name];
  if (!table) throw new Error(`Unknown entity: ${name}`);
  const isUser = name === "User";
  const isAuction = table === "auctions";
  // Bid history is only readable by signed-in users. Signed-out visitors get
  // empty results instead of a permission error that would break the page.
  const isBid = table === "bids";

  /**
   * Signed-out visitors read auctions through a public view that omits internal
   * cost figures and participant identifiers. Signed-in users read the table.
   */
  async function source() {
    if (!isAuction) return table;
    const { data } = await supabase.auth.getSession();
    return data?.session ? "auctions" : "auctions_public";
  }

  /** True when the table needs a session the visitor does not have. */
  async function readBlocked() {
    if (!isBid) return false;
    const { data } = await supabase.auth.getSession();
    return !data?.session;
  }

  const finish = async (rows: Row[]) => {
    if (isAuction) {
      rows = rows.map((r) =>
        r && r["subscriber_count"] !== undefined && r["subscriber_ids"] === undefined
          ? { ...r, subscriber_ids: Array.from({ length: Number(r["subscriber_count"]) || 0 }, () => "") }
          : r,
      );
    }
    return isUser ? withRoles(rows) : rows;
  };

  return {
    table,
    async list(sort?: string | number, limit?: number) {
      if (await readBlocked()) return [] as Row[];
      return cachedRead(table, `list:${sort}:${limit}`, async () => {
        const { data, error } = await applySort(db.from(await source()).select("*"), sort, limit);
        if (error) throw error;
        return finish(data || []);
      });
    },
    /** Same as list() but transfers only the named columns. */
    async listFields(fields: string, sort?: string | number, limit?: number) {
      if (await readBlocked()) return [] as Row[];
      const { data, error } = await applySort(db.from(await source()).select(fields), sort, limit);
      if (error) throw error;
      return (data || []) as Row[];
    },

    /**
     * Server-side pagination: only one page of rows crosses the wire and the
     * total row count comes from Postgres, so admin tables stay fast as the
     * dataset grows.
     *   page({ page: 1, pageSize: 25, where, sort, fields, search: { columns, term } })
     *   -> { rows, total, page, pageSize, pageCount }
     */
    async page(opts: Row = {}) {
      const pageNum = Math.max(1, Number(opts.page) || 1);
      const pageSize = Math.max(1, Number(opts.pageSize) || 25);
      if (await readBlocked()) return { rows: [] as Row[], total: 0, page: pageNum, pageSize, pageCount: 1 };
      let query = db.from(await source()).select(opts.fields || "*", { count: "exact" });
      query = applyWhere(query, opts.where || {});
      const term = String(opts.search?.term || "").trim();
      const columns: string[] = opts.search?.columns || [];
      if (term && columns.length) {
        const safe = term.replace(/[%,()]/g, " ");
        query = query.or(columns.map((c) => `${c}.ilike.%${safe}%`).join(","));
      }
      if (opts.sort) {
        const desc = String(opts.sort).startsWith("-");
        query = query.order(desc ? String(opts.sort).slice(1) : String(opts.sort), { ascending: !desc });
      }
      const from = (pageNum - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = await finish(data || []);
      const total = Number(count || 0);
      return { rows, total, page: pageNum, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
    },


    async filter(where: Row = {}, sort?: string | number, limit?: number) {
      if (await readBlocked()) return [] as Row[];
      return cachedRead(table, `filter:${JSON.stringify(where)}:${sort}:${limit}`, async () => {
        const query = applyWhere(db.from(await source()).select("*"), where);
        const { data, error } = await applySort(query, sort, limit);
        if (error) throw error;
        return finish(data || []);
      });
    },

    async get(id: string) {
      const { data, error } = await db.from(await source()).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("not_found");
      return (await finish([data]))[0];
    },
    async create(values: Row) {
      const { data, error } = await db.from(table).insert(values).select().single();
      if (error) throw error;
      clearReadCache(table);
      return data;
    },
    async update(id: string, values: Row) {
      const { data, error } = await db.from(table).update(values).eq("id", id).select().single();
      if (error) throw error;
      clearReadCache(table);
      if (table === "profiles" || table === "user_roles") invalidateProfileCache();
      return data;
    },
    async delete(id: string) {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
      clearReadCache(table);
      return { ok: true };
    },
    /** Realtime: cb({ id, data, event, type }) — returns an unsubscribe function. */
    subscribe(cb: (event: { id?: string; data: Row; event: string; type: string }) => void) {
      const TYPES: Record<string, string> = { INSERT: "create", UPDATE: "update", DELETE: "delete" };
      const channel = supabase
        .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, (payload: any) => {
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          const evt = String(payload.eventType || payload.type || "");
          clearReadCache(table);
          cb({ id: row?.id, data: row || {}, event: evt, type: TYPES[evt] || evt.toLowerCase() });
        })
        .subscribe();

      return () => {
        db.removeChannel(channel);
      };
    },
  };
}

const entityCache: Record<string, ReturnType<typeof makeEntity>> = {};
const entities = new Proxy({} as Record<string, ReturnType<typeof makeEntity>>, {
  get(_target, prop: string) {
    if (!entityCache[prop]) entityCache[prop] = makeEntity(prop);
    return entityCache[prop];
  },
  has(_t, prop: string) {
    return prop in TABLES;
  },
  ownKeys() {
    return Object.keys(TABLES);
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
});

// The identity is read on nearly every screen (layout, bell, admin, pages).
// Without dedupe each mount cost getUser() + profile + roles round-trips, which
// is what made navigation feel slow. One in-flight promise, short TTL, and the
// cache is dropped whenever the session or the profile changes.
let profileCache: { at: number; promise: Promise<Row> } | null = null;
const PROFILE_TTL = 30_000;

export function invalidateProfileCache() {
  profileCache = null;
}

async function loadProfile() {
  // getSession() reads the local session without a network call; getUser()
  // round-trips to the auth server on every invocation.
  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData?.session?.user;
  if (!authUser) throw Object.assign(new Error("Unauthorized"), { status: 401 });

  // Fetched in parallel: neither query depends on the other.
  const [{ data: profile }, { data: roles }] = await Promise.all([
    db.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", authUser.id),
  ]);
  const role = (roles || []).some((r: Row) => r.role === "admin") ? "admin" : "user";

  return {
    id: authUser.id,
    email: authUser.email || profile?.email || "",
    full_name:
      profile?.full_name || (authUser.user_metadata as Row)?.["full_name"] || (authUser.user_metadata as Row)?.["name"] || "",
    ...(profile || {}),
    role,
    is_verified: profile?.verification_status === "verified",
  } as Row;
}

function currentProfile(): Promise<Row> {
  const now = Date.now();
  if (profileCache && now - profileCache.at < PROFILE_TTL) return profileCache.promise;
  const promise = loadProfile().catch((err) => {
    profileCache = null;
    throw err;
  });
  profileCache = { at: now, promise };
  return promise;
}

const auth = {
  async me() {
    return currentProfile();
  },

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },
  /** No-op: Lovable Cloud manages the session itself. */
  setToken(_token?: string) {},
  async loginViaEmailPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async register({
    email,
    password,
    firstName,
    lastName,
    country,
    countryCode,
    phone,
    phoneCountryCode,
    phoneNumber,
  }: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    countryCode?: string;
    phone?: string;
    phoneCountryCode?: string;
    phoneNumber?: string;
  }) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || null,
          country: country || null,
          country_code: countryCode || null,
          phone: phone || null,
          whatsapp_country_code: phoneCountryCode || null,
          whatsapp_number: phoneNumber || null,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async verifyOtp({ email, otpCode }: { email: string; otpCode: string }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
    if (error) throw error;
    return { access_token: data.session?.access_token, ...data };
  },
  async resendOtp(email: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
    return { ok: true };
  },
  async resetPasswordRequest(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { ok: true };
  },
  async resetPassword({ newPassword }: { resetToken?: string; newPassword: string }) {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      const err: Error & { status?: number } = new Error("recovery_link_expired");
      err.status = 401;
      throw err;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  },
  /** Re-authenticate with the current password, then set a new one. */
  async changePassword({
    currentPassword,
    newPassword,
  }: {
    userId?: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const { data: sess } = await supabase.auth.getSession();
    const email = sess.session?.user?.email;
    if (!email) {
      const err: Error & { status?: number } = new Error("not_signed_in");
      err.status = 401;
      throw err;
    }
    const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauth.error) {
      const err: Error & { status?: number } = new Error("invalid_current_password");
      err.status = 401;
      throw err;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      const err: Error & { status?: number } = new Error(error.message);
      err.status = 422;
      throw err;
    }
    return { ok: true };
  },
  async loginWithProvider(provider: string, returnTo?: string) {
    if (returnTo) {
      try {
        sessionStorage.setItem("postLoginReturnTo", returnTo);
      } catch {
        /* ignore */
      }
    }
    const result = await lovable.auth.signInWithOAuth(provider as "google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw new Error(result.error.message || "Sign-in failed");
    if (result.redirected) return result;
    window.location.href = safePath(returnTo) || "/";
    return result;
  },
  async updateMe(patch: Row) {
    const { data: sessionData } = await supabase.auth.getSession();
    const id = sessionData?.session?.user?.id;
    if (!id) throw new Error("Unauthorized");
    const { data, error } = await db.from("profiles").update(patch).eq("id", id).select().single();
    if (error) throw error;
    invalidateProfileCache();
    return data;
  },
  async logout(redirectTo?: string) {
    invalidateProfileCache();
    await supabase.auth.signOut();
    if (redirectTo) window.location.href = redirectTo;
    return { ok: true };
  },
  redirectToLogin(returnTo?: string) {
    const dest = safePath(returnTo);
    window.location.href = dest && dest !== "/" ? `/login?returnTo=${encodeURIComponent(dest)}` : "/login";
  },
  /** Subscribe to identity transitions. Returns an unsubscribe function. */
  onAuthStateChange(callback: (event: string) => void) {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      invalidateProfileCache();
      callback(event);
    });
    return () => data.subscription.unsubscribe();
  },


};

/** Only allow same-origin relative destinations. */
function safePath(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return url.pathname + url.search + url.hash;
  } catch {
    return "";
  }
}

const functions = {
  /** Mirrors the old edge-function response shape: { data, status }. */
  async invoke(name: string, payload: Row = {}) {
    const result = await invokeBackend({ data: { name, payload } });
    return { data: result?.data ?? result, status: result?.status ?? 200 };
  },
};

export const base44 = {
  entities,
  auth,
  functions,
  users: {
    async inviteUser(email: string, role?: string) {
      const res = await functions.invoke("inviteUser", { email, role });
      if (res.data?.["error"]) throw new Error(res.data["error"]);
      return res.data;
    },
  },
  integrations: {
    Core: {
      async SendEmail(args: { to: string; subject: string; body: string }) {
        const res = await functions.invoke("sendEmail", args);
        if (res.data?.["error"]) throw new Error(res.data["error"]);
        return res.data;
      },
    },
  },
};

export default base44;
