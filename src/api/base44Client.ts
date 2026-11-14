/**
 * Frontend-only (design) build.
 *
 * This keeps the app's `base44.*` call surface so every screen still renders,
 * but there is no backend, no database and no storage behind it:
 *   - entity reads return empty results, writes are accepted and discarded
 *   - functions.invoke returns an empty success payload
 *   - auth holds a placeholder signed-in user in memory so every screen,
 *     including the admin area, can be opened for design review
 *
 * To connect a real backend later, re-implement this file against it.
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

const PLACEHOLDER_USER: Row = {
  id: "design-user",
  email: "demo@example.com",
  first_name: "Demo",
  last_name: "User",
  full_name: "Demo User",
  country: "",
  role: "admin",
  is_super: true,
  staff_role: "super_admin",
  verification_status: "verified",
  is_verified: true,
  paused: false,
  permissions: {},
  watched_auction_ids: [],
  created_date: now(),
};

// In memory only: a reload always starts signed in as the placeholder user.
let signedIn = true;
const authListeners = new Set<(event: string) => void>();
const emitAuth = (event: string) => authListeners.forEach((cb) => cb(event));

export function invalidateProfileCache() {}

const auth = {
  async me() {
    if (!signedIn) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    return { ...PLACEHOLDER_USER };
  },
  async isAuthenticated() {
    return signedIn;
  },
  setToken(_token?: string) {},
  async loginViaEmailPassword(_email: string, _password: string) {
    signedIn = true;
    emitAuth("SIGNED_IN");
    return { user: PLACEHOLDER_USER };
  },
  async register(_input: Row) {
    signedIn = true;
    emitAuth("SIGNED_IN");
    return { user: PLACEHOLDER_USER, session: null };
  },
  async verifyOtp(_input: { email: string; otpCode: string }) {
    signedIn = true;
    emitAuth("SIGNED_IN");
    return { access_token: "design" };
  },
  async resendOtp(_email: string) {
    return { ok: true };
  },
  async resetPasswordRequest(_email: string) {
    return { ok: true };
  },
  async resetPassword(_input: { resetToken?: string; newPassword: string }) {
    return { ok: true };
  },
  async changePassword(_input: { userId?: string; currentPassword: string; newPassword: string }) {
    return { ok: true };
  },
  async loginWithProvider(_provider: string, returnTo?: string) {
    signedIn = true;
    emitAuth("SIGNED_IN");
    window.location.href = safePath(returnTo) || "/";
    return { redirected: true };
  },
  async updateMe(patch: Row) {
    Object.assign(PLACEHOLDER_USER, patch);
    emitAuth("USER_UPDATED");
    return { ...PLACEHOLDER_USER };
  },
  async logout(redirectTo?: string) {
    signedIn = false;
    emitAuth("SIGNED_OUT");
    if (redirectTo) window.location.href = redirectTo;
    return { ok: true };
  },
  redirectToLogin(returnTo?: string) {
    const dest = safePath(returnTo);
    window.location.href = dest && dest !== "/" ? `/login?returnTo=${encodeURIComponent(dest)}` : "/login";
  },
  onAuthStateChange(callback: (event: string) => void) {
    authListeners.add(callback);
    return () => {
      authListeners.delete(callback);
    };
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

/* ------------------------------- functions ------------------------------ */

const functions = {
  /** No backend: every call succeeds with an empty payload. */
  async invoke(name: string, _payload: Row = {}) {
    if (name === "myAdminCapabilities") {
      return { data: { is_admin: true, is_super: true, capabilities: [], staff_role: "super_admin" }, status: 200 };
    }
    return { data: { ok: true }, status: 200 };
  },
};

export const base44 = {
  entities,
  auth,
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
