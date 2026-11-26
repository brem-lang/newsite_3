import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Palette, Check, RotateCcw, Trash2, Sparkles, Undo2, X, Eraser } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { useSiteTheme, prefetchSiteTheme } from "@/lib/useSiteTheme";
import { DEFAULT_THEME, FONT_OPTIONS, normalizeHex, hslChannelsToHex, ensureFont, contrastRatio } from "@/lib/themeDefaults";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import ThemePreview from "@/components/admin/ThemePreview";

// Fields that follow another colour until set on their own.
const FOLLOWS = {
  navActive: "heroPrimary",
  navHover: "accent",
  chatMine: "accent",
  chatMineText: "accentText",
  chatOtherText: "bodyText",
};

/** Keep only the keys the hero theme uses (older saved themes carry more). */
const toHeroTheme = (theme) =>
  Object.fromEntries(Object.keys(DEFAULT_THEME).map((k) => [k, theme?.[k] ?? DEFAULT_THEME[k]]));

/**
 * Colour picker tuned for dragging: the swatch and text update locally on
 * every input event, but the parent (preview + draft save) gets at most one
 * update per animation frame. Typed values are committed only once they are
 * a valid hex colour, so a half-typed "#1a" never reaches the theme.
 */
function ColorField({ label, value, defaultHex, onChange, resetLabel }) {
  const shown = value || defaultHex;
  const [local, setLocal] = useState(shown);
  const [text, setText] = useState(shown);
  const latest = useRef(shown);
  const frame = useRef(0);

  // Follow outside changes (restore, discard, reset), but not our own
  // frame-delayed commits, which would snap the swatch back mid-drag.
  useEffect(() => {
    if (shown !== latest.current) {
      latest.current = shown;
      setLocal(shown);
      setText(shown);
    }
  }, [shown]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const push = (hex) => {
    latest.current = hex;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      onChange(latest.current);
    });
  };

  const onPick = (e) => {
    const v = e.target.value;
    setLocal(v);
    setText(v);
    push(v);
  };

  const onType = (e) => {
    const v = e.target.value;
    setText(v);
    const hex = normalizeHex(v);
    if (hex) {
      setLocal(hex);
      push(hex);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={local}
          onChange={onPick}
          className="w-8 h-8 rounded-md border border-border bg-transparent cursor-pointer p-0"
        />
        <input
          type="text"
          value={text}
          onChange={onType}
          onBlur={() => setText(local)}
          spellCheck={false}
          maxLength={7}
          aria-invalid={!normalizeHex(text)}
          className="w-24 h-8 rounded-md border border-input bg-transparent px-2 text-xs font-mono aria-[invalid=true]:border-destructive"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!value}
          onClick={() => onChange(null)}
          title={resetLabel}
          aria-label={resetLabel}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="py-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="mt-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs" style={{ fontFamily: `"${o.value}", system-ui` }}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Route loader: the draft/published theme. */
export const prefetch = prefetchSiteTheme;

export default function AdminDesign() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const { draft, published, history, loading, saving, saveDraft, publish, discard, removeVersion } = useSiteTheme();

  const base = toHeroTheme(draft?.theme || published?.theme);
  const [theme, setTheme] = useState(base);
  const [enabled, setEnabled] = useState(false);
  const initialRef = useRef(null);
  // The preview may lag a frame behind fast edits so the controls stay smooth.
  const previewTheme = useDeferredValue(theme);

  // The site's own token colours, shown in the pickers while no override is set.
  const defaults = useMemo(() => {
    const css = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
    const hex = (v) => hslChannelsToHex(css?.getPropertyValue(v));
    return {
      heroHeading: hex("--foreground"),
      bodyText: hex("--foreground"),
      heroText: hex("--muted-foreground"),
      accent: hex("--accent"),
      accentText: hex("--accent-foreground"),
      heroPrimary: hex("--primary"),
      heroPrimaryText: hex("--primary-foreground"),
      heroCard: hex("--card"),
      heroLiveBadge: hex("--destructive"),
      heroLiveBadgeText: hex("--destructive-foreground"),
      heroOpenBadge: hex("--success"),
      heroOpenBadgeText: hex("--success-foreground"),
      pageBackground: hex("--background"),
      navActive: hex("--primary"),
      navHover: hex("--accent"),
      chatMine: hex("--accent"),
      chatMineText: hex("--accent-foreground"),
      chatOther: hex("--muted"),
      chatOtherText: hex("--foreground"),
    };
  }, []);

  // Load every font option once so the menu shows each in its own face.
  useEffect(() => {
    FONT_OPTIONS.forEach((o) => ensureFont(o.value));
  }, []);

  useEffect(() => {
    if (!enabled && !loading) {
      initialRef.current = JSON.stringify(base);
      setTheme(base);
      setEnabled(true);
    }
  }, [loading, enabled, base]);

  // Debounced draft persistence (only after the working copy is initialized
  // and the admin has actually changed something)
  useEffect(() => {
    if (!enabled || JSON.stringify(theme) === initialRef.current) return;
    const id = setTimeout(() => saveDraft(theme), 700);
    return () => clearTimeout(id);
  }, [theme, enabled, saveDraft]);

  if (loading) return null;

  const update = (patch) => setTheme((p) => ({ ...p, ...patch }));

  const onPublish = async () => {
    if (!(await askConfirm({ title: t.admin.confirm.publishTitle, description: t.admin.design.confirmPublish, confirmLabel: t.admin.confirm.publishLabel }))) return;
    try {
      await publish(theme);
      initialRef.current = JSON.stringify(theme); // published = nothing left to save
      toast.success(t.admin.design.publishedOk);
    } catch {
      toast.error(t.admin.design.failed);
    }
  };

  // Every field back to the built-in look, in the draft. It goes live only
  // when published, so visitors see nothing until then.
  const onResetAll = async () => {
    if (
      !(await askConfirm({
        title: t.admin.design.resetAllTitle,
        description: t.admin.design.resetAllConfirm,
        confirmLabel: t.admin.design.resetAll,
      }))
    )
      return;
    setTheme(toHeroTheme(DEFAULT_THEME));
    toast.success(t.admin.design.resetAllDone);
  };

  const onDiscard = async () => {
    if (!(await askConfirm({ title: t.admin.confirm.discardTitle, description: t.admin.design.discardConfirm, confirmLabel: t.admin.confirm.discardLabel, destructive: true }))) return;
    await discard();
    const reset = toHeroTheme(published?.theme);
    initialRef.current = JSON.stringify(reset); // don't immediately re-create the draft we just discarded
    setTheme(reset);
    toast.success(t.admin.design.discarded);
  };

  const onRestore = async (ver) => {
    if (!(await askConfirm({ title: t.admin.confirm.restoreTitle, description: t.admin.design.restoreConfirm, confirmLabel: t.admin.confirm.restoreLabel }))) return;
    // Restoring publishes the version again as the newest one, so it goes
    // live right away, and loads it into the editor.
    const next = toHeroTheme(ver.theme);
    try {
      await publish(next);
      initialRef.current = JSON.stringify(next);
      setTheme(next);
      toast.success(t.admin.design.restored);
    } catch {
      toast.error(t.admin.design.failed);
    }
  };

  const onDeleteVersion = async (ver, isLive) => {
    if (
      !(await askConfirm({
        title: t.admin.design.deleteVersionTitle,
        description: isLive ? t.admin.design.deleteLiveConfirm : t.admin.design.deleteVersionConfirm,
        confirmLabel: t.admin.design.deleteVersion,
        destructive: true,
      }))
    )
      return;
    try {
      await removeVersion(ver.id);
      toast.success(t.admin.design.versionDeleted);
    } catch {
      toast.error(t.admin.design.failed);
    }
  };

  const hasDraft = !!draft;
  const isDefault = JSON.stringify(theme) === JSON.stringify(toHeroTheme(DEFAULT_THEME));
  const d = t.admin.design;
  const radiusSet = typeof theme.heroCardRadius === "number";
  // An unset active tab follows the primary accent.
  const colorOf = (key) => theme[key] || (FOLLOWS[key] ? colorOf(FOLLOWS[key]) : defaults[key]);
  // Readability checks (WCAG AA for normal text is 4.5:1).
  const buttonContrast = contrastRatio(colorOf("heroPrimaryText"), colorOf("heroPrimary"));
  const accentContrast = contrastRatio(colorOf("accentText"), colorOf("accent"));
  const chatMineContrast = contrastRatio(colorOf("chatMineText"), colorOf("chatMine"));
  const chatOtherContrast = contrastRatio(colorOf("chatOtherText"), colorOf("chatOther"));
  const liveContrast = contrastRatio(colorOf("heroLiveBadgeText"), colorOf("heroLiveBadge"));
  const openContrast = contrastRatio(colorOf("heroOpenBadgeText"), colorOf("heroOpenBadge"));
  // Heading and body text sit on both the cards and the page background.
  const textOn = (surface) =>
    Math.min(
      contrastRatio(colorOf("heroHeading"), colorOf(surface)) ?? 21,
      contrastRatio(colorOf("bodyText"), colorOf(surface)) ?? 21,
      contrastRatio(colorOf("heroText"), colorOf(surface)) ?? 21,
    );
  const cardContrast = textOn("heroCard");
  const bgContrast = textOn("pageBackground");
  const textContrast = Math.min(cardContrast, bgContrast);
  // Tabs sit on the header (card surface) and the bottom bar (card surface).
  const tabContrast = Math.min(
    contrastRatio(colorOf("navActive"), colorOf("heroCard")) ?? 21,
    contrastRatio(colorOf("navHover"), colorOf("heroCard")) ?? 21,
    contrastRatio(colorOf("navActive"), colorOf("pageBackground")) ?? 21,
    contrastRatio(colorOf("navHover"), colorOf("pageBackground")) ?? 21,
  );
  const colorField = (key, label) => (
    <ColorField
      label={label}
      value={theme[key]}
      defaultHex={FOLLOWS[key] ? colorOf(FOLLOWS[key]) : defaults[key]}
      onChange={(v) => update({ [key]: v })}
      resetLabel={d.useDefault}
    />
  );
  const contrastNote = (ratio) =>
    ratio != null && ratio < 4.5 ? (
      <p className="text-[11px] text-warning">{d.lowContrast.replace("{ratio}", ratio.toFixed(1))}</p>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="admin-page-header flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5" /> {d.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{d.subtitle}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            hasDraft ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
          }`}
        >
          {hasDraft ? d.draft : d.published}
        </span>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Accordion type="multiple" defaultValue={["background", "typography", "card", "tabs", "chat", "badges"]}>
            <AccordionItem value="background">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.background}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {colorField("pageBackground", d.pageBackground)}
                <p className="text-[11px] text-muted-foreground">{d.pageBackgroundHint}</p>
                {contrastNote(bgContrast)}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="typography">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.typography}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                <SelectField label={d.fontDisplay} value={theme.fontDisplay} onChange={(v) => update({ fontDisplay: v })} options={FONT_OPTIONS} />
                <SelectField label={d.fontHeading} value={theme.fontHeading} onChange={(v) => update({ fontHeading: v })} options={FONT_OPTIONS} />
                <SelectField label={d.fontBody} value={theme.fontBody} onChange={(v) => update({ fontBody: v })} options={FONT_OPTIONS} />
                <div className="pt-2">
                  {colorField("heroHeading", d.headingColor)}
                  {colorField("bodyText", d.bodyTextColor)}
                  {colorField("heroText", d.textColor)}
                  {contrastNote(textContrast)}
                  {colorField("heroPrimary", d.primary)}
                  {colorField("heroPrimaryText", d.primaryText)}
                  {contrastNote(buttonContrast)}
                  {colorField("accent", d.accent)}
                  {colorField("accentText", d.accentText)}
                  {contrastNote(accentContrast)}
                  <p className="text-[11px] text-muted-foreground">{d.accentHint}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="card">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.card}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {colorField("heroCard", d.cardSurface)}
                {contrastNote(cardContrast)}
                <div className="pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">{d.cardRadius}</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono">{radiusSet ? `${theme.heroCardRadius}px` : d.siteDefault}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={!radiusSet}
                        onClick={() => update({ heroCardRadius: null })}
                        title={d.useDefault}
                        aria-label={d.useDefault}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[radiusSet ? theme.heroCardRadius : 9]}
                    onValueChange={([v]) => {
                      if (v !== theme.heroCardRadius) update({ heroCardRadius: v });
                    }}
                    min={0}
                    max={28}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tabs">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.nav}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {colorField("navActive", d.navActive)}
                {colorField("navHover", d.navHover)}
                {contrastNote(tabContrast)}
                <p className="text-[11px] text-muted-foreground">{d.navHint}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="chat">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.chat}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {colorField("chatMine", d.chatMine)}
                {colorField("chatMineText", d.chatMineText)}
                {contrastNote(chatMineContrast)}
                {colorField("chatOther", d.chatOther)}
                {colorField("chatOtherText", d.chatOtherText)}
                {contrastNote(chatOtherContrast)}
                <p className="text-[11px] text-muted-foreground">{d.chatHint}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="badges">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.badges}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {colorField("heroLiveBadge", d.liveBadge)}
                {colorField("heroLiveBadgeText", d.liveBadgeText)}
                {contrastNote(liveContrast)}
                {colorField("heroOpenBadge", d.openBadge)}
                {colorField("heroOpenBadgeText", d.openBadgeText)}
                {contrastNote(openContrast)}
                <p className="text-[11px] text-muted-foreground">{d.badgesHint}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="sticky bottom-4 flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-xl p-3">
            <Button onClick={onPublish} disabled={saving} className="gap-2">
              <Check className="w-4 h-4" /> {d.publish}
            </Button>
            <Button
              onClick={onResetAll}
              variant="outline"
              disabled={saving || isDefault}
              className="gap-2"
              title={d.resetAllHint}
            >
              <Eraser className="w-4 h-4" /> {d.resetAll}
            </Button>
            <Button onClick={onDiscard} variant="outline" disabled={saving || !hasDraft} className="gap-2">
              <Trash2 className="w-4 h-4" /> {d.discard}
            </Button>
            {saving && <span className="text-xs text-muted-foreground">{d.saving}</span>}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> {d.preview}
            </div>
            <ThemePreview theme={previewTheme} />

            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-semibold mb-2">{d.history}</div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">{d.noHistory}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((ver, i) => (
                    <div key={ver.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex gap-0.5 shrink-0">
                          {["pageBackground", "heroCard", "heroPrimary", "heroHeading"].map((k) => (
                            <span
                              key={k}
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ background: ver.theme?.[k] || defaults[k] }}
                            />
                          ))}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {d.version}{" "}
                          {new Date(ver.created_date).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                          {ver.theme?.fontDisplay || DEFAULT_THEME.fontDisplay}
                        </span>
                        {i === 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success shrink-0">
                            {d.live}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        {i !== 0 && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={saving} onClick={() => onRestore(ver)}>
                            <RotateCcw className="w-3.5 h-3.5" /> {d.restore}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={saving}
                          onClick={() => onDeleteVersion(ver, i === 0)}
                          title={d.deleteVersion}
                          aria-label={d.deleteVersion}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
