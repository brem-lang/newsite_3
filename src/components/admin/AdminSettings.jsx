import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Settings as SettingsIcon, Clock, Mail, MessageCircle, Wrench, UserRound, ShieldCheck, Crown, BadgeCheck, CalendarDays, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminData, useAdminMe, useAdminCapabilities, adminSection, adminLookups, warmAdmin } from "@/lib/queries/admin";
import { adminKeys, configKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalDetailsCard from "@/components/account/profile/PersonalDetailsCard";
import ChangePassword from "@/components/account/ChangePassword";
import { toast } from "sonner";
import SelectField from "@/components/ui/select-field";

const inputCls = "h-11 w-full rounded-lg border border-accent/20 bg-background px-3 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";
const TIMEZONES = [
  "Asia/Jerusalem", "Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London",
  "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC"
];

const loadSection = async () => (await base44.entities.SiteSettings.filter({ key: "global" }).catch(() => []))?.[0] || null;

/** Route loader: the settings row and the signed-in staff profile. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(adminKeys.settings(), loadSection), adminLookups.me());

export default function AdminSettings() {
  const { t } = useI18n();
  // The signed-in staff member (admin session, separate from customers).
  const qc = useQueryClient();
  const user = useAdminMe();
  const loadAdmin = useCallback(() => qc.invalidateQueries({ queryKey: adminKeys.me() }), [qc]);
  // Capabilities: the same cached query AdminGate uses.
  const { data: caps = null } = useAdminCapabilities();
  const { data: row = null, isPending: loading, queryKey: rowKey } = useAdminData(adminKeys.settings(), loadSection);
  const setRow = (next) => qc.setQueryData(rowKey, next);
  const [form, setForm] = useState({
    site_name: "", tagline: "", timezone: "Asia/Jerusalem",
    contact_email: "", support_whatsapp: "", maintenance_mode: false, maintenance_message: "",
    active_currency: "PHP"
  });
  const [saving, setSaving] = useState(false);

  // Seed the form from the saved row whenever it (re)loads.
  useEffect(() => {
    const r = row;
    if (r) setForm({
        site_name: r.site_name || "", tagline: r.tagline || "",
        timezone: r.timezone || "Asia/Jerusalem",
        contact_email: r.contact_email || "",
        support_whatsapp: r.support_whatsapp || "",
        maintenance_mode: !!r.maintenance_mode,
        maintenance_message: r.maintenance_message || "",
        active_currency: "PHP"
      });
  }, [row]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (row) {
        await base44.entities.SiteSettings.update(row.id, form);
      } else {
        const created = await base44.entities.SiteSettings.create({ key: "global", ...form });
        setRow(created || null);
      }
      qc.invalidateQueries({ queryKey: rowKey });
      qc.invalidateQueries({ queryKey: configKeys.settings() });
      toast.success(t.admin.settings.saved);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const Card = ({ icon: Icon, title, subtitle, children }) => (
    <section className="native-panel rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.full_name || user?.email || "—";
  const initials = fullName.split(" ").filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "A";
  const joined = user?.created_date
    ? new Date(user.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const roleLabel = useMemo(() => {
    if (caps?.is_super || user?.is_super) return t.admin.settings.superAdmin;
    return caps?.role_name || caps?.role || t.admin.settings.adminRole;
  }, [caps, user, t]);

  if (loading) return null;

  return (
    <div className="space-y-5 pb-6">
      <header className="native-panel relative overflow-hidden rounded-xl p-4 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="flex items-center gap-4">
          <div className="gold-button grid h-16 w-16 shrink-0 place-items-center rounded-xl font-display text-xl font-black sm:h-20 sm:w-20 sm:text-2xl">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{fullName}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                {caps?.is_super || user?.is_super ? <Crown className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}{roleLabel}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-success"><BadgeCheck className="h-3 w-3" />{t.admin.settings.secureAccess}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-accent"><CalendarDays className="h-3 w-3" />{t.admin.settings.memberSince} {joined}</span>
            </div>
          </div>
        </div>
      </header>

      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight">{t.admin.settings.screenTitle}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.settings.screenSubtitle}</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-accent/20 bg-card p-1">
          <TabsTrigger value="profile" className="min-h-11 gap-1.5 data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-none"><UserRound className="h-4 w-4" />{t.admin.settings.profileTab}</TabsTrigger>
          <TabsTrigger value="security" className="min-h-11 gap-1.5 data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-none"><ShieldCheck className="h-4 w-4" />{t.admin.settings.securityTab}</TabsTrigger>
          <TabsTrigger value="general" className="min-h-11 gap-1.5 data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-none"><SettingsIcon className="h-4 w-4" />{t.admin.settings.generalTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <div className="native-panel rounded-xl p-1 sm:p-2 [&>div]:border-accent/20 [&>div]:bg-transparent [&>div]:shadow-none">
            <PersonalDetailsCard user={user} onSaved={loadAdmin} />
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <Card icon={ShieldCheck} title={t.admin.settings.securityTitle} subtitle={t.admin.settings.securitySubtitle}>
            <div className="rounded-xl border border-accent/20 bg-background/60 p-3 sm:p-4 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
              <ChangePassword user={user} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-0 space-y-4">
      <Card icon={SettingsIcon} title={t.admin.settings.title} subtitle={t.admin.settings.subtitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.admin.settings.siteName}</Label>
            <Input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} placeholder={t.brand} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.settings.tagline}</Label>
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder={t.tagline} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.settings.contactEmail}</Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} type="email" placeholder="support@example.com" className="h-11 border-accent/20 bg-background ps-9 focus-visible:ring-accent/30" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.settings.supportWhatsapp}</Label>
            <div className="relative">
              <MessageCircle className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input value={form.support_whatsapp} onChange={(e) => set("support_whatsapp", e.target.value)} type="tel" inputMode="tel" placeholder="+63 917 123 4567" className="h-11 border-accent/20 bg-background ps-9 focus-visible:ring-accent/30" />
            </div>
          </div>
          <p className="sm:col-span-2 -mt-2 text-xs text-muted-foreground">{t.admin.settings.supportContactHint}</p>
          <div className="space-y-1.5">
            <Label>{t.admin.settings.timezone}</Label>
            <div className="relative">
              <Clock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <SelectField value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls + " ps-9"}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </SelectField>
            </div>
          </div>
        </div>
      </Card>

      <Card icon={Wrench} title={t.admin.settings.maintenance} subtitle={t.admin.settings.maintenanceHint}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label>{t.admin.settings.maintenance}</Label>
            <p className="text-xs text-muted-foreground">{t.admin.settings.maintenanceStatus}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={form.maintenance_mode} onCheckedChange={(v) => set("maintenance_mode", v)} />
            <span className={form.maintenance_mode ? "text-warning font-semibold text-xs" : "text-muted-foreground text-xs"}>
              {form.maintenance_mode ? t.admin.settings.on : t.admin.settings.off}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t.admin.settings.maintenanceMsg}</Label>
          <textarea rows={3} value={form.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder={t.admin.settings.maintenancePlaceholder} />
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex justify-end rounded-xl border border-primary/20 bg-background/90 p-2 shadow-xl backdrop-blur-xl">
        <Button onClick={save} disabled={saving} className="gold-button h-11 w-full gap-2 sm:w-auto sm:min-w-44">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? t.admin.saving : t.admin.settings.save}
        </Button>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}