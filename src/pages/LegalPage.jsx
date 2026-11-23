import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, FileText, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { cn } from "@/lib/utils";
import { getLegalDoc, LEGAL_UPDATED } from "@/lib/legal";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

function formatUpdated(lang) {
  try {
    return new Date(LEGAL_UPDATED).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return LEGAL_UPDATED;
  }
}

export default function LegalPage({ kind = "terms" }) {
  const { lang, dir } = useI18n();
  const isMobile = useIsMobileView();
  const doc = getLegalDoc(kind, lang);
  const Icon = kind === "privacy" ? ShieldCheck : FileText;
  const updated = formatUpdated(lang);

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
              <ChevronLeft className={cn("w-5 h-5")} />
            </Link>
            <h1 className="flex-1 text-center font-display font-extrabold text-[15px] text-foreground truncate px-1">
              {doc.title}
            </h1>
            <div className="w-10" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 pb-[calc(32px+env(safe-area-inset-bottom))]">
          <div className="mx-4 mt-3 rounded-xl bg-card border border-primary/30 shadow-[0_14px_34px_-26px_hsl(var(--primary)/0.45)] p-4">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{doc.intro}</p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {doc.updatedLabel}: {updated}
            </p>
          </div>

          <div className="mx-4 mt-3 space-y-2.5">
            {doc.sections.map((s) => (
              <section
                key={s.id}
                className="rounded-xl bg-card border border-border shadow-sm p-4"
              >
                <h2 className="font-display font-bold text-[14px] text-foreground leading-snug">{s.heading}</h2>
                <ul className="mt-2 space-y-2">
                  {s.body.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] text-muted-foreground leading-relaxed">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mx-4 mt-4 flex gap-2">
            <Link
              to={kind === "privacy" ? "/terms" : "/privacy"}
              className="flex-1 h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition"
            >
              {kind === "privacy"
                ? getLegalDoc("terms", lang).title
                : getLegalDoc("privacy", lang).title}
            </Link>
            <Link
              to="/"
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center text-[13px] font-bold active:scale-95 transition"
            >
              {"Home"}
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
            <Icon className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {doc.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{doc.subtitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {doc.updatedLabel}: {updated}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-foreground/80">{doc.intro}</p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav aria-label={doc.title} className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              {doc.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                >
                  {s.heading}
                </a>
              ))}
            </div>
          </nav>

          <div className="space-y-6 max-w-3xl">
            {doc.sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 rounded-2xl bg-card border border-border p-6 shadow-sm"
              >
                <h2 className="font-display text-lg font-bold text-foreground">{s.heading}</h2>
                <ul className="mt-3 space-y-2.5">
                  {s.body.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="pt-2">
              <Link
                to={kind === "privacy" ? "/terms" : "/privacy"}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {kind === "privacy"
                  ? getLegalDoc("terms", lang).title
                  : getLegalDoc("privacy", lang).title}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
