import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, Monitor, RotateCcw, Save, Search, Smartphone, Sparkles, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuctionList } from "@/lib/queries/auctions";
import { FeaturedHeroCard, pickHeroFeatured } from "@/components/home/SiteHero";

const NONE = [];
// Soft limits: past these the headline wraps to 3+ lines on desktop and the
// subtitle is cut off on mobile (it shows 2 lines there).
const TITLE_MAX = 60;
const SUB_MAX = 160;

const loadSection = async () => (await base44.entities.Content.list(50)) || [];

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(adminKeys.hero(), loadSection));

function Counter({ value, max }) {
  const n = value.trim().length;
  return (
    <span className={cn("text-[11px] tabular-nums", n > max ? "text-warning font-semibold" : "text-muted-foreground")}>
      {n}/{max}
    </span>
  );
}

function Field({ id, label, hint, value, max, onReset, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          {value ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Use default
            </button>
          ) : null}
          <Counter value={value} max={max} />
        </div>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DesktopPreview({ title, subtitle, t, featured, auctionsLoading }) {
  return (
    <div className="grid flex-1 content-center gap-5 rounded-xl border border-border bg-background p-5 sm:p-6 xl:grid-cols-2 xl:items-center">
      <div className="space-y-3.5 min-w-0">
        <h2 className="font-display text-2xl sm:text-[2rem] font-extrabold leading-[1.1] tracking-tight text-foreground break-words">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{subtitle}</p>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            {t.auth.register} <ArrowRight className="w-3.5 h-3.5" />
          </span>
          <span className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium">
            {t.auth.login}
          </span>
        </div>
      </div>
      {/* The same card and auction the homepage features (pickHeroFeatured). */}
      <div className="min-w-0">
        {featured ? (
          <FeaturedHeroCard auction={featured} preview />
        ) : (
          <div className="grid h-56 place-items-center rounded-xl border border-dashed border-border bg-card px-4 text-center text-xs text-muted-foreground">
            {auctionsLoading ? "" : "No auction to feature yet. The homepage shows a card here once an auction exists."}
          </div>
        )}
      </div>
    </div>
  );
}

function MobilePreview({ title, subtitle }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/40 py-6">
      <div className="w-[300px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-background shadow-xl">
        <div className="border-b border-border/60 px-3.5 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-primary/70 bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-foreground">{title}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold">Search…</span>
          </div>
        </div>
        <div className="space-y-2 p-3.5">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHero() {
  const { t } = useI18n();
  const { data: items = NONE, isPending: loading, refresh: load } = useAdminData(adminKeys.hero(), loadSection);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState("desktop");
  const [titleEn, setTitleEn] = useState("");
  const [subEn, setSubEn] = useState("");
  // The auction the homepage hero is featuring right now, for the preview.
  const { data: auctions = NONE, isPending: auctionsLoading } = useAuctionList(null, 50);
  const featured = useMemo(() => pickHeroFeatured(auctions), [auctions]);

  const saved = useMemo(() => {
    const get = (key) => items.find((c) => c.key === key);
    return { title: get("hero_title")?.value_en || "", subtitle: get("hero_subtitle")?.value_en || "" };
  }, [items]);

  // Seed the form from the saved copy whenever it (re)loads.
  useEffect(() => {
    setTitleEn(saved.title);
    setSubEn(saved.subtitle);
  }, [saved]);

  const dirty = titleEn.trim() !== saved.title.trim() || subEn.trim() !== saved.subtitle.trim();
  // Empty fields fall back to the built-in copy on the site (see heroCopy).
  const shownTitle = titleEn.trim() || t.home.heroTitle;
  const shownSub = subEn.trim() || t.home.heroSubtitle;

  const upsert = (key, label, valueEn, existing) => {
    const payload = { key, label, value_en: valueEn };
    if (existing) return base44.entities.Content.update(existing.id, payload);
    return base44.entities.Content.create(payload);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const titleItem = items.find((c) => c.key === "hero_title");
      const subItem = items.find((c) => c.key === "hero_subtitle");
      await Promise.all([
        upsert("hero_title", "Hero title", titleEn.trim(), titleItem),
        upsert("hero_subtitle", "Hero subtitle", subEn.trim(), subItem),
      ]);
      toast.success(t.admin.hero.saved);
      load();
    } catch (err) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setTitleEn(saved.title);
    setSubEn(saved.subtitle);
  };

  if (loading) return null;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="admin-page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t.admin.hero.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.hero.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              dirty ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-warning" : "bg-success")} />
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <Button type="button" variant="outline" onClick={discard} disabled={!dirty || saving}>
            Discard
          </Button>
          <Button type="submit" disabled={!dirty || saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? t.admin.saving : t.admin.save}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-stretch">
        {/* Editor */}
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold leading-tight">Homepage hero</h2>
              <p className="text-xs text-muted-foreground">Shown at the top of the homepage on desktop and mobile.</p>
            </div>
          </div>

          <Field
            id="hero-title"
            label={t.admin.hero.titleLabel}
            value={titleEn}
            max={TITLE_MAX}
            onReset={() => setTitleEn("")}
            hint="Short and punchy. Leave empty to use the default headline."
          >
            <Input
              id="hero-title"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder={t.home.heroTitle}
            />
          </Field>

          <Field
            id="hero-subtitle"
            label={t.admin.hero.subtitleLabel}
            value={subEn}
            max={SUB_MAX}
            onReset={() => setSubEn("")}
            hint="One or two sentences. Mobile shows the first two lines."
          >
            <Textarea
              id="hero-subtitle"
              rows={4}
              value={subEn}
              onChange={(e) => setSubEn(e.target.value)}
              placeholder={t.home.heroSubtitle}
              className="resize-none"
            />
          </Field>

          <p className="mt-auto rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            On mobile, signed-in visitors see “Welcome {"{name}"}” in place of the headline; the subtitle stays.
          </p>
        </section>

        {/* Preview */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Eye className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-semibold leading-tight">{t.admin.hero.previewLabel}</h2>
                <p className="text-xs text-muted-foreground">Updates as you type. Not saved until you press Save.</p>
              </div>
            </div>
            <div role="tablist" aria-label="Preview device" className="inline-flex rounded-lg border border-border bg-background p-0.5">
              {[
                { id: "desktop", icon: Monitor, label: "Desktop" },
                { id: "mobile", icon: Smartphone, label: "Mobile" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={device === id}
                  onClick={() => setDevice(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    device === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            {device === "desktop" ? (
              <DesktopPreview title={shownTitle} subtitle={shownSub} t={t} featured={featured} auctionsLoading={auctionsLoading} />
            ) : (
              <MobilePreview title={shownTitle} subtitle={shownSub} />
            )}
          </div>
        </section>
      </div>
    </form>
  );
}
