import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ChevronRight,
  CircleHelp,
  FileText,
  Gavel,
  Info,
  MessageCircleQuestion,
  KeyRound,
  LogOut,
  Pencil,
  ShieldCheck,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { usePublishedPages } from "@/lib/queries/config";
import { cn } from "@/lib/utils";
import ProfileSection from "@/components/account/profile/ProfileSection";
import ChangePassword from "@/components/account/ChangePassword";
import SecuritySettings from "@/components/account/SecuritySettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";

const noScroll = "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]";

export default function MobileAccount({ user, stats, onRefresh, onLogout }) {
  const { t, dir } = useI18n();
  // About / FAQ rows appear only once published in admin → Pages.
  const { pages } = usePublishedPages();
  const aboutPage = pages.get("about");
  const faqPage = pages.get("faq");
  const [pwOpen, setPwOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const L = (copy) => (copy.en);
  const arrow = "";
  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.full_name ||
    user?.email ||
    t.account.title;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
  const activeCount = stats?.ongoing || 0;

  return (
    <div className="fixed inset-x-0 top-0 z-10 flex flex-col overflow-hidden bg-background" style={{ bottom: "var(--app-tabbar-h)" }} dir={dir}>
      <PullToRefresh
        onRefresh={onRefresh}
        className={cn("flex-1 min-h-0 overscroll-contain", noScroll)}
        innerClassName="min-h-full pb-6"
      >
        <header className="relative px-gutter pt-safe">
          <div className="h-14 flex items-center justify-center">
            <h1 className="font-display text-[17px] font-extrabold text-foreground">
              {"Personal profile"}
            </h1>
          </div>

          <div className="flex flex-col items-center pb-4">
            <div className="relative">
              <div className="grid h-[76px] w-[76px] place-items-center rounded-full border-[3px] border-primary bg-secondary text-2xl font-extrabold text-primary shadow-[0_0_28px_hsl(var(--primary)/0.24)]">
                {initials}
              </div>
              <span className="absolute bottom-0 end-0 grid h-6 w-6 place-items-center rounded-full border-[3px] border-background bg-accent text-accent-foreground">
                <BadgeCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <h2 className="max-w-[280px] truncate text-[17px] font-extrabold text-foreground">{name}</h2>
              {user?.verification_status === "verified" && <BadgeCheck className="h-4 w-4 shrink-0 fill-accent text-background" />}
            </div>
            <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-muted-foreground">{user?.email || ""}</p>
          </div>
        </header>

        <main className="px-gutter space-y-3">
          <section className="native-panel overflow-hidden rounded-xl" aria-label={"Account activity"}>
            <div className="grid grid-cols-3 divide-x divide-border">
              <ProfileStat icon={Gavel} value={stats?.total || 0} label={t.account.stats.total} />
              <ProfileStat icon={Trophy} value={stats?.won || 0} label={t.account.stats.won} />
              <ProfileStat icon={BadgeCheck} value={activeCount} label={t.account.stats.ongoing} />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_36px_-28px_hsl(var(--accent)/0.7)]">
            <ProfileMenuRow icon={UserRound} label={"Account information"} onClick={() => setEditOpen(true)} arrow={arrow} />
            <ProfileMenuRow icon={WalletCards} label={"Wallet"} to="/wallet" arrow={arrow} accent />
            <ProfileMenuRow icon={Gavel} label={t.account.myBids} to="/auctions" search={{ tab: "mine" }} arrow={arrow} />
            <ProfileMenuRow icon={ShieldCheck} label={t.account.profile.securitySettings} onClick={() => setSecurityOpen(true)} arrow={arrow} />
            <ProfileMenuRow icon={KeyRound} label={t.account.profile.changePassword} onClick={() => setPwOpen(true)} arrow={arrow} />
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <ProfileMenuRow icon={FileText} label={t.site.footer.terms} to="/terms" arrow={arrow} />
            <ProfileMenuRow icon={ShieldCheck} label={t.site.footer.privacy} to="/privacy" arrow={arrow} />
            {aboutPage ? <ProfileMenuRow icon={Info} label={aboutPage.title_en || t.site.nav.about} to="/about" arrow={arrow} /> : null}
            {faqPage ? <ProfileMenuRow icon={MessageCircleQuestion} label={faqPage.title_en || "FAQ"} to="/faq" arrow={arrow} /> : null}
            <ProfileMenuRow icon={CircleHelp} label={"Help & support"} to="/support" arrow={arrow} />
            <ProfileMenuRow icon={LogOut} label={t.common.logout} onClick={onLogout} arrow={arrow} destructive />
          </section>
        </main>
      </PullToRefresh>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" />{t.account.profile.editProfile}</DialogTitle>
          </DialogHeader>
          <ProfileSection user={user} compact />
        </DialogContent>
      </Dialog>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />{t.account.profile.changePassword}</DialogTitle>
          </DialogHeader>
          <ChangePassword user={user} embedded />
        </DialogContent>
      </Dialog>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t.account.profile.securitySettings}</DialogTitle>
          </DialogHeader>
          <SecuritySettings user={user} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileStat({ icon: Icon, value, label }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-2 py-3 text-center">
      <Icon className="mb-1 h-3.5 w-3.5 text-primary" />
      <strong className="text-[17px] font-extrabold leading-none text-foreground tabular-nums">{value}</strong>
      <span className="mt-1 w-full truncate text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ProfileMenuRow({ icon: Icon, label, to, search, onClick, arrow, accent = false, destructive = false }) {
  const content = (
    <>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", destructive ? "bg-destructive/12 text-destructive" : accent ? "bg-accent/12 text-accent" : "bg-secondary text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-start text-[13px] font-bold", destructive ? "text-destructive" : "text-foreground")}>{label}</span>
      <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/55", arrow)} />
    </>
  );
  const className = "flex min-h-12 w-full items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0 transition active:bg-secondary/70";

  if (to) return <Link to={to} search={search} className={className}>{content}</Link>;
  return <Button type="button" variant="ghost" onClick={onClick} className={cn(className, "h-auto rounded-none justify-start hover:bg-secondary/70")}>{content}</Button>;
}