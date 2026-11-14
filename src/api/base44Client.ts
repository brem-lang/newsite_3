import { supabase, supabaseAdmin } from "@/lib/supabase";

/**
 * Design build with real authentication.
 *
 * Keeps the app's `base44.*` call surface. Sign-in is real (self-hosted
 * Supabase):
 *   - auth: customer accounts (Supabase Auth + public.profiles)
 *   - adminAuth: separate staff session for /admin; requires a row in
 *     public.user_roles (admin / super_admin)
 *   - entities: read/write the Supabase tables (row-level security decides
 *     who may write; /admin pages use the staff session)
 *   - functions.invoke: server actions in the "api" Edge Function
 *   - subscribe: live row changes over Supabase Realtime
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

/* ------------------------------- entities ------------------------------- */

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

/**
 * Data calls use the session of the area the visitor is in: the staff session
 * on /admin, the customer session everywhere else.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/admin") ? supabaseAdmin : supabase;

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
  const { data } = await db().from("user_roles").select("user_id, role").in("user_id", ids);
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
    const { data } = await db().auth.getSession();
    return data?.session ? "auctions" : "auctions_public";
  }

  /** True when the table needs a session the visitor does not have. */
  async function readBlocked() {
    if (!isBid) return false;
    const { data } = await db().auth.getSession();
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
        const { data, error } = await applySort(db().from(await source()).select("*"), sort, limit);
        if (error) throw error;
        return finish(data || []);
      });
    },
    /** Same as list() but transfers only the named columns. */
    async listFields(fields: string, sort?: string | number, limit?: number) {
      if (await readBlocked()) return [] as Row[];
      const { data, error } = await applySort(db().from(await source()).select(fields), sort, limit);
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
      let query = db().from(await source()).select(opts.fields || "*", { count: "exact" });
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
        const query = applyWhere(db().from(await source()).select("*"), where);
        const { data, error } = await applySort(query, sort, limit);
        if (error) throw error;
        return finish(data || []);
      });
    },

    async get(id: string) {
      const { data, error } = await db().from(await source()).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("not_found");
      return (await finish([data]))[0];
    },
    async create(values: Row) {
      const { data, error } = await db().from(table).insert(values).select().single();
      if (error) throw error;
      clearReadCache(table);
      return data;
    },
    async update(id: string, values: Row) {
      const { data, error } = await db().from(table).update(values).eq("id", id).select().single();
      if (error) throw error;
      clearReadCache(table);
      if (table === "profiles" || table === "user_roles") invalidateProfileCache();
      return data;
    },
    async delete(id: string) {
      const { error } = await db().from(table).delete().eq("id", id);
      if (error) throw error;
      clearReadCache(table);
      return { ok: true };
    },
    /** Realtime: cb({ id, data, event, type }) — returns an unsubscribe function. */
    subscribe(cb: (event: { id?: string; data: Row; event: string; type: string }) => void) {
      const TYPES: Record<string, string> = { INSERT: "create", UPDATE: "update", DELETE: "delete" };
      const client = db();
      const channel = client
        .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, (payload: Row) => {
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          const evt = String(payload.eventType || payload.type || "");
          clearReadCache(table);
          cb({ id: row?.id, data: row || {}, event: evt, type: TYPES[evt] || evt.toLowerCase() });
        })
        .subscribe();
      return () => {
        client.removeChannel(channel);
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

/* --------------------------------- auth --------------------------------- */

type AuthClient = typeof supabase;

const unauthorized = (message = "Unauthorized") => Object.assign(new Error(message), { status: 401 });

/** Profile + staff role for whoever is signed in on `client`. */
async function loadProfile(client: AuthClient) {
  const { data: sessionData } = await client.auth.getSession();
  const authUser = sessionData?.session?.user;
  if (!authUser) throw unauthorized();

  const [{ data: profile }, { data: roles }] = await Promise.all([
    client.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", authUser.id),
  ]);
  const isStaff = (roles || []).some((r: Row) => r.role === "admin");
  const staffRole = isStaff ? profile?.staff_role || (profile?.is_super ? "super_admin" : "admin") : null;
  const meta = (authUser.user_metadata || {}) as Row;

  return {
    ...(profile || {}),
    id: authUser.id,
    email: authUser.email || profile?.email || "",
    first_name: profile?.first_name ?? meta.first_name ?? "",
    last_name: profile?.last_name ?? meta.last_name ?? "",
    full_name: profile?.full_name || meta.full_name || "",
    country: profile?.country ?? meta.country ?? "",
    role: isStaff ? "admin" : "user",
    is_super: isStaff && !!profile?.is_super,
    staff_role: staffRole,
    verification_status: profile?.verification_status || "unverified",
    is_verified: profile?.verification_status === "verified",
    paused: !!profile?.paused,
    permissions: profile?.permissions || {},
    watched_auction_ids: profile?.watched_auction_ids || [],
    created_date: profile?.created_date || authUser.created_at,
  } as Row;
}

const PROFILE_TTL = 30_000;
let profileCache: { at: number; promise: Promise<Row> } | null = null;

export function invalidateProfileCache() {
  profileCache = null;
}

function currentProfile(): Promise<Row> {
  const t = Date.now();
  if (profileCache && t - profileCache.at < PROFILE_TTL) return profileCache.promise;
  const promise = loadProfile(supabase).catch((err) => {
    profileCache = null;
    throw err;
  });
  profileCache = { at: t, promise };
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
  /** No-op: supabase-js manages the session itself. */
  setToken(_token?: string) {},
  async loginViaEmailPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    invalidateProfileCache();
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
    if (!sess.session) throw unauthorized("recovery_link_expired");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  },
  /** Re-authenticate with the current password, then set a new one. */
  async changePassword({ currentPassword, newPassword }: { userId?: string; currentPassword: string; newPassword: string }) {
    const { data: sess } = await supabase.auth.getSession();
    const email = sess.session?.user?.email;
    if (!email) throw unauthorized("not_signed_in");
    const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauth.error) throw unauthorized("invalid_current_password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw Object.assign(new Error(error.message), { status: 422 });
    return { ok: true };
  },
  async loginWithProvider(_provider: string, _returnTo?: string): Promise<{ redirected: boolean }> {
    throw new Error("Social sign-in is not set up yet. Please use email and password.");
  },
  /** Staff-only columns are ignored by the database (protect_profile_columns). */
  async updateMe(patch: Row) {
    const { data: sessionData } = await supabase.auth.getSession();
    const id = sessionData?.session?.user?.id;
    if (!id) throw unauthorized();
    const blocked = ["id", "email", "role", "created_date", "updated_date", "is_verified"];
    const values = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => !blocked.includes(k)));
    if (Object.keys(values).length) {
      const { error } = await supabase.from("profiles").update(values).eq("id", id);
      if (error) throw error;
    }
    invalidateProfileCache();
    return currentProfile();
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
      // Run outside the auth lock so callbacks may call supabase again.
      setTimeout(() => callback(event), 0);
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

/* ------------------------------ admin auth ------------------------------ */

// Staff session for /admin, on its own client (see src/lib/supabase.ts).
// Only accounts with a role in public.user_roles get in.
const adminAuth = {
  async me() {
    const profile = await loadProfile(supabaseAdmin);
    if (!profile.staff_role) throw unauthorized("not_staff");
    return profile;
  },
  async isAuthenticated() {
    const { data } = await supabaseAdmin.auth.getSession();
    return !!data.session;
  },
  async login(email: string, password: string) {
    const { error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return loadProfile(supabaseAdmin);
  },
  async logout() {
    await supabaseAdmin.auth.signOut();
    return { ok: true };
  },
};

async function myAdminCapabilities() {
  const none = { is_admin: false, is_super: false, capabilities: [], staff_role: null };
  const { data: sess } = await supabaseAdmin.auth.getSession();
  if (!sess.session) return none;
  const { data, error } = await supabaseAdmin.rpc("my_staff_access");
  if (error || !data?.is_admin) return none;
  return data;
}

/* ------------------------------- functions ------------------------------ */

const functions = {
  /**
   * Server actions run in the "api" Edge Function (supabase/functions/api).
   * Calls carry the session of the current area (staff on /admin).
   * Mirrors the old response shape: { data, status }.
   */
  async invoke(name: string, payload: Row = {}) {
    if (name === "myAdminCapabilities") return { data: await myAdminCapabilities(), status: 200 };
    const { data, error } = await db().functions.invoke("api", { body: { name, payload } });
    if (error) return { data: { error: error.message || "Request failed" }, status: 500 };
    return { data: data?.data ?? {}, status: data?.status ?? 200 };
  },
};

export const base44 = {
  entities,
  auth,
  adminAuth,
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
