import { supabase, supabaseAdmin } from "@/lib/supabase";

/**
 * Design build with real authentication.
 *
 * Keeps the app's `base44.*` call surface. Sign-in is real (self-hosted
 * Supabase); auction data has no backend yet:
 *   - auth: customer accounts (Supabase Auth + public.profiles)
 *   - adminAuth: separate staff session for /admin; requires a row in
 *     public.user_roles (admin / super_admin)
 *   - entity reads return empty results, writes are accepted and discarded
 *   - functions.invoke: only myAdminCapabilities is backed
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const ENTITY_NAMES = [
  "ActivityLog", "ApiKey", "Auction", "AuctionCostItem", "AuctionFinanceOverride", "AuctionFinanceChange",
  "AuctionMessage", "Bid", "BidCredit", "BidEvent", "Brand", "Category", "Content", "Coupon", "Fulfilment",
  "Notification", "Page", "ParticipantNote", "PaymentMethod", "PaymentMethodCredential", "RefundRequest",
  "Report", "Role", "ShippingMethod", "SiteSettings", "SupportTicket", "Template", "Theme", "User",
  "WalletTransaction", "WinnerPayment",
];

const newId = () => `design-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

function makeEntity(name: string) {
  return {
    table: name,
    async list(_sort?: string | number, _limit?: number): Promise<Row[]> {
      return [];
    },
    async listFields(_fields: string, _sort?: string | number, _limit?: number): Promise<Row[]> {
      return [];
    },
    async page(opts: Row = {}) {
      const page = Math.max(1, Number(opts.page) || 1);
      const pageSize = Math.max(1, Number(opts.pageSize) || 25);
      return { rows: [] as Row[], total: 0, page, pageSize, pageCount: 1 };
    },
    async filter(_where: Row = {}, _sort?: string | number, _limit?: number): Promise<Row[]> {
      return [];
    },
    async get(_id: string): Promise<Row> {
      throw new Error("not_found");
    },
    async create(values: Row) {
      return { id: newId(), created_date: now(), updated_date: now(), ...values };
    },
    async update(id: string, values: Row) {
      return { id, updated_date: now(), ...values };
    },
    async delete(_id: string) {
      return { ok: true };
    },
    /** No realtime source: returns a no-op unsubscribe. */
    subscribe(_cb: (event: { id?: string; data: Row; event: string; type: string }) => void) {
      return () => {};
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
    return ENTITY_NAMES.includes(prop);
  },
  ownKeys() {
    return ENTITY_NAMES;
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
  const roleNames = (roles || []).map((r: Row) => r.role as string);
  const staffRole = roleNames.includes("super_admin") ? "super_admin" : roleNames.includes("admin") ? "admin" : null;
  const meta = (authUser.user_metadata || {}) as Row;

  return {
    ...(profile || {}),
    id: authUser.id,
    email: authUser.email || profile?.email || "",
    first_name: profile?.first_name ?? meta.first_name ?? "",
    last_name: profile?.last_name ?? meta.last_name ?? "",
    full_name: profile?.full_name || meta.full_name || "",
    country: profile?.country ?? meta.country ?? "",
    role: staffRole ? "admin" : "user",
    is_super: staffRole === "super_admin",
    staff_role: staffRole,
    verification_status: profile?.verification_status || "unverified",
    is_verified: profile?.verification_status === "verified",
    paused: false,
    permissions: {},
    watched_auction_ids: [],
    created_date: profile?.created_at || authUser.created_at,
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
  /** Only the editable profile columns are sent. */
  async updateMe(patch: Row) {
    const { data: sessionData } = await supabase.auth.getSession();
    const id = sessionData?.session?.user?.id;
    if (!id) throw unauthorized();
    const allowed = ["first_name", "last_name", "full_name", "country"];
    const values = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k)));
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
  const { data: role, error } = await supabaseAdmin.rpc("my_staff_role");
  if (error || !role) return none;
  return { is_admin: true, is_super: role === "super_admin", capabilities: [], staff_role: role };
}

/* ------------------------------- functions ------------------------------ */

const functions = {
  /** Only staff capabilities are backed; everything else has no backend yet. */
  async invoke(name: string, _payload: Row = {}) {
    if (name === "myAdminCapabilities") return { data: await myAdminCapabilities(), status: 200 };
    return { data: { ok: true }, status: 200 };
  },
};

export const base44 = {
  entities,
  auth,
  adminAuth,
  functions,
  users: {
    async inviteUser(_email: string, _role?: string) {
      return { ok: true };
    },
  },
  integrations: {
    Core: {
      async SendEmail(_args: { to: string; subject: string; body: string }) {
        return { ok: true };
      },
    },
  },
};

export default base44;
