// Default Street Neon theme + helpers to materialize a theme as CSS custom properties.

export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Sora", label: "Sora" },
];

export const DEFAULT_THEME = {
  background: "#091729",
  foreground: "#F7FAFC",
  card: "#10243A",
  primary: "#E8BE54",
  primaryForeground: "#071522",
  neonLime: "#E8BE54",
  neonPink: "#F05F78",
  neonViolet: "#21C7E5",
  fontHeading: "Inter",
  fontBody: "Inter",
  fontDisplay: "Sora",
  radius: 10,
  components: {
    buttonVariant: "solid",
    cardBorder: "subtle",
    badgeStyle: "pill",
  },
  sections: {
    hero: { accent: "lime" },
    card: { radius: 16 },
    footer: { tone: "dark" },
  },
};

// Convert #rrggbb to HSL channel string "h s% l%" used by the token CSS variables.
export function hexToHslChannels(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return "0 0% 50%";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hh = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hh = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hh = (b - r) / d + 2;
        break;
      default:
        hh = (r - g) / d + 4;
    }
    hh *= 60;
  }
  return `${Math.round(hh)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function lightnessOf(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return 50;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return ((parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16)) / 3 / 255) * 100;
}

// Runtime customisation is intentionally limited to typography and radius.
// The product palette is a fixed accessibility-tested brand system shared by
// customer and admin screens, so an older saved theme cannot override it.
const RUNTIME_VARS = {
  fontHeading: ["--font-heading"],
  fontBody: ["--font-body"],
  fontDisplay: ["--font-display"],
};

export function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;
  if (!root) return;
  Object.entries(RUNTIME_VARS).forEach(([key, vars]) => {
    const value = t[key];
    if (value == null) return;
    const cssValue = String(value);
    vars.forEach((v) => root.style.setProperty(v, cssValue));
  });
  if (typeof t.radius === "number") {
    root.style.setProperty("--radius", `${t.radius}px`);
    // The flat look halves this (src/styles.css, [data-look="flat"]).
    root.style.setProperty("--radius-theme", `${t.radius}px`);
  }
}

// Preview: full style object (also sets foreground/card/border/muted so the preview reads correctly on a dark canvas).
export function themeToStyle(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const darkCanvas = lightnessOf(t.background) < 50;
  const fgCh = hexToHslChannels(t.foreground);
  const s = {
    "--ink-950": hexToHslChannels(t.background),
    "--ink-900": hexToHslChannels(t.card),
    "--ink-800": hexToHslChannels(t.card),
    "--primary": hexToHslChannels(t.primary),
    "--primary-foreground": hexToHslChannels(t.primaryForeground),
    "--neon-lime": hexToHslChannels(t.neonLime),
    "--neon-pink": hexToHslChannels(t.neonPink),
    "--neon-violet": hexToHslChannels(t.neonViolet),
    "--background": hexToHslChannels(t.background),
    "--foreground": fgCh,
    "--card": hexToHslChannels(t.card),
    "--card-foreground": fgCh,
    "--popover": hexToHslChannels(t.card),
    "--popover-foreground": fgCh,
    "--muted-foreground": darkCanvas ? "0 0% 68%" : "0 0% 42%",
    "--secondary": darkCanvas ? "0 0% 16%" : "0 0% 96%",
    "--secondary-foreground": fgCh,
    "--accent": darkCanvas ? "0 0% 18%" : "0 0% 94%",
    "--accent-foreground": fgCh,
    "--border": darkCanvas ? "0 0% 24%" : "0 0% 90%",
    "--input": darkCanvas ? "0 0% 24%" : "0 0% 90%",
    "--font-heading": t.fontHeading,
    "--font-body": t.fontBody,
    "--font-display": t.fontDisplay,
    // Halved like the live site (flat look, src/styles.css).
    "--radius": `${t.radius / 2}px`,
  };
  return s;
}