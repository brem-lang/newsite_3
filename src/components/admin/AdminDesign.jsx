import React, { useEffect, useState } from "react";
import { Palette, Check, RotateCcw, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { useSiteTheme } from "@/lib/useSiteTheme";
import { DEFAULT_THEME, FONT_OPTIONS } from "@/lib/themeDefaults";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import ThemePreview from "@/components/admin/ThemePreview";

function ColorField({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-border bg-transparent cursor-pointer p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 h-8 rounded-md border border-input bg-transparent px-2 text-xs font-mono"
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="py-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AdminDesign() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const { draft, published, history, loading, saving, saveDraft, publish, discard, restore } = useSiteTheme();

  const base = draft?.theme || published?.theme || DEFAULT_THEME;
  const [theme, setTheme] = useState(base);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!enabled && !loading) {
      setTheme(base);
      setEnabled(true);
    }
  }, [loading, enabled, base]);

  // Debounced draft persistence (only after the working copy is initialized)
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => saveDraft(theme), 700);
    return () => clearTimeout(id);
  }, [theme, enabled, saveDraft]);

  if (loading) {
    return (
      <div className="py-20 grid place-items-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const update = (patch) => setTheme((p) => ({ ...p, ...patch }));
  const updateComp = (key, value) => setTheme((p) => ({ ...p, components: { ...p.components, [key]: value } }));
  const updateSection = (section, key, value) =>
    setTheme((p) => ({ ...p, sections: { ...p.sections, [section]: { ...p.sections?.[section], [key]: value } } }));

  const onPublish = async () => {
    if (!(await askConfirm({ title: t.admin.confirm.publishTitle, description: t.admin.design.confirmPublish, confirmLabel: t.admin.confirm.publishLabel }))) return;
    await publish(theme);
    toast.success(t.admin.design.publishedOk);
  };

  const onDiscard = async () => {
    if (!(await askConfirm({ title: t.admin.confirm.discardTitle, description: t.admin.design.discardConfirm, confirmLabel: t.admin.confirm.discardLabel, destructive: true }))) return;
    await discard();
    setTheme(published?.theme || DEFAULT_THEME);
    toast.success(t.admin.design.discarded);
  };

  const onRestore = async (ver) => {
    if (!(await askConfirm({ title: t.admin.confirm.restoreTitle, description: t.admin.design.restoreConfirm, confirmLabel: t.admin.confirm.restoreLabel }))) return;
    await restore(ver.theme);
    setTheme(ver.theme);
    toast.success(t.admin.design.restored);
  };

  const hasDraft = !!draft;
  const d = t.admin.design;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
          <Accordion type="multiple" defaultValue={["colors", "typography", "components", "sections"]}>
            <AccordionItem value="colors">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.colors}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                <ColorField label={d.bg} value={theme.background} onChange={(v) => update({ background: v })} />
                <ColorField label={d.card} value={theme.card} onChange={(v) => update({ card: v })} />
                <ColorField label={d.fg} value={theme.foreground} onChange={(v) => update({ foreground: v })} />
                <ColorField label={d.primary} value={theme.primary} onChange={(v) => update({ primary: v })} />
                <ColorField label={d.primaryFg} value={theme.primaryForeground} onChange={(v) => update({ primaryForeground: v })} />
                <ColorField label={d.neonLime} value={theme.neonLime} onChange={(v) => update({ neonLime: v })} />
                <ColorField label={d.neonPink} value={theme.neonPink} onChange={(v) => update({ neonPink: v })} />
                <ColorField label={d.neonViolet} value={theme.neonViolet} onChange={(v) => update({ neonViolet: v })} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="typography">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.typography}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                <SelectField label={d.fontHeading} value={theme.fontHeading} onChange={(v) => update({ fontHeading: v })} options={FONT_OPTIONS} />
                <SelectField label={d.fontBody} value={theme.fontBody} onChange={(v) => update({ fontBody: v })} options={FONT_OPTIONS} />
                <SelectField label={d.fontDisplay} value={theme.fontDisplay} onChange={(v) => update({ fontDisplay: v })} options={FONT_OPTIONS} />
                <div className="pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{d.radius}</Label>
                    <span className="text-xs font-mono">{theme.radius}px</span>
                  </div>
                  <Slider value={[theme.radius]} onValueChange={([v]) => update({ radius: v })} min={0} max={24} step={1} className="mt-2" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="components">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.components}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                <SelectField
                  label={d.btnVariant}
                  value={theme.components?.buttonVariant || "solid"}
                  onChange={(v) => updateComp("buttonVariant", v)}
                  options={[
                    { value: "solid", label: d.btnSolid },
                    { value: "outline", label: d.btnOutline },
                    { value: "ghost", label: d.btnGhost },
                  ]}
                />
                <SelectField
                  label={d.cardBorder}
                  value={theme.components?.cardBorder || "subtle"}
                  onChange={(v) => updateComp("cardBorder", v)}
                  options={[
                    { value: "subtle", label: d.borderSubtle },
                    { value: "glow", label: d.borderGlow },
                    { value: "none", label: d.borderNone },
                  ]}
                />
                <SelectField
                  label={d.badgeStyle}
                  value={theme.components?.badgeStyle || "pill"}
                  onChange={(v) => updateComp("badgeStyle", v)}
                  options={[
                    { value: "pill", label: d.badgePill },
                    { value: "block", label: d.badgeBlock },
                  ]}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sections">
              <AccordionTrigger className="text-sm font-semibold">{d.tabs.sections}</AccordionTrigger>
              <AccordionContent className="space-y-1">
                <SelectField
                  label={d.heroAccent}
                  value={theme.sections?.hero?.accent || "lime"}
                  onChange={(v) => updateSection("hero", "accent", v)}
                  options={[
                    { value: "lime", label: d.accentLime },
                    { value: "pink", label: d.accentPink },
                    { value: "violet", label: d.accentViolet },
                  ]}
                />
                <SelectField
                  label={d.footerTone}
                  value={theme.sections?.footer?.tone || "dark"}
                  onChange={(v) => updateSection("footer", "tone", v)}
                  options={[
                    { value: "dark", label: d.toneDark },
                    { value: "light", label: d.toneLight },
                  ]}
                />
                <div className="pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{d.cardDensity}</Label>
                    <span className="text-xs font-mono">{theme.sections?.card?.radius ?? 16}px</span>
                  </div>
                  <Slider
                    value={[theme.sections?.card?.radius ?? 16]}
                    onValueChange={([v]) => updateSection("card", "radius", v)}
                    min={0}
                    max={28}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="sticky bottom-4 flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-xl p-3">
            <Button onClick={onPublish} disabled={saving} className="gap-2">
              <Check className="w-4 h-4" /> {d.publish}
            </Button>
            <Button onClick={onDiscard} variant="outline" disabled={saving || !hasDraft} className="gap-2">
              <Trash2 className="w-4 h-4" /> {d.discard}
            </Button>
            {saving && <span className="text-xs text-muted-foreground">{d.saving}</span>}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> {d.preview}
            </div>
            <ThemePreview theme={theme} />

            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-semibold mb-2">{d.history}</div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">{d.noHistory}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((ver) => (
                    <div key={ver.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex gap-0.5">
                          {["neonLime", "neonPink", "neonViolet", "primary"].map((k) => (
                            <span key={k} className="w-3 h-3 rounded-full border border-border" style={{ background: ver.theme?.[k] || "#000" }} />
                          ))}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {d.version} {new Date(ver.created_date).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onRestore(ver)}>
                        <RotateCcw className="w-3.5 h-3.5" /> {d.restore}
                      </Button>
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