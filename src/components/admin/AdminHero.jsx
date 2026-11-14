import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, Save, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none";

export default function AdminHero() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titleEn, setTitleEn] = useState("");
  const [subEn, setSubEn] = useState("");

  const load = useCallback(() => {
    base44.entities.Content.list(50)
      .then((list) => {
        setItems(list);
        const get = (key) => list.find((c) => c.key === key);
        setTitleEn(get("hero_title")?.value_en || "");
        setSubEn(get("hero_subtitle")?.value_en || "");
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upsert = (key, label, valueEn, existing) => {
    const payload = { key, label, value_en: valueEn };
    if (existing) return base44.entities.Content.update(existing.id, payload);
    return base44.entities.Content.create(payload);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const titleItem = items.find((c) => c.key === "hero_title");
      const subItem = items.find((c) => c.key === "hero_subtitle");
      await Promise.all([
        upsert("hero_title", "Hero title", titleEn, titleItem),
        upsert("hero_subtitle", "Hero subtitle", subEn, subItem)
      ]);
      toast.success(t.admin.hero.saved);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const previewTitle = titleEn;
  const previewSub = subEn;

  if (loading) {
    return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t.admin.hero.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.hero.subtitle}</p>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {t.admin.hero.previewLabel}</p>
        <div className="native-panel relative overflow-hidden rounded-xl p-6 sm:p-9">
          <div className="relative space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-muted border border-border">
              <Sparkles className="w-3.5 h-3.5 text-warning" />
              {t.brand}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight">{previewTitle || "—"}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{previewSub || "—"}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <span className="gold-button inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold">{t.auth.register}</span>
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium">{t.auth.login}</span>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              {t.site.hero.trust.map((chip, i) => (
                <span key={i} className="text-xs text-muted-foreground">{chip}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editors */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-warning" /> {t.admin.hero.titleLabel}</h3>
          <div className="space-y-1.5">
            <Label>{t.admin.content.value}</Label>
            <textarea rows={2} className={inputCls} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">{t.admin.hero.subtitleLabel}</h3>
          <div className="space-y-1.5">
            <Label>{t.admin.content.value}</Label>
            <textarea rows={3} className={inputCls} value={subEn} onChange={(e) => setSubEn(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !titleEn} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? t.admin.saving : t.admin.save}
        </Button>
      </div>
    </div>
  );
}