import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, FileText, HelpCircle, Info, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { cn } from "@/lib/utils";
import { getLegalDoc, pageToDoc, LEGAL_UPDATED, SITE_PAGES } from "@/lib/legal";
import { usePublishedPage } from "@/lib/queries/config";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

// Pages that have built-in copy in src/lib/legal, used when admin → Pages
// has no published row for the slug.
const BUILT_IN = new Set(SITE_PAGES.filter((p) => p.builtIn).map((p) => p.slug));
const ICONS = { terms: FileText, privacy: ShieldCheck, about: Info, faq: HelpCircle };
const PAIR = { terms: "privacy", privacy: "terms" };

function formatUpdated(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value;
  }
}

/**
 * Terms, Privacy, About, FAQ. A published page in admin → Pages with the same
 * slug wins; otherwise Terms and Privacy fall back to src/lib/legal, and the
 * others show "not available".
 */
export function useSitePage(kind) {
  const { page, isPending } = usePublishedPage(kind);
  const fallback = BUILT_IN.has(kind) ? getLegalDoc(kind) : null;
  if (page) return { doc: pageToDoc(page, fallback), updated: page.updated_date || page.created_date, isPending: false };
  // The route loader reads the pages first, so this is only a guard: show
  // nothing rather than built-in copy that a published page would replace.
  if (isPending) return { doc: null, updated: null, isPending: true };
  return { doc: fallback, updated: fallback ? LEGAL_UPDATED : null, isPending: false };
}

function Sections({ doc, mobile }) {
  return doc.sections.map((s) => (
    <section
      key={s.id}
      id={mobile ? undefined : s.id}
      className={
        mobile
          ? "rounded-xl bg-card border border-border shadow-sm p-4"
          : "scroll-mt-24 rounded-2xl bg-card border border-border p-6 shadow-sm"
      }
    >
      {s.heading ? (
        <h2 className={mobile ? "font-display font-bold text-[14px] text-foreground leading-snug" : "font-display text-lg font-bold text-foreground"}>
          {s.heading}
        </h2>
      ) : null}
      <ul className={cn(s.heading && (mobile ? "mt-2" : "mt-3"), mobile ? "space-y-2" : "space-y-2.5")}>
        {s.body.map((line, i) => (
          <li
            key={i}
            className={cn("flex text-muted-foreground leading-relaxed", mobile ? "gap-2 text-[12.5px]" : "gap-2.5 text-sm")}
          >
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  ));
}

function NotAvailable() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-display font-bold text-foreground">This page isn&apos;t available yet.</p>
      <Link to="/" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
        Home
      </Link>
    </div>
  );
}

export default function LegalPage({ kind = "terms" }) {
  const { dir } = useI18n();
  const isMobile = useIsMobileView();
  const { doc, updated, isPending } = useSitePage(kind);
  const pairKind = PAIR[kind] || null;
  const pair = useSitePage(pairKind || "");
  const pairTitle = pairKind ? pair.doc?.title || getLegalDoc(pairKind).title : null;
  const Icon = ICONS[kind] || FileText;
  const updatedText = updated ? formatUpdated(updated) : null;

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
              {doc?.title || ""}
            </h1>
            <div className="w-10" aria-hidden="true" />
          </div>
        </header>

        <main className="flex-1 pb-[calc(32px+env(safe-area-inset-bottom))]">
          {isPending ? (
            null
          ) : !doc ? (
            <div className="mx-4 mt-3"><NotAvailable /></div>
          ) : (
            <>
              <div className="mx-4 mt-3 rounded-xl bg-card border border-primary/30 shadow-[0_14px_34px_-26px_hsl(var(--primary)/0.45)] p-4">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                {doc.intro ? <p className="text-[13px] text-muted-foreground leading-relaxed">{doc.intro}</p> : null}
                {updatedText ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {doc.updatedLabel}: {updatedText}
                  </p>
                ) : null}
              </div>

              <div className="mx-4 mt-3 space-y-2.5">
                <Sections doc={doc} mobile />
              </div>

              <div className="mx-4 mt-4 flex gap-2">
                {pairKind ? (
                  <Link
                    to={`/${pairKind}`}
                    className="flex-1 h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition"
                  >
                    {pairTitle}
                  </Link>
                ) : null}
                <Link
                  to="/"
                  className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center text-[13px] font-bold active:scale-95 transition"
                >
                  {"Home"}
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {isPending ? (
          null
        ) : !doc ? (
          <div className="max-w-3xl"><NotAvailable /></div>
        ) : (
          <>
            <div className="max-w-3xl">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-5">
                <Icon className="w-7 h-7" aria-hidden="true" />
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {doc.title}
              </h1>
              {doc.subtitle ? <p className="mt-2 text-muted-foreground">{doc.subtitle}</p> : null}
              {updatedText ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.updatedLabel}: {updatedText}
                </p>
              ) : null}
              {doc.intro ? <p className="mt-6 text-[15px] leading-relaxed text-foreground/80">{doc.intro}</p> : null}
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
              <nav aria-label={doc.title} className="hidden lg:block">
                <div className="sticky top-24 space-y-1">
                  {doc.sections.filter((s) => s.heading).map((s) => (
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
                <Sections doc={doc} />

                {pairKind ? (
                  <div className="pt-2">
                    <Link to={`/${pairKind}`} className="text-sm font-semibold text-primary hover:underline">
                      {pairTitle}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
