import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft, ChevronRight, ChevronDown, CircleHelp, Mail, MessageCircle, Wallet, Gavel, Trophy,
  Send, LifeBuoy, LogIn, Loader2, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { useSiteSettings, pickGlobalSettings } from "@/lib/queries/config";
import { useMyTickets, useCreateTicket, supportErrorMessage } from "@/lib/queries/support";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectField from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

const CATEGORIES = ["general", "payment", "dispute", "technical", "other"];
const STATUS_CLS = {
  open: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  resolved: "bg-info/10 text-info",
  closed: "bg-secondary text-muted-foreground",
};
const EMPTY_FORM = { category: "general", subject: "", body: "" };

const FAQ = [
  {
    icon: Wallet,
    q: "How do I add money to my wallet?",
    a: "Go to Wallet → Deposit, choose an amount, and complete the payment. Your balance updates automatically.",
  },
  {
    icon: Gavel,
    q: "How does bidding work?",
    a: "Each auction shows its entry fee and bid increment. Joining gives you a quota of bids based on those values. Place bids until the auction closes.",
  },
  {
    icon: Trophy,
    q: "I won an auction. What is next?",
    a: "Open the closed auction, view the winner details, and follow the payment instructions to claim your item.",
  },
];

/** wa.me link from a stored number ("+63 917 …" → https://wa.me/63917…), or null. */
const whatsappHref = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

const card = "rounded-2xl bg-card border border-border shadow-sm";

/**
 * Help & support. Phones get the app-style screen (back bar, stacked cards);
 * larger screens get the site header/footer and the same max-w-6xl column as
 * the other site pages, with the form and tickets beside the contact options.
 */
export default function SupportPage() {
  const { dir, t } = useI18n();
  const s = t.supportCenter;
  const isMobile = useIsMobileView();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const userId = isAuthenticated ? user?.id : null;

  const { data: settingsRows } = useSiteSettings();
  const settings = pickGlobalSettings(settingsRows);
  const email = settings?.contact_email?.trim() || "";
  const whatsapp = whatsappHref(settings?.support_whatsapp);

  const { data: tickets = [], isPending: ticketsLoading } = useMyTickets(userId);
  const createTicket = useCreateTicket(userId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [openId, setOpenId] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // /support#tickets (account menu): the list only renders once the session
  // and tickets are known, so scroll to it then.
  useEffect(() => {
    if (ticketsLoading || typeof window === "undefined" || window.location.hash !== "#tickets") return;
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ticketsLoading, userId, isMobile]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return toast.error(s.required);
    try {
      const row = await createTicket.mutateAsync(form);
      setForm(EMPTY_FORM);
      if (row?.id) setOpenId(row.id);
      toast.success(s.sent);
    } catch (err) {
      toast.error(supportErrorMessage(err, t));
    }
  };

  const contact = (
    <ContactCard
      s={s}
      mobile={isMobile}
      loading={isLoadingAuth}
      signedIn={!!userId}
      form={form}
      set={set}
      onSubmit={submit}
      sending={createTicket.isPending}
    />
  );
  const ticketList = userId ? (
    <TicketList
      s={s}
      mobile={isMobile}
      tickets={tickets}
      loading={ticketsLoading}
      openId={openId}
      onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
    />
  ) : null;
  const channels = <Channels s={s} mobile={isMobile} email={email} whatsapp={whatsapp} />;

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col" dir={dir}>
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="h-14 px-2 flex items-center gap-1">
            <Link
              to="/account"
              aria-label={"Back"}
              className="w-10 h-10 rounded-xl grid place-items-center text-foreground active:scale-95 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="flex-1 text-center font-display font-extrabold text-[15px] text-foreground truncate px-1">
              {s.title}
            </h1>
            <div className="w-10" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 px-4 pt-3 space-y-3 pb-[calc(32px+env(safe-area-inset-bottom))]">
          <div className="rounded-xl bg-card border border-primary/30 shadow-[0_14px_34px_-26px_hsl(var(--primary)/0.45)] p-4">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
              <CircleHelp className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{s.intro}</p>
          </div>
          {contact}
          {ticketList}
          {channels}
          <FaqList mobile />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link to="/terms" className="h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition">
              {"Terms"}
            </Link>
            <Link to="/privacy" className="h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition">
              {"Privacy"}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-5">
            <CircleHelp className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{s.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{s.intro}</p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="space-y-8 min-w-0">
            {contact}
            {ticketList}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            {channels}
            <FaqList />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ContactCard({ s, mobile, loading, signedIn, form, set, onSubmit, sending }) {
  return (
    <section className={cn(mobile ? "rounded-xl bg-card border border-border p-4" : `${card} p-6`)}>
      <div className="flex items-start gap-3">
        <span className={cn("grid shrink-0 place-items-center rounded-xl bg-primary/10 text-primary", mobile ? "h-8 w-8" : "h-10 w-10")}>
          <LifeBuoy className={mobile ? "w-4 h-4" : "w-5 h-5"} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className={cn("font-display font-bold text-foreground", mobile ? "text-[14px]" : "text-lg")}>{s.contactTitle}</h2>
          {!mobile && <p className="text-sm text-muted-foreground mt-0.5">{signedIn ? s.formHint : s.signInHint}</p>}
        </div>
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !signedIn ? (
        <div className={cn("space-y-3", mobile ? "mt-3" : "mt-5")}>
          {mobile && <p className="text-[12px] text-muted-foreground leading-relaxed">{s.signInHint}</p>}
          <Button asChild size={mobile ? "sm" : "default"} className="gap-2">
            <Link to="/login" search={{ returnTo: "/support" }}><LogIn className="w-4 h-4" />{s.signIn}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className={cn("grid gap-4", mobile ? "mt-3" : "mt-6 sm:grid-cols-2")}>
          <div className="space-y-1.5">
            <Label htmlFor="support-category">{s.category}</Label>
            <SelectField id="support-category" value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full">
              {CATEGORIES.map((c) => <option key={c} value={c}>{s.categories[c]}</option>)}
            </SelectField>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-subject">{s.subject}</Label>
            <Input id="support-subject" value={form.subject} maxLength={150} onChange={(e) => set("subject", e.target.value)} placeholder={s.subjectPlaceholder} />
          </div>
          <div className={cn("space-y-1.5", !mobile && "sm:col-span-2")}>
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="support-body">{s.message}</Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">{form.body.length}/5000</span>
            </div>
            <Textarea id="support-body" rows={mobile ? 5 : 6} value={form.body} maxLength={5000} onChange={(e) => set("body", e.target.value)} placeholder={s.messagePlaceholder} />
          </div>
          <div className={cn(!mobile && "sm:col-span-2 flex justify-end")}>
            <Button type="submit" disabled={sending} className={cn("gap-2", mobile && "w-full")}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {s.send}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function TicketList({ s, mobile, tickets, loading, openId, onToggle }) {
  return (
    <section id="tickets" className="scroll-mt-24">
      <div className={cn("flex items-baseline justify-between gap-2", mobile ? "px-1 mb-2" : "mb-3")}>
        <h2 className={cn("font-display font-bold text-foreground", mobile ? "text-[14px]" : "text-lg")}>{s.myTickets}</h2>
        {tickets.length > 0 && <span className="text-xs text-muted-foreground">{tickets.length}</span>}
      </div>
      {loading ? (
        <div className={cn(mobile ? "rounded-xl bg-card border border-border" : card, "py-8 grid place-items-center text-muted-foreground")}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className={cn("border border-dashed border-border text-center text-muted-foreground", mobile ? "rounded-xl p-6 text-[12px]" : "rounded-2xl p-10 text-sm")}>
          <Inbox className="w-6 h-6 mx-auto mb-2 opacity-40" aria-hidden="true" />
          {s.noTickets}
        </div>
      ) : (
        <div className={cn(mobile ? "rounded-xl bg-card border border-border" : card, "overflow-hidden divide-y divide-border")}>
          {tickets.map((tk) => {
            const open = openId === tk.id;
            return (
              <div key={tk.id}>
                <button
                  type="button"
                  onClick={() => onToggle(tk.id)}
                  aria-expanded={open}
                  className={cn("w-full flex items-center gap-3 text-start transition hover:bg-secondary/40 active:bg-secondary/70", mobile ? "px-4 py-3" : "px-5 py-4")}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-bold text-foreground truncate", mobile ? "text-[13px]" : "text-sm")}>{tk.subject}</p>
                    <p className={cn("text-muted-foreground truncate", mobile ? "text-[11px]" : "text-xs mt-0.5")}>
                      {s.categories[tk.category] || tk.category} · {new Date(tk.created_date).toLocaleDateString("en-GB")}
                      {tk.staff_reply ? ` · ${s.replied}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_CLS[tk.status] || STATUS_CLS.open)}>
                    {s.status[tk.status] || tk.status}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className={cn("space-y-3", mobile ? "px-4 pb-4" : "px-5 pb-5")}>
                    <Message label={`${s.you} · ${new Date(tk.created_date).toLocaleString("en-GB")}`} text={tk.body} mobile={mobile} />
                    {tk.staff_reply ? (
                      <Message
                        label={`${s.teamReply}${tk.replied_at ? ` · ${new Date(tk.replied_at).toLocaleString("en-GB")}` : ""}`}
                        text={tk.staff_reply}
                        mobile={mobile}
                        reply
                      />
                    ) : (
                      <p className="text-[12px] text-muted-foreground">{tk.status === "closed" ? s.closedNoReply : s.awaitingReply}</p>
                    )}
                    {(tk.status === "resolved" || tk.status === "closed" || tk.staff_reply) && (
                      <p className="text-[11px] text-muted-foreground">{s.followUpHint}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Message({ label, text, mobile, reply = false }) {
  return (
    <div className={cn("rounded-lg border p-3", reply ? "bg-primary/5 border-primary/25" : "bg-muted/40 border-border", !mobile && "p-4")}>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={cn("whitespace-pre-line text-foreground", mobile ? "text-[13px]" : "text-sm leading-relaxed")}>{text}</p>
    </div>
  );
}

function Channels({ s, mobile, email, whatsapp }) {
  if (!email && !whatsapp) return null;
  const row = cn("flex items-center gap-3 transition hover:bg-secondary/40 active:bg-secondary/70", mobile ? "px-4 py-3.5" : "px-5 py-4");
  return (
    <section className={cn(mobile ? "rounded-xl bg-card border border-border" : card, "overflow-hidden")}>
      {!mobile && <h2 className="px-5 pt-5 pb-1 font-display font-bold text-foreground">{s.otherWays}</h2>}
      <div className="divide-y divide-border">
        {email && (
          <a href={`mailto:${email}`} className={row}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><Mail className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{s.emailUs}</p>
              <p className="text-[11px] text-muted-foreground truncate">{email}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/55" />
          </a>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className={row}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success"><MessageCircle className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{"WhatsApp"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.chatWithUs}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/55" />
          </a>
        )}
      </div>
    </section>
  );
}

function FaqList({ mobile = false }) {
  return (
    <div className={mobile ? "space-y-2.5" : "space-y-3"}>
      {FAQ.map((item, i) => (
        <section key={i} className={cn(mobile ? "rounded-xl bg-card border border-border shadow-sm p-4" : `${card} p-5`)}>
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-[13px] text-foreground leading-snug">{item.q}</h3>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
