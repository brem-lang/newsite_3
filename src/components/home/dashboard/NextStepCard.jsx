import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Gavel, Hourglass, Plus, Ticket } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/homeHighlights";
import { cn } from "@/lib/utils";

/**
 * One personal prompt: the most useful thing this user can do right now
 * (bid in a live auction they're in, wait for their seat to start, add funds
 * for a first seat, or take a seat their balance already covers). Built by
 * homeHighlights(); renders nothing when there is no step to suggest.
 */
export default function NextStepCard({ step }) {
  const { t } = useI18n();
  if (!step) return null;
  const d = t.dash;
  const money = (n) => `${t.common.currency}${Number(n || 0)}`;

  const view = {
    bidNow: {
      icon: Gavel,
      tone: "border-destructive/40 bg-destructive/5",
      iconTone: "bg-destructive text-destructive-foreground",
      title: d.nextBidTitle,
      body: step.count > 1
        ? fill(d.nextBidMany, { count: step.count, title: step.auction?.title })
        : fill(d.nextBidBody, { title: step.auction?.title }),
      cta: d.nextBidCta,
      link: { to: "/auction/$id", params: { id: step.auction?.id } },
    },
    waiting: {
      icon: Hourglass,
      tone: "border-accent/35 bg-accent/5",
      iconTone: "bg-accent/15 text-accent",
      title: d.nextWaitTitle,
      body: step.seatsLeft === 1
        ? fill(d.nextWaitOne, { title: step.auction?.title })
        : fill(d.nextWaitBody, { title: step.auction?.title, count: step.seatsLeft }),
      cta: d.nextWaitCta,
      link: { to: "/auction/$id", params: { id: step.auction?.id } },
    },
    deposit: {
      icon: Plus,
      tone: "border-primary/40 bg-primary/5",
      iconTone: "bg-primary text-primary-foreground",
      title: d.nextDepositTitle,
      body: fill(d.nextDepositBody, { fee: money(step.cheapestEntry), count: step.count }),
      cta: d.nextDepositCta,
      link: { to: "/deposit" },
    },
    join: {
      icon: Ticket,
      tone: "border-primary/40 bg-primary/5",
      iconTone: "bg-primary text-primary-foreground",
      title: step.count === 1 ? d.nextJoinOne : fill(d.nextJoinTitle, { count: step.count }),
      body: d.nextJoinBody,
      cta: d.nextJoinCta,
      link: step.auction ? { to: "/auction/$id", params: { id: step.auction.id } } : { to: "/auctions" },
    },
  }[step.kind];
  if (!view) return null;
  const Icon = view.icon;

  return (
    <section className={cn("flex min-w-0 items-center gap-4 rounded-2xl border p-4", view.tone)}>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", view.iconTone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-extrabold leading-snug text-foreground">{view.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{view.body}</p>
      </div>
      <Link
        {...view.link}
        className="tap-44 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-extrabold text-background transition-transform active:scale-95"
      >
        {view.cta}
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </section>
  );
}
