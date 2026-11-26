// Admin > Design theme for the customer site (every page except /admin):
// fonts, text and accent colours, card surfaces, corner radius, status
// badges and the page background.
//
// applyTheme writes --theme-* variables on <html>; the rules at the end of
// src/styles.css map them onto the normal tokens (--font-*, --card,
// --background, --radius...) on customer pages only. Saved keys keep their
// original hero* names so published versions stay valid.

export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Sora", label: "Sora" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Cairo", label: "Cairo (Arabic)" },
  { value: "Tajawal", label: "Tajawal (Arabic)" },
];

// null means "use the site default" (no override is written).
export const DEFAULT_THEME = {
  fontHeading: "Inter",
  fontBody: "Inter",
  fontDisplay: "Inter",
  heroHeading: null,
  bodyText: null,
  heroText: null,
  accent: null,
  accentText: null,
  heroPrimary: null,
  heroPrimaryText: null,
  heroLiveBadge: null,
  heroLiveBadgeText: null,
  heroOpenBadge: null,
  heroOpenBadgeText: null,
  heroCard: null,
  heroCardRadius: null,
  pageBackground: null,
  navActive: null,
  navHover: null,
  chatMine: null,
  chatMineText: null,
  chatOther: null,
  chatOtherText: null,
};

/** WCAG contrast ratio of two hex colours (1–21), or null if either is invalid. */
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const n = normalizeHex(hex);
    if (!n) return null;
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = lum(a);
  const lb = lum(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#abc" / "#aabbcc" → "#aabbcc", or null when not a valid hex colour. */
export function normalizeHex(value) {
  if (typeof value !== "string" || !HEX_RE.test(value.trim())) return null;
  let h = value.trim().slice(1).toLowerCase();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  return `#${h}`;
}

function hexToHsl(hex) {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** #rrggbb → the "h s% l%" channel string the colour tokens use. */
export function hexToHslChannels(hex) {
  const c = hexToHsl(hex);
  return c ? `${c.h} ${c.s}% ${c.l}%` : "0 0% 50%";
}

/** "h s% l%" (a token value) → #rrggbb, for the colour input's default. */
export function hslChannelsToHex(channels) {
  const m = String(channels || "").match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "#10243a";
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const fontStack = (name) => `"${name}", ui-sans-serif, system-ui, sans-serif`;

const channels = (hex) => {
  const c = hexToHsl(hex);
  return c && `${c.h} ${c.s}% ${c.l}%`;
};

/**
 * The --theme-* variables for a theme. Unset values are left out, so the
 * defaults in src/styles.css apply. With `withDefaults`, they are filled with
 * the site tokens instead (the admin preview, which must not inherit the
 * published theme from <html>).
 */
export function themeVars(theme, { withDefaults = false } = {}) {
  const t = { ...DEFAULT_THEME, ...theme };
  const vars = {};
  const set = (name, value, fallback) => {
    if (value != null) vars[name] = value;
    else if (withDefaults) vars[name] = fallback;
  };
  set("--theme-font-heading", t.fontHeading && fontStack(t.fontHeading), "var(--font-heading)");
  set("--theme-font-body", t.fontBody && fontStack(t.fontBody), "var(--font-body)");
  set("--theme-font-display", t.fontDisplay && fontStack(t.fontDisplay), "var(--font-display)");

  set("--theme-heading", channels(t.heroHeading), "var(--foreground)");
  // Main text: every text-foreground, plain body text and text on cards,
  // menus, secondary buttons and surfaces.
  const fg = channels(t.bodyText);
  set("--theme-fg", fg, "var(--foreground)");
  set("--theme-card-fg", fg, "var(--card-foreground)");
  set("--theme-popover-fg", fg, "var(--popover-foreground)");
  set("--theme-secondary-fg", fg, "var(--secondary-foreground)");
  set("--theme-surface-fg", fg, "var(--surface-foreground)");
  set("--theme-text", channels(t.heroText), "var(--muted-foreground)");
  set("--theme-primary", channels(t.heroPrimary), "var(--primary)");
  set("--theme-primary-fg", channels(t.heroPrimaryText), "var(--primary-foreground)");
  // gold-button is a gradient from --gold-soft to --primary: derive the
  // lighter top from the chosen accent so the button stays one colour family.
  const primary = hexToHsl(t.heroPrimary);
  set(
    "--theme-gold-soft",
    primary && `${primary.h} ${primary.s}% ${Math.min(95, primary.l + 8)}%`,
    "var(--gold-soft)",
  );

  // Focus rings follow the primary accent.
  set("--theme-ring", channels(t.heroPrimary), "var(--ring)");

  // Secondary accent (the cyan): icons, highlights, the cyan button and the
  // hover colour of outline / ghost / secondary buttons.
  const accent = hexToHsl(t.accent);
  set("--theme-accent", channels(t.accent), "var(--accent)");
  set("--theme-accent-fg", channels(t.accentText), "var(--accent-foreground)");
  set(
    "--theme-cyan-glow",
    accent && `${accent.h} ${Math.min(100, accent.s + 5)}% ${Math.min(95, accent.l + 4)}%`,
    "var(--cyan-glow)",
  );

  // Status badges: "Live now" and "Open for entry".
  set("--theme-live-bg", channels(t.heroLiveBadge), "var(--destructive)");
  set("--theme-live-fg", channels(t.heroLiveBadgeText), "var(--destructive-foreground)");
  set("--theme-open-bg", channels(t.heroOpenBadge), "var(--success)");
  set("--theme-open-fg", channels(t.heroOpenBadgeText), "var(--success-foreground)");

  const card = hexToHsl(t.heroCard);
  set("--theme-card", channels(t.heroCard), "var(--card)");
  // native-panel is a gradient from --card to --surface: keep that depth by
  // making the surface a touch lighter (or darker, on a light card).
  const surfaceL = card && (card.l > 60 ? card.l - 3 : card.l + 2);
  set("--theme-surface", card && `${card.h} ${card.s}% ${surfaceL}%`, "var(--surface)");
  // Neutral surfaces (outline buttons, inputs, chips, dividers, menus) are
  // shades of the card colour: lighter on a dark card, darker on a light one.
  const shade = (dl, ds = 0) =>
    card &&
    `${card.h} ${Math.max(0, Math.min(100, card.s + ds))}% ${Math.max(0, Math.min(100, card.l > 60 ? card.l - dl : card.l + dl))}%`;
  set("--theme-secondary", shade(5, -6), "var(--secondary)");
  set("--theme-muted", shade(4, -12), "var(--muted)");
  set("--theme-border", shade(14, -10), "var(--border)");
  set("--theme-input", shade(13, -10), "var(--input)");
  set("--theme-popover", channels(t.heroCard), "var(--popover)");
  set("--theme-navy-raised", shade(4), "var(--navy-raised)");

  // Page background: one colour; the gradient's darker end is derived from it.
  const bg = hexToHsl(t.pageBackground);
  set("--theme-bg", channels(t.pageBackground), "var(--background)");
  set(
    "--theme-bg-deep",
    bg && `${bg.h} ${Math.min(100, bg.s + 4)}% ${bg.l > 60 ? bg.l - 6 : Math.max(0, bg.l - 2)}%`,
    "var(--navy-deep)",
  );

  // Navigation tabs. Unset, the active tab follows the primary accent and
  // hover the site accent (fallbacks in the .theme-tab-* rules).
  set("--theme-tab-active", channels(t.navActive), "var(--theme-primary)");
  set("--theme-tab-hover", channels(t.navHover), "var(--theme-accent)");

  // Auction chat bubbles. Unset, your own follow the secondary accent and
  // others the muted surface (fallbacks in the .theme-chat-* rules).
  set("--theme-chat-mine", channels(t.chatMine), "var(--theme-accent)");
  set("--theme-chat-mine-fg", channels(t.chatMineText), "var(--theme-accent-fg)");
  set("--theme-chat-other", channels(t.chatOther), "var(--theme-muted)");
  set("--theme-chat-other-fg", channels(t.chatOtherText), "var(--theme-fg)");

  // rounded-xl (cards, buttons) = the chosen radius; rounded-lg (badges) 4px less.
  set(
    "--theme-radius-base",
    typeof t.heroCardRadius === "number" ? `${Math.max(0, t.heroCardRadius - 4)}px` : null,
    "var(--radius)",
  );
  return vars;
}

const THEME_VARS = [
  "--theme-font-heading",
  "--theme-font-body",
  "--theme-font-display",
  "--theme-heading",
  "--theme-fg",
  "--theme-card-fg",
  "--theme-popover-fg",
  "--theme-secondary-fg",
  "--theme-surface-fg",
  "--theme-text",
  "--theme-ring",
  "--theme-accent",
  "--theme-accent-fg",
  "--theme-cyan-glow",
  "--theme-secondary",
  "--theme-muted",
  "--theme-border",
  "--theme-input",
  "--theme-popover",
  "--theme-navy-raised",
  "--theme-primary",
  "--theme-primary-fg",
  "--theme-gold-soft",
  "--theme-live-bg",
  "--theme-live-fg",
  "--theme-open-bg",
  "--theme-open-fg",
  "--theme-card",
  "--theme-surface",
  "--theme-bg",
  "--theme-bg-deep",
  "--theme-radius-base",
  "--theme-tab-active",
  "--theme-tab-hover",
  "--theme-chat-mine",
  "--theme-chat-mine-fg",
  "--theme-chat-other",
  "--theme-chat-other-fg",
];
// Written by older versions of applyTheme; cleared so they cannot linger.
const LEGACY_VARS = [
  "--font-heading",
  "--font-body",
  "--font-display",
  "--radius",
  "--radius-theme",
  "--hero-font-heading",
  "--hero-font-body",
  "--hero-font-display",
  "--hero-heading",
  "--hero-text",
  "--hero-primary",
  "--hero-primary-fg",
  "--hero-gold-soft",
  "--hero-live-bg",
  "--hero-live-fg",
  "--hero-open-bg",
  "--hero-open-fg",
  "--hero-card",
  "--hero-surface",
  "--hero-card-radius",
];

/** Load a Google font on demand (Inter is already linked in __root). */
export function ensureFont(name) {
  if (typeof document === "undefined" || !name || name === "Inter") return;
  const id = `theme-font-${name.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function ensureThemeFonts(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  new Set([t.fontHeading, t.fontBody, t.fontDisplay]).forEach(ensureFont);
}

/** The browser toolbar colour (theme-color meta) for customer pages. */
export function themeColorFor(theme) {
  return normalizeHex(theme?.pageBackground) || "#091729";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = themeVars(theme);
  LEGACY_VARS.forEach((v) => root.style.removeProperty(v));
  THEME_VARS.forEach((v) => {
    if (vars[v] != null) root.style.setProperty(v, vars[v]);
    else root.style.removeProperty(v);
  });
  root.dataset.themeColor = themeColorFor(theme);
  // Heading colour rules only apply when a heading colour is chosen.
  // (also when only the main text is set, so headings keep the default
  // heading colour instead of turning into body text).
  root.toggleAttribute(
    "data-theme-heading",
    vars["--theme-heading"] != null || vars["--theme-fg"] != null,
  );
  syncThemeColorMeta();
  ensureThemeFonts(theme);
}

/** Point the theme-color meta at the theme on customer pages, default on admin. */
export function syncThemeColorMeta() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute(
    "content",
    root.hasAttribute("data-site-theme") ? root.dataset.themeColor || "#091729" : "#091729",
  );
}
