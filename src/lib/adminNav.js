import {
  ActivitySquare, Gavel, FileText, Users, Sparkles, Palette, BarChart3, Radio, Trophy, Wallet, Send,
  ListFilter, CreditCard, PackageCheck, RotateCcw, UserCheck, Contact, Settings, Tags,
  LifeBuoy, Ticket, Activity, KeyRound, History, ShieldCheck, Mail, Tag, Truck, Flag,
  LayoutDashboard, MessageSquare, Receipt, Server, SlidersHorizontal, Boxes, TrendingUp, FlaskConical
} from "lucide-react";

/** Every admin section: icon + label resolver. */
export const SECTIONS = {
  analytics: { icon: BarChart3, label: (t) => t.admin.tabs.analytics },
  live: { icon: Radio, label: (t) => t.admin.tabs.live },
  auctions: { icon: Gavel, label: (t) => t.admin.tabs.auctions },
  results: { icon: Trophy, label: (t) => t.admin.tabs.results },
  fulfilment: { icon: PackageCheck, label: (t) => t.admin.fulfilment.title },
  categories: { icon: Tags, label: (t) => t.admin.tabs.categories },
  brands: { icon: Tag, label: (t) => t.admin.tabs.brands },
  winnerpayments: { icon: Receipt, label: (t) => t.admin.winnerPayments?.title || "Winner payments" },
  auctionpl: { icon: BarChart3, label: (t) => t.admin.auctionPl?.title || "Auction P&L" },
  revenue: { icon: TrendingUp, label: (t) => t.admin.tabs.revenue || "Revenue" },
  payments: { icon: Wallet, label: (t) => t.admin.tabs.payments },
  payment_methods: { icon: CreditCard, label: (t) => t.admin.tabs.paymentMethods },
  refunds: { icon: RotateCcw, label: (t) => t.admin.refunds.title },
  coupons: { icon: Ticket, label: (t) => t.admin.tabs.coupons },
  users: { icon: Users, label: (t) => t.admin.tabs.users },
  participants: { icon: Contact, label: (t) => t.admin.tabs.participants },
  verification: { icon: UserCheck, label: (t) => t.admin.verification.title },
  roles: { icon: ShieldCheck, label: (t) => t.admin.tabs.roles },
  hero: { icon: Sparkles, label: (t) => t.admin.tabs.hero },
  pages: { icon: FileText, label: (t) => t.admin.tabs.pages },
  design: { icon: Palette, label: (t) => t.admin.tabs.design },
  broadcast: { icon: Send, label: (t) => t.admin.tabs.broadcast },
  notifications: { icon: ListFilter, label: (t) => t.admin.tabs.notifications },
  templates: { icon: Mail, label: (t) => t.admin.tabs.templates },
  support: { icon: LifeBuoy, label: (t) => t.admin.tabs.support },
  system: { icon: Activity, label: (t) => t.admin.tabs.system },
  bidmonitor: { icon: ActivitySquare, label: (t) => t.admin.tabs.bidmonitor },
  activitylog: { icon: History, label: (t) => t.admin.tabs.activitylog },
  apikeys: { icon: KeyRound, label: (t) => t.admin.tabs.apikeys },
  reports: { icon: Flag, label: (t) => t.admin.tabs.reports },
  testmode: { icon: FlaskConical, label: (t) => t.admin.tabs.testmode || "Test mode" },
  settings: { icon: Settings, label: (t) => t.admin.tabs.settings },
  shipping: { icon: Truck, label: (t) => t.admin.tabs.shipping },
};

/** 8 domains instead of 29 flat rows. */
export const GROUPS = [
  { id: "overview", icon: LayoutDashboard, label: (t) => t.admin.groups.overview, items: ["analytics"] },
  { id: "management", icon: Gavel, label: (t) => t.admin.groups.management, items: ["live", "bidmonitor", "auctions", "results", "fulfilment", "categories", "brands"] },
  { id: "finance", icon: Wallet, label: (t) => t.admin.groups.finance, items: ["revenue", "auctionpl", "winnerpayments", "payments", "payment_methods", "refunds", "coupons"] },
  { id: "people", icon: Users, label: (t) => t.admin.groups.staffing, items: ["users", "roles"] },
  { id: "participants", icon: Contact, label: (t) => t.admin.groups.participants, items: ["participants", "verification"] },
  { id: "content", icon: Boxes, label: (t) => t.admin.groups.content, items: ["hero", "pages", "design"] },
  { id: "messaging", icon: MessageSquare, label: (t) => t.admin.groups.communication, items: ["broadcast", "notifications", "templates", "support"] },
  { id: "ops", icon: Server, label: (t) => t.admin.groups.system, items: ["system", "activitylog", "apikeys", "reports", "testmode"] },
  { id: "config", icon: SlidersHorizontal, label: (t) => t.admin.groups.config, items: ["settings", "shipping"] },
];

export const SECTION_IDS = Object.keys(SECTIONS);
export const DEFAULT_SECTION = "analytics";

export const groupOfSection = (id) => GROUPS.find((g) => g.items.includes(id)) || GROUPS[0];

export const sectionLabel = (t, id) => {
  try { return SECTIONS[id]?.label(t) || id; } catch { return id; }
};
